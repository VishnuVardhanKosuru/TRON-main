import { getRevisions } from "@/server/sqlite";
import { requireOwner } from "@/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live updates without Firestore.
 *
 * Every write bumps a per-collection revision counter in SQLite. This stream
 * watches those counters and pushes the list of changed collection paths, which
 * is what the client's onSnapshot shim listens to. Cheap enough to run all day
 * on a phone.
 */
export async function GET(req: Request) {
  const uid = await requireOwner();
  if (!uid) return new Response("Not signed in", { status: 401 });

  const encoder = new TextEncoder();
  const POLL_MS = Number(process.env.TRON_EVENT_POLL_MS || 700);

  let timer: ReturnType<typeof setInterval> | undefined;
  let previous = getRevisions();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          /* stream already closed */
        }
      };

      send("ready", { revisions: previous });

      timer = setInterval(() => {
        try {
          const current = getRevisions();
          const changed: string[] = [];
          for (const [path, rev] of Object.entries(current)) {
            if (path === "__global__") continue;
            if (previous[path] !== rev) changed.push(path);
          }
          if (changed.length) send("changed", { paths: changed });
          else send("ping", { t: Date.now() });
          previous = current;
        } catch (err) {
          console.error("[/api/data/events]", err);
        }
      }, POLL_MS);

      req.signal.addEventListener("abort", () => {
        if (timer) clearInterval(timer);
        try { controller.close(); } catch { /* noop */ }
      });
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
