import { NextResponse } from "next/server";
import { classifyWithAI } from "@/lib/tron-ai";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }
    const result = await classifyWithAI(text.trim());
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Classification failed";
    console.error("[/api/classify]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
