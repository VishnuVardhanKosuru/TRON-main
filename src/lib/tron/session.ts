/**
 * TRON — client-side session state.
 *
 * Single owner, single passphrase. The real session lives in an httpOnly cookie
 * set by the Redmi; this is just the in-page mirror so components can read
 * `user.uid` the way they always have.
 */

export interface TronUser {
  uid: string;
  displayName: string;
}

type Listener = (user: TronUser | null) => void;

let current: TronUser | null = null;
let resolved = false;
const listeners = new Set<Listener>();

export function getCurrentUser(): TronUser | null {
  return current;
}

export function hasResolved(): boolean {
  return resolved;
}

export function setCurrentUser(user: TronUser | null) {
  current = user;
  resolved = true;
  for (const fn of listeners) {
    try { fn(current); } catch (err) { console.error("[TRON] auth listener failed", err); }
  }
}

export function onUserChanged(fn: Listener): () => void {
  listeners.add(fn);
  if (resolved) fn(current);
  return () => listeners.delete(fn);
}

// ── Server calls ──────────────────────────────────────────────────────────────

export async function fetchSession(): Promise<TronUser | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    const body = await res.json();
    setCurrentUser(body.user ?? null);
    return body.user ?? null;
  } catch {
    setCurrentUser(null);
    return null;
  }
}

export async function signInWithPassphrase(passphrase: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      passphrase,
      label: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "device",
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Could not unlock TRON.");
  }

  await fetchSession();
}

export async function signOutOfTron(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  setCurrentUser(null);
}
