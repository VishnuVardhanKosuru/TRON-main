"use server";

import { classifyWithAI } from "@/lib/tron-ai";
import type { AICaptureResult } from "@/lib/tron-ai";

/**
 * Server action wrapper so classifyWithAI runs on the server, where the local
 * llama.cpp endpoint lives, even when called from client-side tools.ts.
 */
export async function classifyCapture(text: string): Promise<AICaptureResult> {
  return classifyWithAI(text);
}
