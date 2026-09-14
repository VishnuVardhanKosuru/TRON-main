# Second Brain — UI Design Document

---

## 1. Design philosophy

**Futuristic, but simple.** Inspired by Linear, Arc, and Raycast rather than sci-fi/neon aesthetics — precision and restraint, not decoration. The "futuristic" feeling comes from typography, spacing, and motion, not visual effects layered on top.

- One dark, near-black background (not pure black — a very dark charcoal reads less harsh on OLED and eyes)
- **One accent color** doing all the work — electric blue or violet — used for the capture bar, active states, links, and progress indicators. Not a rainbow of colors.
- Thin 1px hairline borders instead of heavy drop-shadows — cards are defined by a crisp edge, not a soft shadow
- Bold, slightly oversized headers with tight letter-spacing (geometric sans, e.g. Inter)
- Motion is restrained and purposeful: a subtle glow pulse on the capture bar, a clean strikethrough-and-settle animation on task completion — nothing bouncy or playful
- Two font weights only: regular and medium/bold — no heavy 700+ weights, which read aggressively against a dark UI

---

## 2. Navigation

Bottom nav bar, 5 destinations, capture visually raised above the rest since it's the single most frequent action:

```
Home  ·  Calendar  ·  [ + Capture, raised, accent-filled ]  ·  Synapse  ·  Menu
```

Each destination has a distinct, non-overlapping job:

| Screen | Answers |
|---|---|
| Home | "What do I need to do right now?" |
| Calendar | "What's coming up, and when?" |
| Capture | Always one tap away — never requires navigating anywhere first |
| Synapse | "How do my thoughts connect?" |
| Menu | "Let me browse one category directly." |

---

## 3. Screen: Home

**Purpose:** the single prioritized action list — todos, due reminders, and due routines merged into one urgency-sorted stream. Not segmented into separate boxes by type; one list, ranked by what matters most right now.

**Layout, top to bottom:**
1. Date + "Right now" header
2. Thin progress bar with a fraction label ("3 of 7") — momentum indicator, deliberately understated, not gamified
3. The task stream, ordered:
   - Overdue items first, flagged in red/danger color with an "overdue" label
   - Then due-today items in time order
   - Routines show their current streak inline (e.g. "12 day streak") instead of a separate section
4. Completed items: checkbox fills, text strikes through, row fades to ~55% opacity, settles briefly at the bottom of the list before clearing on next visit — the pause is deliberate, it's the moment of acknowledgment

**Explicitly not on Home:** capture bar (that's the persistent bottom nav button now, not a top field), browsing/library content, anything not immediately actionable today.

---

## 4. Screen: Calendar

**Purpose:** browse due items across days, not just today.

**Layout, top to bottom:**
1. Horizontally scrollable date strip — each date is a pill (weekday letter + day number), the selected date highlighted in the accent color, other dates with items show a small dot indicator
2. "Anytime" bucket, just below the strip — catches overdue items and untimed routines that don't belong pinned to a fake hour
3. Full-screen hourly timeline for the selected day — hour labels down the left edge, task blocks positioned at their actual due time (matches the Google Calendar day-view mental model), color-coded by type using the palette's category colors

**Interaction:** swipe the date strip to move through the week/month; tap a date to reload the timeline below it.

---

## 5. Capture (popup, not a screen)

**Purpose:** the fastest possible path from thought to stored, with visible confirmation of how it was sorted.

**Interaction flow:**
1. Tap the raised center nav button → a bottom sheet slides up, chat-style
2. Type or use the native Android keyboard mic (no custom voice-recording UI needed — this is just a standard text field)
3. Your capture appears as a right-aligned chat bubble, exactly like sending a message
4. A reply bubble confirms the result: "Saved as a routine, daily 9:00 pm" or "Saved as a todo, due today" — makes the sorting visible and trustworthy instead of a silent background write
5. If the rule-based classifier can't confidently place it (no URL, no date, no `!`/`todo:` prefix), the reply can ask one quick question instead of guessing, backed by the free-tier Gemini tag-assist (never used for Journal or Gratitude captures — those bypass this popup's AI path entirely by architecture)

**Sensitive-data guardrail:** if the capture matches a password/API-key/card-number pattern, the reply bubble blocks the save and points to a password manager instead — no override option.

---

## 6. Screen: Synapse (formerly "Library")

**Purpose:** see how your thoughts connect — the actual second-brain part, not a filing cabinet.

**Layout, top to bottom:**
1. **"Resurfaced for you"** card — one proactively surfaced older item: something connected to what you just captured, an entry from this week in a past month, or a `someday`-tagged item that's been sitting untouched. This is active recall, not passive storage — the app hands you something back occasionally instead of only responding to search.
2. **The constellation graph** — every note is a node:
   - Size = how many things connect to it (a person with many linked notes is a large hub)
   - Color = category (people/projects vs. plain notes, using the design system's category-color convention)
   - Lines = `[[link]]` relationships between captures
   - Tap a node to open its detail view; pinch/pan to explore the graph
3. Filter chips **dim** non-matching nodes rather than hiding them, so surrounding context stays visible even while filtering
4. A plain list view remains available as a toggle for quick scanning, but it is not the default landing view

**Note detail view (opened from any node):** full markdown content, a "Linked from" backlinks panel listing every capture that references this one, and the ability to add new `[[links]]` inline.

**Linking mechanic:** typing `[[` in any capture opens an exact-prefix-match autocomplete (no fuzzy matching, by deliberate choice) against existing people/projects/notes, with an option to create a new target if it doesn't exist yet.

---

## 7. Screen: Menu

**Purpose:** the direct, no-frills way to reach any single content type without going through the graph.

**Layout:**
1. A 2-column grid of cards, one per content type (18 total — see the companion content-types document for full definitions): Ideas, Links, Journal, Gratitude, People, Shopping, Stock, Borrowed/IOUs, Questions, Watchlist, Travel, Meeting notes, Personal reference links, plus Todos-archive and Routines-archive for completed history
2. Each card shows an icon, the type name, and a live count (e.g. "14 entries," "1 running low")
3. Tapping a card opens a plain chronological list for that type only — no graph, no chips, just scan-and-tap
4. Below the grid, a separate utility section (visually divided, not styled as content-type cards): **Manage routines**, **Weekly review**, **Settings**

**Type-specific list shapes** (carried over into each type's detail list):

| Type | Shape |
|---|---|
| Journal, Gratitude | Chronological timeline |
| Shopping | Checklist, cleared on purchase |
| Stock | Rows with a running-low indicator instead of a checkbox |
| Borrowed/IOUs | Ledger rows: person, item/amount, direction, settled toggle |
| People | One tile per person, opens into their full backlinked profile |
| Everything else | Standard card feed, newest first |

---

## 8. Interaction & motion summary

- **Capture:** chat-bubble send animation, reply bubble fades in
- **Task completion:** checkbox fill → strikethrough → fade to ~55% opacity → brief settle → clears
- **Capture bar / raised nav button:** subtle glow pulse, the one place glow is used at all
- **Synapse graph:** nodes ease into position on load (force-directed layout settling), tap-to-zoom is a smooth scale transition, filter dimming is a fade, not an instant show/hide
- **General rule:** motion should feel precise and quick, never bouncy, playful, or slow enough to be an obstacle to fast capture

---

## 9. Open items for visual design phase

- Exact accent color: electric blue vs. violet (leaning toward whichever tests better on OLED black for battery/eye comfort)
- Empty states for each Menu category (first-use, zero entries)
- Graph performance ceiling — how many nodes before the constellation needs clustering/pagination
- Note detail/editor screen full mockup (markdown editing surface + inline `[[` autocomplete dropdown) — described above but not yet visualized
