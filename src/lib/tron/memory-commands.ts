/**
 * TRON — memory command parser.
 *
 * Deliberately rule-based, not model-based. Memory in V1 is something you
 * control with an explicit sentence, so the trigger has to be exact and
 * predictable rather than something the model guesses at.
 *
 *   TRON, remember my passport expires in March
 *   TRON, what do you remember about my passport?
 *   TRON, forget my passport
 *   TRON, what do you remember?
 */

export type MemoryCommand =
  | { kind: "remember"; content: string }
  | { kind: "forget"; subject: string }
  | { kind: "recall"; subject: string }
  | { kind: "list" };

/** Strip an optional "TRON," / "tron " address prefix. */
function stripAddress(text: string): string {
  return text.trim().replace(/^(hey\s+)?tron\s*[,:!]?\s*/i, "").trim();
}

export function parseMemoryCommand(input: string): MemoryCommand | null {
  const raw = input.trim();
  if (!raw) return null;

  // The address prefix is what makes a memory command a memory command.
  const addressed = /^(hey\s+)?tron\s*[,:!]?\s+/i.test(raw);
  if (!addressed) return null;

  const body = stripAddress(raw);
  const lower = body.toLowerCase();

  // "what do you remember [about X]" / "what do you know about X"
  const recall = body.match(
    /^what\s+do\s+you\s+(?:remember|know)(?:\s+about)?\s*(.*?)\s*\??$/i
  );
  if (recall) {
    const subject = recall[1].trim();
    return subject ? { kind: "recall", subject } : { kind: "list" };
  }

  if (/^(list|show)\s+(your\s+)?memor(y|ies)\b/i.test(lower)) {
    return { kind: "list" };
  }

  const forget = body.match(/^forget\s+(?:about\s+)?(.+)$/i);
  if (forget) {
    const subject = forget[1].trim().replace(/[.!?]+$/, "");
    return subject ? { kind: "forget", subject } : null;
  }

  const remember = body.match(/^remember\s+(?:that\s+)?(.+)$/i);
  if (remember) {
    const content = remember[1].trim().replace(/[.!]+$/, "");
    return content ? { kind: "remember", content } : null;
  }

  return null;
}

// ── Client helpers ────────────────────────────────────────────────────────────

export interface MemoryItem {
  id: string;
  content: string;
  createdMs: number;
}

async function callMemory<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Memory operation failed");
  }
  return res.json() as Promise<T>;
}

/**
 * Runs a memory command and returns exactly what TRON should say back.
 * Returns null when the input was not a memory command, so the caller can
 * fall through to the normal chat path.
 */
export async function runMemoryCommand(input: string): Promise<string | null> {
  const cmd = parseMemoryCommand(input);
  if (!cmd) return null;

  switch (cmd.kind) {
    case "remember": {
      await callMemory({ op: "remember", content: cmd.content });
      return `Remembered: ${cmd.content}`;
    }

    case "forget": {
      const { removed } = await callMemory<{ removed: MemoryItem[] }>({
        op: "forget",
        subject: cmd.subject,
      });
      if (removed.length === 0) return `I have nothing stored about "${cmd.subject}".`;
      if (removed.length === 1) return `Forgotten: ${removed[0].content}`;
      return `Forgot ${removed.length} entries:\n${removed.map((m) => `- ${m.content}`).join("\n")}`;
    }

    case "recall": {
      const { items } = await callMemory<{ items: MemoryItem[] }>({
        op: "recall",
        subject: cmd.subject,
      });
      if (items.length === 0) return `Nothing stored about "${cmd.subject}" yet.`;
      return items.map((m) => `- ${m.content}`).join("\n");
    }

    case "list": {
      const { items } = await callMemory<{ items: MemoryItem[] }>({ op: "list" });
      if (items.length === 0) {
        return "Memory is empty. Tell me \"TRON, remember ...\" and I'll keep it.";
      }
      return `I'm holding ${items.length} ${items.length === 1 ? "memory" : "memories"}:\n${items
        .map((m) => `- ${m.content}`)
        .join("\n")}`;
    }
  }
}
