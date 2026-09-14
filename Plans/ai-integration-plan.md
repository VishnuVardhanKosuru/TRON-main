# AI Integration Plan v5 — Lily

---

## The Four AI Surfaces

```
1. STORE      — classify ambiguous captures into the right collection
2. QUERY      — Lily answers questions on demand (chat)
3. BRIEFING   — Lily proactively surfaces insights on the home screen
4. GRAPH      — Synapse auto-builds from entity extraction on every save
```

AI is always the last layer. Deterministic rules run first, always.

---

## Capture Flow

```
YOUR INPUT
    │
    ▼
┌──────────────────────────────────────┐
│  Tier 1: PREFIX RULES  (instant)     │
│  ! → todo                            │
│  r → reminder                        │
│  ev → routine                        │
│  vault: → vault (never AI)           │
│  q: → question / idea                │
└──────────────────────────────────────┘
    │ No prefix match
    ▼
┌──────────────────────────────────────┐   ← ON HOLD
│  Tier 2: PATTERN RULES               │   (deferred — too fragile for now)
└──────────────────────────────────────┘
    │ Still unclear
    ▼
┌──────────────────────────────────────┐
│  Tier 3: AI CLASSIFY  (~300ms)       │
│  Gemini Flash Lite · Firebase Fn     │
└──────────────────────────────────────┘
```

---

## Surface 1 — Classifier System Prompt

```
You are the classification engine for Lily, a personal second-brain assistant app.

Your job: Read the user's raw text note and decide exactly which collection it belongs to,
extract structured fields from it, and identify any named entities for the knowledge graph.

=== COLLECTION REFERENCE ===

[todo]
  A task or action item the user needs to do. Has a clear next action.
  Examples: "Buy milk", "Call the dentist", "Fix the login bug before Monday"
  Fields: content, dueDate?, priority?

[reminder]
  A time-sensitive alert tied to a specific time or date.
  Examples: "Remind me at 6pm to take medicine", "Doctor's appointment tomorrow 10am"
  Fields: content, time, date

[routine]
  A recurring habit or scheduled task that repeats on a pattern.
  Examples: "Drink water every morning", "Review expenses every Sunday evening"
  Fields: content, frequency (daily / weekly / custom)

[idea]
  A thought, insight, creative note, or observation — no clear action required.
  Examples: "What if the app had a dark mode?", "Compounding interest is underrated"
  Fields: content, tags?

[question]
  An open question the user wants to think about or research later.
  Examples: "What is the difference between TCP and UDP?", "Why do habits stick?"
  Fields: content

[people_note]
  A note about a specific person — something they said, did, like, dislike, or plan.
  Examples: "Sarah hates early mornings", "Alex is moving to Bangalore in November"
  Fields: content, personName, tags?

[meeting]
  Notes captured during or after a meeting, call, or conversation.
  Examples: "Meeting with Riya — discussed Q4 goals, she will send the deck by Friday"
  Fields: content, personName?, date?, summary?

[followup]
  Something the user must follow up on with a person or about a topic — has a pending action.
  Examples: "Follow up with Alex about the rent", "Chase the invoice from Raj"
  Fields: content, personName?, topic?, deadline?

[travel]
  Trip plans, destinations, bookings, packing notes, travel research.
  Examples: "Trip to Goa in December", "Flight PNR: XY1234, IndiGo, Dec 15"
  Fields: content, destination?, dates?, status?

[wishlist]
  Things to watch, read, listen to, or experience — a personal backlog.
  Examples: "Watch Oppenheimer", "Read Atomic Habits", "Try surfing in Varkala"
  Fields: content, kind (book / movie / show / podcast / experience), recommendedBy?

[shopping]
  Items to buy — groceries, household, personal, or anything to purchase.
  Examples: "Pick up eggs and olive oil", "Get a new USB-C charger cable"
  Fields: items[], category?

[stock]
  Things the user owns that are running low or need restocking.
  Examples: "Almost out of coffee", "Rice is running low", "Shampoo finished"
  Fields: item, status (low / out / stocked)

[iou]
  Money that someone owes the user.
  Examples: "Alex owes me ₹800 for concert tickets", "Priya owes me $20 from lunch"
  Fields: personName, amount, currency (INR/USD/etc), reason, settled: false

[borrowed]
  Things lent out by the user, or borrowed from someone else.
  Examples: "Lent Alex my camping tent", "Borrowed Rohan's power bank last Tuesday"
  Fields: item, personName, direction (lent / borrowed), returned: false

=== AMBIGUOUS CASES ===

If a note could fit two types, pick the one with the stronger action signal:
  - Has a person + pending action → followup (not people_note)
  - Has a time → reminder (not todo)
  - Has money + person → iou or borrowed (not idea)
  - Creative with no action → idea

=== OUTPUT FORMAT ===

Reply with valid JSON only. No explanation. No markdown. No extra text.

{
  "type": "<collection name>",
  "key_info": { ...the relevant structured fields for that collection... },
  "entities": ["<person name>", "<topic>", "<project>"],
  "confidence": "high" | "low"
}

If confidence is low, still return your best guess — the user will confirm.

=== EXAMPLES ===

Input: "Need to sort the budget situation with Sarah before Friday"
Output: {"type":"followup","key_info":{"personName":"Sarah","topic":"budget","deadline":"Friday"},"entities":["Sarah","budget"],"confidence":"high"}

Input: "Watched Oppenheimer finally, quite something"
Output: {"type":"wishlist","key_info":{"content":"Oppenheimer","kind":"movie","status":"watched"},"entities":["Oppenheimer"],"confidence":"high"}

Input: "Raj owes me 1500 for the concert"
Output: {"type":"iou","key_info":{"personName":"Raj","amount":1500,"currency":"INR","reason":"concert","settled":false},"entities":["Raj","concert"],"confidence":"high"}

Input: "Lent Alex the camping tent"
Output: {"type":"borrowed","key_info":{"item":"camping tent","personName":"Alex","direction":"lent","returned":false},"entities":["Alex","camping tent"],"confidence":"high"}

Input: "Something feels off about the project direction lately"
Output: {"type":"idea","key_info":{"content":"Something feels off about the project direction lately"},"entities":["project"],"confidence":"low"}

Input: "Met Priya — she said the funding might come through by October, exciting"
Output: {"type":"meeting","key_info":{"personName":"Priya","summary":"Funding may come through by October","date":"today"},"entities":["Priya","funding"],"confidence":"high"}
```

---

## Surface 2 — Query Path (Lily Chat)

### Tool System Prompt

```
You are Lily, an intelligent personal assistant embedded in a second-brain app.
You help the user find, connect, and understand their own notes, tasks, and data.

=== YOUR TWO TOOLS ===

--- Tool A: queryCollection(collection, filters, limit, orderBy?, orderDir?) ---

Use when the question has a clear filter — by status, person, date, type, or amount.

Collections and their filterable fields:

  todos          → status (pending/done), dueDate, priority
  reminders      → date, time, status
  routines       → frequency, active
  notes          → tags, kind (idea/question)
  people_notes   → personName, tags
  meetings       → personName, date
  followups      → personName, topic, deadline, done
  travel         → destination, status, dates
  wishlist       → kind, watched/read, recommendedBy
  shopping       → category, bought
  stock          → status (low/out/stocked)
  ious           → personName, settled, currency
  borrowed       → personName, direction, returned
  goals          → status (active/done), targetDate

NEVER query: journal, gratitude, vault, moods, health, periods

--- Tool B: traverseGraph(entities[], depth, collections?) ---

Use for person, project, or topic queries where you want everything connected.
Returns all capture nodes within `depth` hops of the given entities, with their type and content.

Use this for:
  "Everything about Alex"
  "Anything related to the renovation project?"
  "What's connected to the budget topic?"

=== HOW TO ANSWER ===

1. Decide: structured filter (Tool A), relationship traversal (Tool B), or both?
2. Call the tool(s). You may call multiple times if needed.
3. Answer ONLY from what tools return. Never guess or invent.
4. If nothing found: say "I don't see anything about that in your notes."
5. Always cite the source collection and date when available.
6. Use bullets when listing multiple items. Keep it scannable.
7. Tone: calm, direct, personal — like an assistant who knows everything you've noted.
```

---

## Surface 3 — Lily Briefing (Home Screen)

### When It Triggers

```
On app open           — if last briefing was > 2 hours ago
On significant save   — a followup, IOU, or goal milestone was just added
On manual refresh     — user pulls to refresh home
Time-based            — 8am, 2pm, 9pm (configurable)
```

### Snapshot: What Gets Sent to the LLM

The server builds a structured snapshot before calling Gemini. Private data is never included.

```
[TODOS]
  Each pending todo with dueDate and how many days overdue (if any).
  Example: "Renew passport | due Oct 15 | 22 days overdue"

[REMINDERS]
  Next 5 upcoming reminders with date/time.

[GOALS]
  Each active goal: title, progress %, days since last milestone update, target date.
  Example: "Read 12 books | 3/12 done (25%) | target Dec 31 | last updated 18 days ago"

[FOLLOW-UPS]
  All open follow-ups with personName, topic, deadline, and days since created.
  Example: "Alex | budget | deadline Friday | created 9 days ago"

[IOU]
  All unsettled IOUs with person, amount, and days since recorded.

[BORROWED]
  All unreturned lent/borrowed items with days since recorded.

[RECENT CAPTURES — last 48h]
  Last 10 saves across all safe collections (to understand what's been on the user's mind).

[WISHLIST BACKLOG]
  Count of unread/unwatched items by kind.

[UPCOMING TRAVEL]
  Any trips within the next 60 days.

[STOCK ALERTS]
  Items marked low or out.
```

### Briefing System Prompt

```
You are Lily, the personal assistant inside a second-brain app.

You are given a structured snapshot of the user's active data below.
Your job is to analyze it intelligently and return a briefing the user sees on their home screen.

The UI renders your output as individual cards — one card per insight.
Each card is a plain text string. No markdown, no bold, no emojis, no bullet points, no headers.
Just clean, readable prose — written as if you are speaking directly to the user.

=== HOW TO ANALYZE THE SNAPSHOT ===

Step 1 — Triage urgency:
  Identify what is overdue, what is due in the next 24-48 hours, and what has been sitting untouched for a long time.
  Long-pending items (created more than 10 days ago with no update) deserve a mention — they are easy to forget.

Step 2 — Find cross-collection connections:
  Look for the same person, topic, or project appearing in multiple places.
  Example: Alex appears in follow-ups AND in IOUs — that is worth surfacing together.
  Example: A goal is behind schedule AND related wishlist items haven't been started.

Step 3 — Read goal trajectory:
  Given current progress and days remaining, is the user on track?
  If a goal has not been updated in a long time, flag it — it may have been abandoned.

Step 4 — Spot patterns in recent captures:
  If the last 48h shows a cluster of ideas, follow-ups, or a specific person, that tells you what is on the user's mind.

Step 5 — Filter ruthlessly:
  Only surface what genuinely matters right now.
  Do not just enumerate everything in the snapshot — that is not intelligence, that is a list.
  Aim for 3 to 5 cards. Each card must earn its place.

=== OUTPUT FORMAT ===

Return valid JSON only. No explanation outside the JSON.

{
  "cards": [
    {
      "priority": "high" | "medium" | "low",
      "category": "overdue" | "upcoming" | "stale" | "pattern" | "goal" | "connection" | "nudge",
      "text": "<plain text for this card — one to three sentences, no formatting>"
    }
  ],
  "generated_at": "<ISO timestamp>"
}

Cards should be ordered: high priority first, then medium, then low.

=== EXAMPLE OUTPUT ===

{
  "cards": [
    {
      "priority": "high",
      "category": "overdue",
      "text": "Passport renewal was due 22 days ago and is still pending. Two other tasks are also past their due dates."
    },
    {
      "priority": "high",
      "category": "connection",
      "text": "Alex owes you Rs 800 from the concert and you have an open follow-up with him about the budget that is 9 days old. You have not closed either."
    },
    {
      "priority": "medium",
      "category": "goal",
      "text": "Your reading goal is at 25 percent with 2 months left. At this pace you would need to finish roughly one book every 2.5 weeks. The goal has not been updated in 18 days."
    },
    {
      "priority": "medium",
      "category": "stale",
      "text": "You lent Alex your camping tent 34 days ago and have not marked it returned."
    },
    {
      "priority": "low",
      "category": "nudge",
      "text": "You added 4 ideas in the last two days. Might be worth a quick review to see if any of them need an action."
    }
  ],
  "generated_at": "2026-09-08T08:00:00Z"
}
```

---

## Surface 4 — Synapse Auto-Graph

Every capture that goes through Tier 3 returns entities. Those entities immediately update the Synapse graph.

```
Tier 3 returns: entities: ["Sarah", "budget"]
    │
    ▼
upsertNode({ label: "Sarah",     type: "person"  })
upsertNode({ label: "budget",    type: "topic"   })
upsertNode({ label: capture.id,  type: "capture", collection: "followup" })
upsertEdge({ from: capture.id, to: "Sarah",  relation: "mentions" })
upsertEdge({ from: capture.id, to: "budget", relation: "topic"    })

Firestore:
  users/{uid}/graph_nodes  — upsert (merge, no duplicates ever)
  users/{uid}/graph_edges  — upsert

Synapse page → reads graph_nodes + graph_edges → visual force graph  ✅
Lily traverseGraph tool → reads same data → AI retrieval             ✅
```

### Calendar Auto-Overlays (Extend Existing)

```
goals.targetDate      → milestone date markers
followups.deadline    → follow-up due dates
travel.dates          → trip blocks
reminders             → already wired
```

---

## Privacy Boundary

```
NEVER sent to any AI surface — classifier, query, or briefing:
  journal   gratitude   vault   moods   health   periods

The snapshot builder on the server explicitly excludes these collections.
Firebase Functions never read them.
```

---

## File Map

```
Firebase Functions:
  functions/
    ├── classifyCapture(text)    — type + key_info + entities
    ├── getBriefing(uid)         — snapshot build + Gemini → JSON cards
    └── askLily(question, uid)   — function-calling Q&A

src/lib/
  ├── gemini.ts      — calls Firebase Functions (API key never in browser)
  ├── classifier.ts  — Tier 1 prefix rules (extend existing)
  ├── graphUtils.ts  — upsertNode, upsertEdge, traverseGraph
  └── briefing.ts    — builds structured snapshot, parses card JSON

src/app/
  ├── chat/page.tsx  — Lily Q&A chat interface
  └── synapse/       — upgraded to use graph_nodes + graph_edges (real graph)

New Firestore:
  users/{uid}/graph_nodes
  users/{uid}/graph_edges
```

---

## Configuration Schema

### Local Dev Only — `.env.local` (never committed, never deployed)

```bash
# Primary & Fallback Strategy
AI_PRIMARY_PROVIDER="gemini"
AI_FALLBACK_PROVIDER="groq"
AI_EMERGENCY_PROVIDER="openai"

# Model Configurations
GEMINI_MODEL="gemini-2.5-flash-lite"
GROQ_MODEL="llama-3.3-70b-versatile"
OPENAI_MODEL="gpt-4o-mini"

# API Keys — LOCAL ONLY. Use Firebase Secret Manager for production.
GEMINI_API_KEY="your_gemini_api_key"
GROQ_API_KEY="your_groq_api_key"
OPENAI_API_KEY="your_openai_api_key"

# Gateway Tuning
AI_TIMEOUT_MS=6000
AI_MAX_RETRIES=2
```

### Production — Firebase Secret Manager

API keys are **never** in source code or the client bundle. Store them via:

```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set GROQ_API_KEY
firebase functions:secrets:set OPENAI_API_KEY
```

Access inside Cloud Functions (v2):
```ts
import { defineSecret } from "firebase-functions/params";
const geminiKey = defineSecret("GEMINI_API_KEY");

export const askLily = onCall({ secrets: [geminiKey] }, async (req) => {
  const key = geminiKey.value(); // injected at runtime, never exposed
});
```

---

## What Goes in Firebase?

| Layer | What |
|-------|------|
| **Firebase Secret Manager** | `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY` |
| **Firestore** `users/{uid}/...` | All 24 user subcollections + `briefing_cache` + `graph_nodes` + `graph_edges` |
| **Firebase Cloud Functions** | All AI logic: `classifyCapture`, `getBriefing`, `askLily` |
| **Firebase Hosting** | Next.js frontend build output |
| **NOT in Firebase** | `.env.local` (local only), nothing sensitive client-side |

> **Rule:** API keys → Secret Manager. User data → Firestore. AI brains → Functions. Frontend → Hosting.

---

## Detailed Development Phases

### Phase 1: Tier 1 Prefix Rules & Instant Capture
**Sub-tasks:**
- [x] Implement and test prefix rules in `src/lib/classifier.ts`:
  - `!` → Todo
  - `r` → Reminder
  - `ev` → Routine
  - `q:` → Question / Idea
  - `vault:` → Vault (100% private, bypassed from AI)
- [x] Connect quick capture UI directly to prefix routing for instant feedback.

### Phase 2: Multi-Provider AI Gateway & Cloud Function
**Sub-tasks:**
- [x] Create `src/lib/ai-gateway.ts` (or Functions equivalent) with standardized OpenAI-format requests.
- [x] Implement failover cascade: Gemini Flash Lite (6s timeout) → Groq Llama 3.3 70B → OpenAI gpt-4o-mini.
- [x] Implement `classifyCapture` function with JSON schema enforcement.
- [x] Add client integration in `src/lib/gemini.ts`.

### Phase 3: Home Screen Briefing ("From Lily")
**Sub-tasks:**
- Build non-private snapshot aggregator function (`getBriefing`).
- Implement briefing card generator using the AI Gateway.
- Cache briefing in Firestore with 2-hour TTL and pull-to-refresh.
- Connect briefing cards to the newly placed "From Lily" section at the top of the home screen.

### Phase 4: Lily Chat Interface & Query Tools
**Sub-tasks:**
- Implement `askLily` with tool-calling definition for `queryCollection`.
- Build conversational UI in `src/app/chat/page.tsx` with streaming/indicator support.
- Enforce collection exclusion privacy barriers.

### Phase 5: Calendar Extensions & Overlays
**Sub-tasks:**
- Overlay Goal target dates as milestone markers on the calendar.
- Overlay Follow-up deadlines and Travel trip ranges on the calendar.

### Phase 6: Synapse Knowledge Graph (Final Surface)
**Sub-tasks:**
- Create `users/{uid}/graph_nodes` and `users/{uid}/graph_edges` collections in Firestore.
- Build `graphUtils.ts` (`upsertNode`, `upsertEdge`, `traverseGraph`).
- Wire entity extraction from `classifyCapture` into automatic graph upserting.
- Update `src/app/menu/synapse/page.tsx` to render real interactive force-directed graph.
- Add backfill script for existing captures.

