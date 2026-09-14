/**
 * TRON — local AI gateway.
 *
 * Talks to the llama.cpp server already running on the Redmi. No cloud model,
 * no API key, no network egress.
 *
 *   llama-server -m Qwen3-1.7B-Q4_K_M.gguf --host 127.0.0.1 --port 8080 --jinja
 *
 * The endpoint is OpenAI-compatible (/v1/chat/completions), so this file speaks
 * that dialect and cleans up the two Qwen3 quirks we care about: <think> blocks
 * and tool calls that sometimes arrive as text instead of structured JSON.
 */

const BASE_URL = (process.env.TRON_LLM_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");
const MODEL = process.env.TRON_LLM_MODEL || "Qwen3-1.7B-Q4_K_M";
const TIMEOUT_MS = parseInt(process.env.TRON_LLM_TIMEOUT_MS || "120000", 10);

export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: Role;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface GatewayOptions {
  temperature?: number;
  tools?: unknown[];
  jsonMode?: boolean;
  responseSchema?: Record<string, unknown>;
  maxTokens?: number;
  /** Qwen3 reasoning. Off by default — a 1.7B model on a phone should answer, not muse. */
  thinking?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit, timeout: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/** Qwen3 emits reasoning inside <think>…</think>. Never show it to the user. */
export function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .trim();
}

/** Pull the first balanced JSON object out of a response that may have prose around it. */
export function extractJson(text: string): string | null {
  const cleaned = stripThinking(text)
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Some llama.cpp builds hand back tool calls as plain text like
 * `<tool_call>{"name":"x","arguments":{}}</tool_call>`. Normalise those.
 */
function parseInlineToolCalls(text: string): ToolCall[] | null {
  const matches = [...text.matchAll(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi)];
  if (matches.length === 0) return null;

  const calls: ToolCall[] = [];
  for (const [, payload] of matches) {
    try {
      const parsed = JSON.parse(payload) as { name?: string; arguments?: unknown };
      if (!parsed.name) continue;
      calls.push({
        id: `call_${Date.now()}_${calls.length}`,
        type: "function",
        function: {
          name: parsed.name,
          arguments:
            typeof parsed.arguments === "string"
              ? parsed.arguments
              : JSON.stringify(parsed.arguments ?? {}),
        },
      });
    } catch { /* not a tool call after all */ }
  }
  return calls.length ? calls : null;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function askGateway(
  messages: ChatMessage[],
  options: GatewayOptions = {}
): Promise<ChatMessage> {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content ?? "",
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      ...(m.name ? { name: m.name } : {}),
    })),
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 1024,
    stream: false,
    // Qwen3 reads this to decide whether to open a <think> block.
    chat_template_kwargs: { enable_thinking: Boolean(options.thinking) },
  };

  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = "auto";
  }

  if (options.jsonMode || options.responseSchema) {
    body.response_format = options.responseSchema
      ? { type: "json_object", schema: options.responseSchema }
      : { type: "json_object" };
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${BASE_URL}/v1/chat/completions`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      TIMEOUT_MS
    );
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError"
      ? `timed out after ${TIMEOUT_MS}ms`
      : "is not reachable";
    throw new Error(
      `Local model at ${BASE_URL} ${reason}. Start it with: tron start-llm`
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`llama.cpp returned ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  if (!choice) throw new Error("llama.cpp returned no choices");

  const message = choice.message ?? {};
  const rawContent: string = message.content ?? "";

  // Structured tool calls, when the build supports them.
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    return {
      role: "assistant",
      content: null,
      tool_calls: message.tool_calls.map((tc: ToolCall, i: number) => ({
        id: tc.id || `call_${Date.now()}_${i}`,
        type: "function",
        function: {
          name: tc.function?.name,
          arguments:
            typeof tc.function?.arguments === "string"
              ? tc.function.arguments
              : JSON.stringify(tc.function?.arguments ?? {}),
        },
      })),
    };
  }

  // Fallback: tool calls embedded in the text.
  const inline = parseInlineToolCalls(rawContent);
  if (inline) return { role: "assistant", content: null, tool_calls: inline };

  return { role: "assistant", content: stripThinking(rawContent) };
}

/** Used by the status endpoint and the `tron status` command. */
export async function pingModel(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/health`, { method: "GET" }, 4000);
    if (res.ok) return { ok: true, detail: `llama.cpp healthy at ${BASE_URL}` };
    return { ok: false, detail: `llama.cpp responded ${res.status}` };
  } catch {
    return { ok: false, detail: `No response from ${BASE_URL}` };
  }
}
