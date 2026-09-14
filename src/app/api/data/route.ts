import { NextResponse } from "next/server";
import {
  listCollection,
  getDocument,
  addDocument,
  setDocument,
  updateDocument,
  deleteDocument,
  purgeCollections,
  type Json,
  type Filter,
} from "@/server/docstore";
import { getRevisions } from "@/server/sqlite";
import { requireOwner, assertOwnedPath } from "@/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One endpoint for the whole local data layer. The browser-side Firestore-shaped
 * client (src/lib/tron/firestore.ts) speaks to this and nothing else.
 */
export async function POST(req: Request) {
  const uid = await requireOwner();
  if (!uid) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      op: string;
      path?: string;
      paths?: string[];
      id?: string;
      data?: Json;
      merge?: boolean;
      filters?: Filter[];
      orderBy?: { field: string; dir: "asc" | "desc" };
      limit?: number;
    };

    switch (body.op) {
      case "list": {
        const path = assertOwnedPath(body.path!, uid);
        const docs = listCollection({
          path,
          filters: body.filters,
          orderBy: body.orderBy,
          limit: body.limit,
        });
        return NextResponse.json({ docs });
      }

      case "get": {
        const path = assertOwnedPath(body.path!, uid);
        const doc = getDocument(path, body.id!);
        return NextResponse.json({ doc });
      }

      case "add": {
        const path = assertOwnedPath(body.path!, uid);
        const doc = addDocument(path, body.data ?? {});
        return NextResponse.json({ doc });
      }

      case "set": {
        const path = assertOwnedPath(body.path!, uid);
        const doc = setDocument(path, body.id!, body.data ?? {}, Boolean(body.merge));
        return NextResponse.json({ doc });
      }

      case "update": {
        const path = assertOwnedPath(body.path!, uid);
        const doc = updateDocument(path, body.id!, body.data ?? {});
        return NextResponse.json({ doc });
      }

      case "delete": {
        const path = assertOwnedPath(body.path!, uid);
        deleteDocument(path, body.id!);
        return NextResponse.json({ ok: true });
      }

      case "purge": {
        const paths = (body.paths ?? []).map((p) => assertOwnedPath(p, uid));
        const deletedCount = purgeCollections(paths);
        return NextResponse.json({ deletedCount });
      }

      case "revisions":
        return NextResponse.json({ revisions: getRevisions() });

      default:
        return NextResponse.json({ error: `Unknown op: ${body.op}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Data operation failed";
    console.error("[/api/data]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
