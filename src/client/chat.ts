import type { ActivityEnvelope } from "../shared/schema";

export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "status"; message: string }
  | { type: "activity"; envelope: ActivityEnvelope; libraryKey: string | null }
  | { type: "replace"; text: string; note: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  shown: string[];
}

/**
 * Incremental parser for the server-sent events from /api/chat.
 * Feed it chunks of text; it returns the complete events found so far.
 */
export function createSSEParser() {
  let buffer = "";
  return (chunk: string): ChatEvent[] => {
    buffer += chunk;
    const events: ChatEvent[] = [];
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const data = raw
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      try {
        events.push(JSON.parse(data) as ChatEvent);
      } catch {
        // Ignore a malformed event rather than breaking the conversation.
      }
    }
    return events;
  };
}

/** Send the conversation and stream the reply as events. */
export async function streamChat(
  messages: ChatTurn[],
  onEvent: (e: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return;
    onEvent({ type: "error", message: "Can't reach the Driven Play Lab server. Check your connection." });
    return;
  }
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    onEvent({ type: "error", message: data.error ?? `Request failed (${res.status})` });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parse = createSSEParser();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const e of parse(decoder.decode(value, { stream: true }))) onEvent(e);
    }
  } catch {
    if (!signal?.aborted) onEvent({ type: "error", message: "The connection dropped before the answer finished." });
  }
}
