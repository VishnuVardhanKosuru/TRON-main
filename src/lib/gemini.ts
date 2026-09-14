import { askGateway, ChatMessage } from "./ai-gateway";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SingleCapture {
  type: string;
  key_info: Record<string, any>;
  confidence: "high" | "low";
}

export interface AICaptureResult {
  captures: SingleCapture[];
  entities: string[]; // People, projects, places mentioned — for the knowledge graph
}

// ── Classifier System Prompt ──────────────────────────────────────────────────

const CLASSIFIER_SYSTEM_PROMPT = `You are a personal second-brain classifier. 
Your job is to analyze what the user wants to capture and return structured JSON.

CRITICAL RULES:
1. A single input can map to MULTIPLE capture types if it contains compound information.
2. Always extract structured fields into key_info — do NOT just copy the raw text.
3. Match the confidence to how certain you are about each capture type.

AVAILABLE TYPES:
- todo: A one-time task or action item to complete
- reminder: A one-time alert at a specific time or date
- routine: A recurring habit (every day, every N days, weekly, etc.)
- idea: A fleeting thought, insight, or concept
- question: Something the user wants to research or find out
- shopping: An item to buy (groceries, products, etc.)
- stock: A supply/pantry item that's running low
- iou: Money owed between people
- borrowed: Physical item borrowed from/to someone
- people_note: A note about a specific person (preference, fact, birthday, etc.)
- meeting: Notes from a meeting or call that already happened
- followup: A reminder to reach out to someone
- travel: A trip, flight, hotel, or destination note
- wishlist: A book, movie, show, podcast, or product to consume later
- errand: A location-based task
- goal: A longer-term personal ambition or target
- mood: How the user is feeling right now
- health: A symptom, medication, or health note
- journal: A personal reflection or diary entry
- gratitude: Something the user is grateful for
- link: A URL to read later
- personal_link: A personally meaningful URL/resource
- vault: A password, PIN, or secret
- period: A menstrual cycle or reproductive health note

KEY_INFO FIELD GUIDE (extract these when present):
- todo:      { content, dueDate (YYYY-MM-DD or null), priority (low/normal/high) }
- reminder:  { content, date (YYYY-MM-DD or null), time (HH:MM or null) }
- routine:   { content, frequency (daily/every_N_days/weekly), intervalDays (number or null), time (HH:MM or null) }
- shopping:  { name, quantity (or null) }
- stock:     { name, level (low/out) }
- iou:       { personName, amount (number or null), currency (INR/USD or null), direction (owed_to_me/i_owe) }
- borrowed:  { personName, item }
- people_note: { personName, content }
- meeting:   { personName, content, date (YYYY-MM-DD or null) }
- followup:  { personName, reason (or null), deadline (YYYY-MM-DD or null) }
- travel:    { destination, startDate (YYYY-MM-DD or null), endDate (YYYY-MM-DD or null), status (idea/planning/booked/done) }
- wishlist:  { title, kind (book/movie/show/podcast/other) }
- goal:      { title, targetDate (YYYY-MM-DD or null) }
- idea/question/journal/gratitude/mood/health/vault/period: { content }

CRITICAL EXTRACTION RULES — APPLY TO EVERY RESPONSE:
1. PERSON NAME: For meeting, people_note, followup, iou, borrowed — ALWAYS extract the name from the text.
   "met Rahul" → personName: "Rahul". "lent to Vikram" → personName: "Vikram". "Alex owes me" → personName: "Alex".
   Never return personName: null if a name exists in the text. Use "Unknown" ONLY as absolute last resort.

2. ITEM / OBJECT: For borrowed — ALWAYS extract what was lent/borrowed.
   "lent my copy of Atomic Habits to Vikram" → item: "Atomic Habits". Never return item: null if it exists.

3. AMOUNT / CURRENCY: For iou — extract the number as a numeric value and the currency code.
   "500 rupees" → amount: 500, currency: "INR". "$20" → amount: 20, currency: "USD".

4. CONTENT = KEY FACT, NOT FULL SENTENCE: For meeting, people_note, followup — extract the meaningful fact only.
   BAD:  content: "met Rahul today, he's looking for a co-founder"
   GOOD: content: "Looking for a co-founder"

5. DESTINATION: For travel — extract the place name only, not the full sentence.
   "flight to Japan booked" → destination: "Japan" (not the full sentence)

6. TITLE: For wishlist — extract the exact title of the book/movie/show.
   "watch Dune 2 with Sarah" → title: "Dune 2", kind: "movie"

7. SCHEDULE: For routine — extract intervalDays as a number.
   "every two days" → frequency: "every_N_days", intervalDays: 2
   "daily" → frequency: "daily", intervalDays: null

8. PERSON DETECTION: If a person's name appears, also create a people_note UNLESS context is financial (iou/borrowed covers it).

9. DATES: Resolve relative dates (tomorrow, next week, Oct first weekend) to YYYY-MM-DD if possible based on current date.

FEW-SHOT EXAMPLES:

Input: "lent my copy of Atomic Habits to Vikram"
Output:
{
  "captures": [
    { "type": "borrowed", "key_info": { "personName": "Vikram", "item": "Atomic Habits" }, "confidence": "high" }
  ],
  "entities": ["Vikram", "Atomic Habits"]
}

Input: "Alex owes me 500 rupees, need to follow up with him on Friday"
Output:
{
  "captures": [
    { "type": "iou",     "key_info": { "personName": "Alex", "amount": 500, "currency": "INR", "direction": "owed_to_me" }, "confidence": "high" },
    { "type": "followup","key_info": { "personName": "Alex", "reason": "collect money owed", "deadline": "2026-09-11" }, "confidence": "high" }
  ],
  "entities": ["Alex"]
}

Input: "met Rahul today, he's looking for a co-founder"
Output:
{
  "captures": [
    { "type": "meeting",     "key_info": { "personName": "Rahul", "content": "Looking for a co-founder", "date": "2026-09-10" }, "confidence": "high" },
    { "type": "people_note", "key_info": { "personName": "Rahul", "content": "Looking for a co-founder" }, "confidence": "high" }
  ],
  "entities": ["Rahul"]
}

Input: "Flight to Japan booked next month 10th to 20th"
Output:
{
  "captures": [
    { "type": "travel", "key_info": { "destination": "Japan", "startDate": "2026-10-10", "endDate": "2026-10-20", "status": "booked" }, "confidence": "high" }
  ],
  "entities": ["Japan"]
}

Input: "soak eggs tonight and every two days"
Output:
{
  "captures": [
    { "type": "reminder", "key_info": { "content": "Soak eggs", "date": "2026-09-10", "time": null }, "confidence": "high" },
    { "type": "routine",  "key_info": { "content": "Soak eggs", "frequency": "every_N_days", "intervalDays": 2, "time": null }, "confidence": "high" }
  ],
  "entities": []
}

Input: "Watch Oppenheimer with Sarah this weekend"
Output:
{
  "captures": [
    { "type": "wishlist",    "key_info": { "title": "Oppenheimer", "kind": "movie" }, "confidence": "high" },
    { "type": "people_note", "key_info": { "personName": "Sarah", "content": "Wants to watch Oppenheimer together" }, "confidence": "high" }
  ],
  "entities": ["Sarah", "Oppenheimer"]
}

Input: "watch Dune 2 with Sarah this weekend"
Output:
{
  "captures": [
    { "type": "wishlist",    "key_info": { "title": "Dune 2", "kind": "movie" }, "confidence": "high" },
    { "type": "people_note", "key_info": { "personName": "Sarah", "content": "Wants to watch Dune 2 together this weekend" }, "confidence": "high" }
  ],
  "entities": ["Sarah", "Dune 2"]
}

Input: "call mom tomorrow at 5pm"
Output:
{
  "captures": [
    { "type": "reminder", "key_info": { "content": "Call mom", "date": "2026-09-11", "time": "17:00" }, "confidence": "high" }
  ],
  "entities": ["mom"]
}

Input: "buy milk and eggs"
Output:
{
  "captures": [
    { "type": "shopping", "key_info": { "name": "milk", "quantity": null }, "confidence": "high" },
    { "type": "shopping", "key_info": { "name": "eggs", "quantity": null }, "confidence": "high" }
  ],
  "entities": []
}

Input: "need to follow up with the insurance company next week"
Output:
{
  "captures": [
    { "type": "followup", "key_info": { "personName": "Insurance company", "reason": "pending matter", "deadline": "2026-09-17" }, "confidence": "high" }
  ],
  "entities": []
}

Input: "feeling anxious about the presentation tomorrow"
Output:
{
  "captures": [
    { "type": "mood", "key_info": { "content": "Feeling anxious about the presentation" }, "confidence": "high" }
  ],
  "entities": []
}`;

// NOTE: We do NOT use responseSchema for classification.
// A schema with "key_info: { type: 'object' }" (no inner properties) makes Gemma
// return an empty key_info: {}. Without the schema Gemma follows the few-shot
// prompt freely and populates personName, amount, currency, etc. correctly.
// We keep responseMimeType: "application/json" via the jsonMode flag to still
// enforce valid JSON output.

// ── Main Classifier ───────────────────────────────────────────────────────────

export async function classifyWithAI(text: string): Promise<AICaptureResult> {
  const currentDate = new Date().toLocaleDateString("en-US", { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  
  const messages: ChatMessage[] = [
    { 
      role: "system", 
      content: `CURRENT DATE: ${currentDate}\n\n${CLASSIFIER_SYSTEM_PROMPT}` 
    },
    { role: "user", content: `Classify this capture:\n"${text}"` }
  ];

  try {
    const responseMsg = await askGateway(messages, {
      temperature: 0.1,
      useNativeGemini: true,
      jsonMode: true
    });

    let raw = responseMsg.content ?? "{}";
    
    // Strip markdown formatting if the model wraps it in ```json ... ```
    if (raw.includes("```json")) {
      raw = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    }

    // Safety: if the raw string is not pure JSON (thinking leaked in),
    // extract the first {...} JSON object from it
    let parsed: AICaptureResult;
    try {
      parsed = JSON.parse(raw) as AICaptureResult;
    } catch {
      // Try extracting the JSON object from raw text (handles thinking + JSON concat)
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error(`No JSON found in response: ${raw.slice(0, 200)}`);
      parsed = JSON.parse(match[0]) as AICaptureResult;
    }

    if (!parsed.captures || parsed.captures.length === 0) {
      return {
        captures: [{ type: "idea", key_info: { content: text }, confidence: "low" }],
        entities: []
      };
    }

    return {
      captures: parsed.captures,
      entities: parsed.entities || []
    };
  } catch (error) {
    console.error("AI Classification Error:", error);
    throw error; // Re-throw so /api/classify returns 500 and handleStore uses offline fallback
  }
}

// ── BRIEFING ─────────────────────────────────────────────────────────────────

const BRIEFING_SYSTEM_PROMPT = `You are Lily, a calm and sharp personal assistant.
Generate a 1-3 sentence morning briefing for the user's home screen based on their current state.

Rules:
- Pick only the 1-2 most important things to surface. Do not list everything.
- If anything is overdue, lead with that.
- If stock is low, mention adding to shopping list.
- Tone: warm, direct, encouraging. Like a smart friend who knows your life.
- Max 45 words. No emojis. Plain text only.`;

const BRIEFING_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    briefing_text: { type: "string" }
  },
  required: ["briefing_text"]
};

export async function generateBriefing(snapshotText: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: BRIEFING_SYSTEM_PROMPT },
    { role: "user", content: snapshotText }
  ];

  try {
    const responseMsg = await askGateway(messages, {
      temperature: 0.4,
      useNativeGemini: true,
      responseSchema: BRIEFING_RESPONSE_SCHEMA
    });

    const parsed = JSON.parse(responseMsg.content ?? "{}");
    return parsed.briefing_text || "All clear. Your mind is free to explore.";
  } catch (error) {
    console.error("Briefing Generation Error:", error);
    return "All clear. Your mind is free to explore.";
  }
}
