# Second Brain — Content Types & Architecture

---

## Part 1: The Architecture (locked in)

```
PWA (hosted on Vercel, free)
   │  — capture bar (persistent, always visible)
   │  — native Android keyboard mic for voice (no custom voice code needed)
   │  — client-side encryption before anything is sent out
   ▼
Firebase (Spark / free plan)
   │  — Firestore: stores encrypted content + unencrypted metadata (tags, dates, type)
   │  — Auth: login
   │  — Cloud Functions: rule-based classifier (URL/date/prefix detection), sensitive-data guardrail
   │  — Cloud Messaging (FCM): push notifications for todos/reminders/routines
   ▼
Free Gemini API key
   — used ONLY as a tag-assist layer for ambiguous general captures
   — NEVER used for Journal or Gratitude Log entries — those bypass AI entirely,
     by architecture (no code path connects them to Gemini), not by a runtime check
```

**Why this combination:**
- **Vercel** — free, reliable hosting for the PWA frontend, no cold-start sleep issue.
- **Firebase over Supabase** — no 7-day inactivity pause (a real problem Supabase has on its free tier); daily quotas (50k reads/20k writes per day) are far beyond one person's usage; Firebase Cloud Messaging gives more reliable push than plain web push, especially on iOS.
- **Free Gemini key, scoped carefully** — free-tier Gemini API usage can be reviewed by humans and used to improve Google's models, so it's restricted to non-identifying, non-sensitive captures only (see routing rule below). If this ever needs to expand to sensitive content, the fix is switching to a paid key, not loosening the rule.
- **Client-side encryption** — Firebase (or any host) only ever sees ciphertext for note content. Metadata needed for filtering (type, tags, dates) stays unencrypted so the app can query efficiently.

**AI routing rule:** Journal and Gratitude Log have their own dedicated entry points in the app that go straight to the rule-based path and storage — Gemini is architecturally unreachable from those two flows. Every other capture type may pass through Gemini (free tier) only as a fallback tagging step, after the deterministic rules (URL/date/prefix) have already run.

---

## Part 2: The 18 Content Types

### Action-oriented

**1. Todos**
One-off action items. Classified strictly by prefix (`!` or `todo:`) — no phrase-guessing, by deliberate choice, to avoid false positives. Marked done, then auto-archived after a grace period.

**2. Reminders**
Time-bound items — detected when a capture contains a resolvable date/time expression. Surfaced in an upcoming view and pushed via notification (and optionally synced to Google Tasks/Calendar for more reliable native alerts).

**3. Routines**
Recurring tasks you keep forgetting — the original pain point (timesheet, soaking dry fruits). Structurally different from a todo: it doesn't get "done" once, it resets on a schedule (daily / specific weekdays / interval). Created through a dedicated form (not guessed from free text, same reasoning as todos). Tracks a completion log, current streak, and longest streak.

**4. Location-tied errands**
Triggered by place, not time — "when I'm at the pharmacy, also get X." Different mechanism from a scheduled reminder; needs geofencing rather than a clock.

### Money & things

**5. Shopping list**
A running list of things to buy, checked off in bulk as you shop. Different lifecycle from a todo — items get added continuously and cleared in batches, not completed one at a time on a schedule.

**6. Stock tracking**
Explicitly different from the shopping list, even though it sounds similar. This is for things you already own and use up over time (bodywash, shampoo) — the mechanic is "I have some, flag it when it's running low," which needs a quantity/threshold concept, not a simple checkbox.

**7. Things borrowed or lent out**
Who has your stuff, or whose stuff you have. Ledger-style entry: item, person, direction (lent/borrowed), date.

**8. IOUs**
Money owed or owed to you. Same ledger shape as borrowed items — person, amount, direction, settled/unsettled toggle.

### Thoughts & knowledge

**9. Fleeting ideas/thoughts**
The original core use case — a random idea with no immediate action, just needs to not be lost. Falls to `note` with an `idea` tag when nothing else matches.

**10. Reading list (links/articles)**
Anything with a URL is auto-detected and tagged `link` — no manual tagging needed, this one's fully automatic.

**11. Questions to look up later**
Curiosity that hits at an inconvenient time — "what's the difference between X and Y" — captured now, researched later. Tagged `question`.

**12. Journal/reflections**
Structurally distinct from every other type: not triaged, not reviewed weekly, just a timestamped record. Has its own dedicated entry point that bypasses Inbox entirely and lands straight in a chronological timeline. Never sent to AI.

**13. Gratitude log**
Same treatment as Journal — its own entry point, its own timeline, bypasses Inbox, never touches AI. Kept separate from Journal because it's a different habit/ritual even though the mechanics are identical.

### People

**14. People notes**
Gift ideas, birthdays, things someone mentioned — grouped by person in the Library so you can pull up "everything about Mom" in one place rather than scattered across dated entries.

**15. Meeting/work notes**
Context from a call or conversation you'll need later. Tagged `meeting`.

**16. People to follow up with / stay in touch**
"Haven't talked to X in a while" — a nudge-style entry, distinct from a todo because it's ongoing/recurring in spirit rather than a single action, but doesn't need the full Routine machinery.

### Life admin & leisure

**17. Travel plans**
Trip ideas, packing notes, itinerary fragments — captured as they occur to you, not necessarily structured until you're actually planning.

**18. Watch/read/listen wishlist**
Movies, books, podcasts someone recommended. Tagged `someday` — a queue you browse, not something with a due date or action attached.

**Bonus — Personal reference links**
Not sensitive, just tired of re-googling: your own GitHub, LinkedIn, portfolio, frequently used sites. Mechanically identical to the reading list (URL-detected), kept conceptually separate since it's reference material about *you*, not content you're consuming.

---

## Explicitly excluded

**Passwords/credentials** — deliberately kept out. The sensitive-data guardrail hard-blocks anything that looks like a password, API key, or card number before it's ever saved, with no override. Redirected to a dedicated password manager (Bitwarden recommended) instead, since that's a better-suited, security-audited tool for that specific problem.

**Goal/habit tracking** (beyond Routines) — deferred to a future phase. A goal like "run 3x/week" is a different kind of object (ongoing state, not a discrete capture) and was intentionally kept out of v1 to avoid scope creep.
