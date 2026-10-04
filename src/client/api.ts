import type {
  Activity,
  ActivityEnvelope,
  GenerateRequest,
  Origin,
  PlaybookOwnerView,
  PlaybookPublic,
  SavedActivity,
} from "../shared/schema";

export type Mode = "ai" | "demo";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(method: string, url: string, body?: unknown, editToken?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (editToken) headers["x-edit-token"] = editToken;
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError("Can't reach the Driven Play Lab server. Check your connection.", 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export const api = {
  health: () => call<{ ok: boolean; mode: Mode }>("GET", "/api/health"),
  generate: (req: GenerateRequest) => call<{ mode: Mode; suggestions: ActivityEnvelope[] }>("POST", "/api/generate", req),
  revise: (activity: Activity, instruction: string) =>
    call<{ mode: Mode; result: ActivityEnvelope; changeSummary: string }>("POST", "/api/revise", { activity, instruction }),
  createPlaybook: (name: string, team: string) =>
    call<{ playbook: PlaybookOwnerView; editToken: string }>("POST", "/api/playbooks", { name, team }),
  getPlaybook: (id: string, token: string) => call<PlaybookOwnerView>("GET", `/api/playbooks/${encodeURIComponent(id)}`, undefined, token),
  deletePlaybook: (id: string, token: string) => call<void>("DELETE", `/api/playbooks/${encodeURIComponent(id)}`, undefined, token),
  saveActivity: (id: string, token: string, activity: Activity, origin: Origin) =>
    call<SavedActivity>("POST", `/api/playbooks/${encodeURIComponent(id)}/activities`, { activity, origin }, token),
  removeActivity: (id: string, token: string, savedId: string) =>
    call<void>("DELETE", `/api/playbooks/${encodeURIComponent(id)}/activities/${encodeURIComponent(savedId)}`, undefined, token),
  rotateShare: (id: string, token: string) =>
    call<PlaybookOwnerView>("POST", `/api/playbooks/${encodeURIComponent(id)}/share/rotate`, undefined, token),
  getShared: (shareId: string) => call<PlaybookPublic>("GET", `/api/share/${encodeURIComponent(shareId)}`),
};

export function shareUrl(shareId: string, savedId?: string): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#/share/${shareId}${savedId ? `/${savedId}` : ""}`;
}
