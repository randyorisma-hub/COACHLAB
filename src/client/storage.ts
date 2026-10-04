/**
 * Per-device memory of the playbooks this coach owns (id + edit token).
 * The server only stores a hash of the token; losing local storage means
 * losing edit access, so the Playbooks page offers an "edit key" export.
 */
export interface OwnedPlaybook {
  id: string;
  name: string;
  editToken: string;
}

const KEY = "dpl.playbooks.v1";

export function loadOwned(): OwnedPlaybook[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.id === "string" && typeof p.editToken === "string") : [];
  } catch {
    return [];
  }
}

export function saveOwned(list: OwnedPlaybook[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Private mode / storage disabled: ownership lasts for this session only.
  }
}

export function sessionGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function sessionSet(key: string, value: unknown): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}
