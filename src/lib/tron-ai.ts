import { askGateway, extractJson, type ChatMessage } from "./ai-gateway";

/**
 * TRON — capture classification and briefing, running entirely on the Redmi.
 *
 * The prompts here are deliberately tighter than the cloud-model versions they
 * replace: Qwen3-1.7B follows a short, explicit spec far better than a long one,
 * and every token saved is real time on a phone CPU.
 */

export interface SingleCapture {
  type: string;
  key_info: Record<string, unknown>;
  confidence: "high" | "low";
}

export interface AICaptureResult {
  captures: SingleCapture[];
  entities: string[];
}

// ── Classifier ────────────────────────────────────────────────────────────────

const CLASSIFIER_SYSTEM_PROMPT = `You classify short personal notes into structured JSON. Reply with JSON only. No prose.

TYPES:
todo, reminder, routine, idea, question, shopping, stock, iou, borrowed,
people_note, meeting, followup, travel, wishlist, errand, goal, mood, health,
journal, gratitude, link, personal_link, vault, period

KEY_INFO PER TYPE:
todo      { content, dueDate (YYYY-MM-DD|null), priority (low|normal|high) }
reminder  { content, date (YYYY-MM-DD|null), time (HH:MM|null) }
routine   { content, frequency (daily|every_N_days|weekly), intervalDays (number|null), time (HH:MM|null) }
shopping  { name, quantity|null }
stock     { name, level (low|out) }
iou       { personName, amount (number|null), currency (INR|USD|null), direction (owed_to_me|i_owe) }
borrowed  { personName, item }
people_note { personName, content }
meeting   { personName, content, date (YYYY-MM-DD|null) }
followup  { personName, reason|null, deadline (YYYY-MM-DD|null) }
travel    { destination, startDate|null, endDate|null, status (idea|planning|booked|done) }
wishlist  { title, kind (book|movie|show|podcast|other) }
goal      { title, targetDate|null }
everything else { content }

RULES:
1. One note may produce several captures. Return all of them.
2. Always extract the person's name when one appears. Never null if a name is present.
3. Extract amounts as numbers: "500 rupees" -> amount 500, currency "INR".
4. content is the key fact, not the whole sentence.
   "met Rahul today, he's looking for a co-founder" -> content: "Looking for a co-founder"
5. destination and title are the bare name, not the sentence.
6. Resolve relative dates (tomorrow, next week) against CURRENT DATE.
7. entities lists people, places, projects and titles mentioned.

OUTPUT SHAPE:
{"captures":[{"type":"...","key_info":{...},"confidence":"high"}],"entities":["..."]}

EXAMPLES:

"lent my copy of Atomic Habits to Vikram"
{"captures":[{"type":"borrowed","key_info":{"personName":"Vikram","item":"Atomic Habits"},"confidence":"high"}],"entities":["Vikram","Atomic Habits"]}

"Alex owes me 500 rupees"
{"captures":[{"type":"iou","key_info":{"personName":"Alex","amount":500,"currency":"INR","direction":"owed_to_me"},"confidence":"high"}],"entities":["Alex"]}

"call mom tomorrow at 5pm"
{"captures":[{"type":"reminder","key_info":{"content":"Call mom","date":null,"time":"17:00"},"confidence":"high"}],"entities":["mom"]}

"buy milk and eggs"
{"captures":[{"type":"shopping","key_info":{"name":"milk","quantity":null},"confidence":"high"},{"type":"shopping","key_info":{"name":"eggs","quantity":null},"confidence":"high"}],"entities":[]}

"soak eggs tonight and every two days"
{"captures":[{"type":"reminder","key_info":{"content":"Soak eggs","date":null,"time":null},"confidence":"high"},{"type":"routine","key_info":{"content":"Soak eggs","frequency":"every_N_days","intervalDays":2,"time":null},"confidence":"high"}],"entities":[]}`;

export async function classifyWithAI(text: string): Promise<AICaptureResult> {
  const currentDate = new Date().toISOString().split("T")[0];

  const messages: ChatMessage[] = [
    { role: "system", content: `CURRENT DATE: ${currentDate}\n\n${CLASSIFIER_SYSTEM_PROMPT}` },
    { role: "user", content: `Classify:\n"${text}"` },
  ];

  const reply = await askGateway(messages, {
    temperature: 0.1,
    jsonMode: true,
    maxTokens: 600,
  });

  const raw = reply.content ?? "";
  const json = extractJson(raw);
  if (!json) {
    throw new Error(`Model returned no JSON: ${raw.slice(0, 160)}`);
  }

  const parsed = JSON.parse(json) as Partial<AICaptureResult>;

  if (!parsed.captures || parsed.captures.length === 0) {
    return {
      captures: [{ type: "idea", key_info: { content: text }, confidence: "low" }],
      entities: [],
    };
  }

  return {
    captures: parsed.captures,
    entities: Array.isArray(parsed.entities) ? parsed.entities : [],
  };
}

// ── Briefing ──────────────────────────────────────────────────────────────────

const BRIEFING_SYSTEM_PROMPT = `You are TRON, a calm and sharp personal assistant.
Write a 1-3 sentence briefing from the user's current state.

Rules:
- Surface only the one or two things that matter most. Do not list everything.
- Lead with anything overdue.
- Warm, direct, no filler. Max 45 words. No emojis.
- Reply with JSON only: {"briefing_text":"..."}`;

export async function generateBriefing(snapshotText: string): Promise<string> {
  try {
    const reply = await askGateway(
      [
        { role: "system", content: BRIEFING_SYSTEM_PROMPT },
        { role: "user", content: snapshotText },
      ],
      { temperature: 0.4, jsonMode: true, maxTokens: 200 }
    );

    const json = extractJson(reply.content ?? "");
    if (json) {
      const parsed = JSON.parse(json) as { briefing_text?: string };
      if (parsed.briefing_text) return parsed.briefing_text;
    }

    // Model answered in plain prose — that's still a usable briefing.
    const plain = (reply.content ?? "").trim();
    if (plain && plain.length < 400) return plain;
  } catch (error) {
    console.error("[TRON] Briefing failed:", error);
  }

  return "All clear. Your mind is free to explore.";
}
