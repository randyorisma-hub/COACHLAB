import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildTimeline, frameAt } from "../../shared/engine";
import type { ActivityEnvelope } from "../../shared/schema";
import type { Mode } from "../api";
import { streamChat, type ChatEvent } from "../chat";
import { OriginBadge } from "./Badges";
import { Court } from "./Court";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  activities: ActivityEnvelope[];
  status?: string;
  error?: string;
  note?: string;
  pending?: boolean;
}

const STARTERS = [
  "We have 12 eighth graders who need to improve passing and cutting.",
  "Plan a fun 45-minute camp session for 30 kids ages 8–10 in one gym.",
  "Give me 3 competitive basketball camp games for the last 15 minutes of the day.",
  "My JV team turns it over against full-court pressure. What should we practice?",
  "Explain how to teach closeouts to 6th graders in 10 minutes.",
  "Rainy day: indoor games for 40 campers with only half a gym.",
];

let counter = 0;
const mid = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

export function ChatView({
  messages,
  setMessages,
  mode,
  onOpen,
}: {
  messages: ChatMessage[];
  setMessages: (update: (prev: ChatMessage[]) => ChatMessage[]) => void;
  mode: Mode | null;
  onOpen: (env: ActivityEnvelope) => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const voice = useVoiceInput((text) => setInput((v) => (v ? `${v} ${text}` : text)));

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    voice.stop();
    const user: ChatMessage = { id: mid(), role: "user", text: clean, activities: [] };
    const reply: ChatMessage = { id: mid(), role: "assistant", text: "", activities: [], pending: true, status: "Thinking…" };
    const history = [...messages.filter((m) => !m.error || m.text), user];
    setMessages(() => [...history, reply]);
    setInput("");
    setBusy(true);
    const abort = new AbortController();
    abortRef.current = abort;
    const update = (fn: (m: ChatMessage) => ChatMessage) => setMessages((prev) => prev.map((m) => (m.id === reply.id ? fn(m) : m)));

    await streamChat(
      history.map((m) => ({ role: m.role, text: m.text, shown: m.activities.map((a) => a.activity.title) })),
      (e: ChatEvent) => {
        if (e.type === "text") update((m) => ({ ...m, text: m.text + e.delta, status: undefined }));
        else if (e.type === "status") update((m) => ({ ...m, status: e.message }));
        else if (e.type === "activity") update((m) => ({ ...m, activities: [...m.activities, e.envelope], status: undefined }));
        else if (e.type === "replace") update((m) => ({ ...m, text: e.text, note: e.note }));
        else if (e.type === "error") update((m) => ({ ...m, error: e.message, status: undefined }));
      },
      abort.signal,
    );
    update((m) => ({ ...m, pending: false, status: undefined }));
    setBusy(false);
  };

  const stop = () => {
    abortRef.current?.abort();
    setMessages((prev) => prev.map((m) => (m.pending ? { ...m, pending: false, status: undefined, note: "Stopped." } : m)));
    setBusy(false);
  };

  return (
    <div className="chat">
      {messages.length === 0 ? (
        <section className="chat-welcome">
          <h2>What are we working on?</h2>
          <p className="hint">
            Ask for drills, plays, camp games or a practice plan. Type or tap the mic. Drills show up on an animated court you
            can open, edit and save.
          </p>
          <div className="starter-grid">
            {STARTERS.map((s) => (
              <button key={s} type="button" className="starter" onClick={() => void send(s)}>
                {s}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="chat-log" aria-live="polite">
          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} onOpen={onOpen} />
          ))}
          <div ref={endRef} />
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          id="chat-input"
          rows={1}
          value={input}
          maxLength={4000}
          placeholder={voice.listening ? "Listening…" : "Ask about a drill, play, practice or camp game…"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          aria-label="Message"
        />
        {voice.supported && (
          <button
            type="button"
            className={`icon-btn mic ${voice.listening ? "mic--on" : ""}`}
            onClick={voice.listening ? voice.stop : voice.start}
            aria-label={voice.listening ? "Stop listening" : "Speak your message"}
            title={voice.listening ? "Stop listening" : "Speak"}
          >
            <MicIcon />
          </button>
        )}
        {busy ? (
          <button type="button" className="btn" onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="btn btn--primary" disabled={!input.trim()}>
            Send
          </button>
        )}
      </form>
      <div className="chat-foot">
        {voice.error && <span className="error">{voice.error}</span>}
        {mode === "demo" && <span className="hint">Demo mode: replies come from the drill library, not the AI.</span>}
        {messages.length > 0 && !busy && (
          <button type="button" className="btn btn--tiny btn--ghost" onClick={() => setMessages(() => [])}>
            New conversation
          </button>
        )}
      </div>
    </div>
  );
}

function ChatBubble({ message, onOpen }: { message: ChatMessage; onOpen: (env: ActivityEnvelope) => void }) {
  if (message.role === "user") {
    return (
      <div className="bubble bubble--user">
        <p>{message.text}</p>
      </div>
    );
  }
  return (
    <div className="bubble bubble--assistant">
      {message.text && <RichText text={message.text} />}
      {message.activities.length > 0 && (
        <div className="chat-activities">
          {message.activities.map((env) => (
            <ChatActivity key={env.activity.id} env={env} onOpen={() => onOpen(env)} />
          ))}
        </div>
      )}
      {message.status && <p className="status-line">{message.status}</p>}
      {message.note && <p className="hint">{message.note}</p>}
      {message.error && <p className="error">{message.error}</p>}
    </div>
  );
}

function ChatActivity({ env, onOpen }: { env: ActivityEnvelope; onOpen: () => void }) {
  const timeline = useMemo(() => buildTimeline(env.activity), [env.activity]);
  return (
    <article className="chat-activity panel">
      <button type="button" className="chat-activity-court" onClick={onOpen} aria-label={`Open ${env.activity.title}`}>
        <Court timeline={timeline} frame={frameAt(timeline, 0)} pathStep={env.activity.steps.length ? 0 : -1} />
      </button>
      <div className="chat-activity-body">
        <div className="row space">
          <h4>{env.activity.title}</h4>
          <OriginBadge origin={env.origin} />
        </div>
        <p className="meta">
          {env.activity.players.length} players · {env.activity.court} court · {env.activity.steps.length} steps
        </p>
        <button type="button" className="btn btn--primary btn--tiny" onClick={onOpen}>
          Open & animate
        </button>
      </div>
    </article>
  );
}

/** Minimal, safe formatting: paragraphs, "- " bullets, "1. " lists and **bold**. */
export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(" "))}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushPara();
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
    } else if (!line) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <div className="rich">{blocks}</div>;
}

function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Minimal typing for the browser speech recognition API (not in TypeScript's DOM lib).
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

/** Speech-to-text using the browser's built-in recognition, where available. */
function useVoiceInput(onText: (text: string) => void) {
  const Ctor = useMemo(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  }, []);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    if (!Ctor) return;
    setError(null);
    try {
      const rec = new Ctor();
      rec.lang = navigator.language || "en-US";
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) onText(e.results[i][0].transcript.trim());
      };
      rec.onerror = (e) => {
        setError(e.error === "not-allowed" ? "Microphone access is blocked. Allow it in your browser settings, or type instead." : "Couldn't hear that. Try again or type instead.");
        setListening(false);
      };
      rec.onend = () => setListening(false);
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setError("Voice input isn't available here. Type instead.");
      setListening(false);
    }
  };
  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };
  return { supported: !!Ctor, listening, error, start, stop };
}
