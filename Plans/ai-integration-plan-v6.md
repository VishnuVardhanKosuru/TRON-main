# AI Integration Plan v6 — Lily (Multi-Provider & Phased Roadmap)

---

## The Four AI Surfaces

```
1. STORE      — classify ambiguous captures into the right collection
2. QUERY      — Lily answers questions on demand (chat)
3. BRIEFING   — Lily proactively surfaces insights on the home screen
4. GRAPH      — Synapse auto-builds from entity extraction (Deferred to Final Phase)
```

AI is always the last layer. Deterministic prefix rules run first, always.

---

## Multi-Provider AI Gateway

To guarantee high reliability, minimize latency, and stay within generous free tiers, all AI calls route through a unified **Multi-Provider AI Gateway**. All providers expose OpenAI-compatible wire formats.

```
                  ┌───────────────────────────────┐
                  │          AI Request           │
                  │ (Classifier / Briefing / Chat)│
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                     ┌───────────────────────────┐
                     │   Primary: Google Gemini  │  3.5 / 3.1 Flash Lite
                     │   (1M context, free tier) │  Timeout: 6s
                     └─────────────┬─────────────┘
                                   │ On 429, 5xx, or Timeout
                                   ▼
                     ┌───────────────────────────┐
                     │    Fallback 1: Groq       │  Llama 3.3 70B / 3.1 8B
                     │    (Ultra-fast, 128k ctx) │  Timeout: 6s
                     └─────────────┬─────────────┘
                                   │ On 429, 5xx, or Timeout
                                   ▼
                     ┌───────────────────────────┐
                     │    Fallback 2: OpenAI     │  gpt-4o-mini
                     │    (Reliable safety net)  │  Timeout: 6s
                     └───────────────────────────┘
```

### Supported Provider Endpoints
- **Gemini**: `https://generativelanguage.googleapis.com/v1beta/openai/`
- **Groq**: `https://api.groq.com/openai/v1/`
- **OpenAI**: `https://api.openai.com/v1/`

---

## Configuration Schema

Environment variables configured in `.env.local` / Cloud Functions runtime:

```bash
# Primary & Fallback Strategy
AI_PRIMARY_PROVIDER="gemini"
AI_FALLBACK_PROVIDER="groq"
AI_EMERGENCY_PROVIDER="openai"

# Model Configurations
GEMINI_MODEL="gemini-2.5-flash-lite"
GROQ_MODEL="llama-3.3-70b-versatile"
OPENAI_MODEL="gpt-4o-mini"

# API Keys
GEMINI_API_KEY="your_gemini_api_key"
GROQ_API_KEY="your_groq_api_key"
OPENAI_API_KEY="your_openai_api_key"

# Gateway Tuning
AI_TIMEOUT_MS=6000
AI_MAX_RETRIES=2
```

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
│  Multi-Provider Gateway              │
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
```

---

## Surface 2 — Lily Briefing (Home Screen)

### When It Triggers
- **App open**: If last briefing was > 2 hours ago.
- **Significant save**: Followup, IOU, or goal milestone added.
- **Manual refresh**: Pull or tap to refresh on home.
- **Scheduled times**: 8am, 2pm, 9pm (optional).

### Snapshot Builder & Privacy Boundary
Server builds a structured text digest of non-private collections:
- Overdue & upcoming todos/reminders
- Active goals & progress trajectory
- Unresolved follow-ups, unsettled IOUs, unreturned items
- Recent captures (last 48h)
- Backlog counts & stock alerts

**Strict Privacy**: `journal`, `gratitude`, `vault`, `moods`, `health`, and `periods` are NEVER queried or sent to any LLM.

### Briefing System Prompt
```
You are Lily, the personal assistant inside a second-brain app.

You are given a structured snapshot of the user's active data below.
Your job is to analyze it intelligently and return a briefing the user sees on their home screen.

The UI renders your output as individual cards — one card per insight.
Each card is a plain text string. No markdown, no bold, no emojis, no bullet points, no headers.
Just clean, readable prose — written as if you are speaking directly to the user.

=== ANALYSIS STEPS ===
1. Triage urgency: overdue tasks, pending items > 10 days old.
2. Find cross-collection links: person across followups & IOUs, or blocked goals.
3. Goal trajectory: on-track vs stalled.
4. Filter ruthlessly: deliver 3 to 5 high-impact cards.

=== OUTPUT FORMAT ===
Return valid JSON only.

{
  "cards": [
    {
      "priority": "high" | "medium" | "low",
      "category": "overdue" | "upcoming" | "stale" | "pattern" | "goal" | "connection" | "nudge",
      "text": "<plain text for this card — 1-3 sentences, no formatting>"
    }
  ],
  "generated_at": "<ISO timestamp>"
}
```

---

## Surface 3 — Query Path (Lily Chat Q&A)

### Tool Calling Engine
1. `queryCollection(collection, filters, limit, orderBy?, orderDir?)`
2. `traverseGraph(entities[], depth, collections?)` *(activated after Synapse phase)*

Strict adherence to data: answers only based on returned tool data; never fabricates records.

---

## Surface 4 — Synapse Knowledge Graph (Final Phase)

```
Capture with entities: ["Sarah", "budget"]
    │
    ▼
upsertNode({ label: "Sarah",     type: "person"  })
upsertNode({ label: "budget",    type: "topic"   })
upsertNode({ label: capture.id,  type: "capture", collection: "followup" })
upsertEdge({ from: capture.id, to: "Sarah",  relation: "mentions" })
upsertEdge({ from: capture.id, to: "budget", relation: "topic"    })

Firestore:
  users/{uid}/graph_nodes  — upsert (deduplicated)
  users/{uid}/graph_edges  — upsert
```

---

## Detailed Development Phases

### Phase 1: Tier 1 Prefix Rules & Instant Capture
- **Sub-tasks:**
  - Implement and test prefix rules in `src/lib/classifier.ts`:
    - `!` → Todo
    - `r ` → Reminder
    - `ev ` → Routine
    - `q: ` → Question / Idea
    - `vault: ` → Vault (100% private, bypassed from AI)
  - Connect quick capture UI directly to prefix routing for instant feedback.

### Phase 2: Multi-Provider AI Gateway & Cloud Function
- **Sub-tasks:**
  - Create `src/lib/ai-gateway.ts` (or Functions equivalent) with standardized OpenAI-format requests.
  - Implement failover cascade: Gemini Flash Lite (6s timeout) → Groq Llama 3.3 70B → OpenAI gpt-4o-mini.
  - Implement `classifyCapture` function with JSON schema enforcement.
  - Add client integration in `src/lib/gemini.ts`.

### Phase 3: Home Screen Briefing ("From Lily")
- **Sub-tasks:**
  - Build non-private snapshot aggregator function (`getBriefing`).
  - Implement briefing card generator using the AI Gateway.
  - Cache briefing in Firestore with 2-hour TTL and pull-to-refresh.
  - Connect briefing cards to the newly placed "From Lily" section at the top of the home screen.

### Phase 4: Lily Chat Interface & Query Tools
- **Sub-tasks:**
  - Implement `askLily` with tool-calling definition for `queryCollection`.
  - Build conversational UI in `src/app/chat/page.tsx` with streaming/indicator support.
  - Enforce collection exclusion privacy barriers.

### Phase 5: Calendar Extensions & Overlays
- **Sub-tasks:**
  - Overlay Goal target dates as milestone markers on the calendar.
  - Overlay Follow-up deadlines and Travel trip ranges on the calendar.

### Phase 6: Synapse Knowledge Graph (Final Surface)
- **Sub-tasks:**
  - Create `users/{uid}/graph_nodes` and `users/{uid}/graph_edges` collections in Firestore.
  - Build `graphUtils.ts` (`upsertNode`, `upsertEdge`, `traverseGraph`).
  - Wire entity extraction from `classifyCapture` into automatic graph upserting.
  - Update `src/app/menu/synapse/page.tsx` to render real interactive force-directed graph.
  - Add backfill script for existing captures.
