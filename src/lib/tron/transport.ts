/**
 * TRON — browser ↔ Redmi transport.
 *
 * Talks to /api/data on the local server. Also owns one shared SSE connection
 * that tells us which collections changed, which is what powers live updates
 * now that Firestore is gone.
 */

export interface WireDoc {
  id: string;
  path: string;
  data: Record<string, unknown>;
  createdMs: number;
  updatedMs: number;
}

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = `TRON data error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* keep default */ }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export const api = {
  list: (payload: Record<string, unknown>) =>
    call<{ docs: WireDoc[] }>({ op: "list", ...payload }),
  get: (path: string, id: string) =>
    call<{ doc: WireDoc | null }>({ op: "get", path, id }),
  add: (path: string, data: unknown) =>
    call<{ doc: WireDoc }>({ op: "add", path, data }),
  set: (path: string, id: string, data: unknown, merge: boolean) =>
    call<{ doc: WireDoc }>({ op: "set", path, id, data, merge }),
  update: (path: string, id: string, data: unknown) =>
    call<{ doc: WireDoc }>({ op: "update", path, id, data }),
  remove: (path: string, id: string) =>
    call<{ ok: true }>({ op: "delete", path, id }),
  purge: (paths: string[]) =>
    call<{ deletedCount: number }>({ op: "purge", paths }),
};

// ── Change notifications ──────────────────────────────────────────────────────

type PathListener = () => void;

const listeners = new Map<string, Set<PathListener>>();
let source: EventSource | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastRevisions: Record<string, number> = {};

function notify(paths: string[]) {
  for (const p of paths) {
    const set = listeners.get(p);
    if (!set) continue;
    for (const fn of set) {
      try { fn(); } catch (err) { console.error("[TRON] listener failed", err); }
    }
  }
}

/** Fallback for environments where SSE gets buffered by a proxy. */
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    try {
      const { revisions } = await call<{ revisions: Record<string, number> }>({
        op: "revisions",
      });
      const changed: string[] = [];
      for (const [path, rev] of Object.entries(revisions)) {
        if (path === "__global__") continue;
        if (lastRevisions[path] !== rev) changed.push(path);
      }
      lastRevisions = revisions;
      if (changed.length) notify(changed);
    } catch { /* offline; try again next tick */ }
  }, 2500);
}

function ensureStream() {
  if (typeof window === "undefined" || source) return;

  try {
    source = new EventSource("/api/data/events");

    source.addEventListener("changed", (ev) => {
      try {
        const { paths } = JSON.parse((ev as MessageEvent).data) as { paths: string[] };
        notify(paths);
      } catch { /* ignore malformed frame */ }
    });

    source.onerror = () => {
      // Browser retries SSE on its own; polling covers the gap either way.
      startPolling();
    };
  } catch {
    startPolling();
  }
}

/** Re-run `fn` whenever anything in `path` changes. Returns an unsubscribe. */
export function watchPath(path: string, fn: PathListener): () => void {
  ensureStream();
  if (!listeners.has(path)) listeners.set(path, new Set());
  listeners.get(path)!.add(fn);

  return () => {
    const set = listeners.get(path);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) listeners.delete(path);
  };
}
