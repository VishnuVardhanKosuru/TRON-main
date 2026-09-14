import { NextResponse } from "next/server";
import { pingModel } from "@/lib/ai-gateway";
import { countAll } from "@/server/docstore";
import { listMemories } from "@/server/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Powers `tron status` and anything that needs to know TRON is alive. */
export async function GET() {
  const model = await pingModel();

  let database = { ok: false, detail: "unavailable", documents: 0, memories: 0 };
  try {
    database = {
      ok: true,
      detail: process.env.TRON_DB_PATH || "data/tron.db",
      documents: countAll(),
      memories: listMemories(1000).length,
    };
  } catch (err) {
    database.detail = err instanceof Error ? err.message : "SQLite error";
  }

  return NextResponse.json({
    name: "TRON",
    version: "1.0.0",
    ok: database.ok,
    uptimeSeconds: Math.round(process.uptime()),
    database,
    model,
  });
}
