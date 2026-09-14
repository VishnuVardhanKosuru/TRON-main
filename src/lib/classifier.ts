// Rule-based capture classifier — deterministic, no AI needed.
// TWO roles:
//   1. INSTANT HIGH-CONFIDENCE: explicit user prefixes (!, r:, j:, etc.) → skip AI entirely for private/simple types
//   2. SAFETY FALLBACK: unambiguous content signals (iou, travel, etc.) → used IF Gemma fails

// Types that must NEVER go to AI (private data or explicitly prefixed by user intent)
export const BYPASS_AI_TYPES = new Set([
  "journal", "gratitude", "vault", "mood", "health", "period"
]);

export type ClassifiedType =
  | "todo" | "routine" | "reminder"
  | "idea" | "link" | "question" | "journal" | "gratitude"
  | "iou" | "borrowed" | "shopping" | "stock"
  | "people_note" | "meeting" | "followup"
  | "travel" | "wishlist" | "personal_link" | "errand" | "vault" | "mood" | "health"
  | "goal" | "period";

interface ClassifyResult {
  type: ClassifiedType;
  confidence: "high" | "low";
}

export function classifyCapture(raw: string): ClassifyResult {
  const t = raw.trim();
  const l = t.toLowerCase();

  // ── EXPLICIT USER PREFIXES (bypass AI entirely for private types) ─────────
  if (/^(journal:|j:)\s/i.test(t))                      return { type: "journal",   confidence: "high" };
  if (/^(grateful:|gratitude:|g:)\s/i.test(t))          return { type: "gratitude", confidence: "high" };
  if (/^(password:|secret:|vault:|pin:)\s/i.test(t))    return { type: "vault",     confidence: "high" };
  if (/^(mood:|feeling:|felt:)\s/i.test(t))             return { type: "mood",      confidence: "high" };
  if (/^(health:|symptom:|med:|medication:|dr:|doctor:)\s/i.test(t)) return { type: "health", confidence: "high" };
  if (/^(period:|cycle:)\s/i.test(t))                   return { type: "period",    confidence: "high" };

  // ── EXPLICIT USER SHORTCUTS (will still go to Gemma for multi-capture) ────
  if (/^(!|todo:)\s/i.test(t))                          return { type: "todo",      confidence: "high" };
  if (/^(r:|remind:|reminder:)\s/i.test(t))             return { type: "reminder",  confidence: "high" };
  if (/^(ev:|routine:)\s/i.test(t))                     return { type: "routine",   confidence: "high" };
  if (/^(q:|question:)\s/i.test(t) || /\?$/.test(t))   return { type: "question",  confidence: "high" };
  if (/^(goal:|target:)\s/i.test(t))                    return { type: "goal",      confidence: "high" };
  if (/^(buy:|shop:|shopping:)\s/i.test(t))             return { type: "shopping",  confidence: "high" };
  if (/^(iou:|owe:)\s/i.test(t))                        return { type: "iou",       confidence: "high" };
  if (/^(trip:|travel:|flight:)\s/i.test(t))            return { type: "travel",    confidence: "high" };
  if (/^(errand:)\s/i.test(t))                          return { type: "errand",    confidence: "high" };

  // ── URL detection (unambiguous) ───────────────────────────────────────────
  if (/https?:\/\/|www\./i.test(t))                     return { type: "link",      confidence: "high" };

  // ── CONTENT SAFETY FALLBACKS (used only if Gemma fails) ──────────────────
  // These are clear unambiguous signals. Gemma is still called first for multi-capture.
  if (/owes\s+me|i\s+owe|lent\s+to|borrowed\s+(from|me)/i.test(l))
    return { type: "iou", confidence: "low" };
  if (/follow\s*up|reach\s+out\s+to|catch\s+up\s+with/i.test(l))
    return { type: "followup", confidence: "low" };
  if (/flight|hotel|trip\s+to|travel\s+to|booked\s+(a\s+)?flight/i.test(l))
    return { type: "travel", confidence: "low" };
  if (/remind\s+me\b/i.test(l))
    return { type: "reminder", confidence: "low" };
  if (/every\s+(day|night|morning|week|\d+\s+day)|daily|nightly/i.test(l))
    return { type: "routine", confidence: "low" };

  // ── Default: let Gemma figure it out ──────────────────────────────────────
  return { type: "idea", confidence: "low" };
}

// ── TRON's confirmation message per type ──────────────────────────────────────

export function tronReply(type: ClassifiedType): string {
  const map: Record<ClassifiedType, string> = {
    todo:         "Saved as a todo — I'll keep it in your action list.",
    routine:      "Saved as a routine.",
    reminder:     "Reminder set. I'll nudge you when it's time.",
    idea:         "Captured! Filed as an idea.",
    link:         "Link saved to your reading list.",
    journal:      "Journal entry saved. Private, just for you.",
    gratitude:    "Gratitude noted. This one stays between us.",
    iou:          "IOU logged. I'm keeping track.",
    borrowed:     "Borrowed item noted.",
    shopping:     "Added to your shopping list.",
    stock:        "Stock note saved.",
    question:     "Question saved.",
    people_note:  "People note saved.",
    meeting:      "Meeting note captured.",
    followup:     "Follow-up noted.",
    travel:       "Travel note saved.",
    wishlist:     "Added to your wishlist.",
    personal_link:"Personal link saved.",
    errand:       "Errand noted.",
    vault:        "Locked in your vault.",
    mood:         "Mood logged. Thanks for checking in.",
    health:       "Health note recorded.",
    goal:         "Goal recorded. Let's make it happen.",
    period:       "Cycle note logged.",
  };
  return map[type] ?? "Captured and saved.";
}
