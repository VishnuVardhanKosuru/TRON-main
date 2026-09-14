import { NextResponse } from "next/server";
import { generateBriefing } from "@/lib/tron-ai";

export async function POST(req: Request) {
  try {
    const { snapshotText } = await req.json();
    if (!snapshotText?.trim()) {
      return NextResponse.json({ error: "No snapshot provided" }, { status: 400 });
    }
    const briefingText = await generateBriefing(snapshotText.trim());
    return NextResponse.json({ briefing_text: briefingText });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Briefing failed";
    console.error("[/api/briefing]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
