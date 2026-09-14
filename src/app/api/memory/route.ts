import { NextResponse } from "next/server";
import {
  rememberFact,
  listMemories,
  searchMemories,
  forgetMatching,
  forgetById,
  clearAllMemories,
} from "@/server/memory";
import { requireOwner } from "@/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await requireOwner();
  if (!uid) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const body = await req.json();

    switch (body.op) {
      case "remember": {
        const content = String(body.content ?? "").trim();
        if (!content) return NextResponse.json({ error: "Nothing to remember" }, { status: 400 });
        return NextResponse.json({ item: rememberFact(content) });
      }

      case "recall":
        return NextResponse.json({ items: searchMemories(String(body.subject ?? "")) });

      case "list":
        return NextResponse.json({ items: listMemories() });

      case "forget":
        return NextResponse.json({ removed: forgetMatching(String(body.subject ?? "")) });

      case "forgetById":
        return NextResponse.json({ ok: forgetById(String(body.id ?? "")) });

      case "clear":
        return NextResponse.json({ removed: clearAllMemories() });

      default:
        return NextResponse.json({ error: `Unknown op: ${body.op}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Memory operation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const uid = await requireOwner();
  if (!uid) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ items: listMemories() });
}
