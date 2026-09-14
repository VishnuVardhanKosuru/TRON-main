# TRON

A private personal AI that runs entirely on your own hardware.

No Firebase. No Supabase. No Gemini. No cloud account of any kind. TRON is a
Next.js app, a SQLite file, and a local llama.cpp server — all on one Redmi
Note 9 Pro Max sitting on a shelf. Your phone and laptop are just screens.

```
        iPhone / Mac / browser
                 │
          secure connection
                 │
                 ▼
          ┌──────────────┐
          │    REDMI     │
          │              │
          │  TRON UI     │
          │      ↓       │
          │  SQLite      │
          │      ↓       │
          │  llama.cpp   │
          │      ↓       │
          │  Qwen3-1.7B  │
          └──────────────┘
```

---

## What V1 does

- **Capture** — one input box. TRON classifies what you typed into todos,
  reminders, routines, shopping, people notes, travel, goals and the rest.
- **25+ screens** — the full existing interface, preserved and re-themed.
- **Ask TRON** — conversational access to your own data, with tool calls.
- **Explicit memory** — TRON remembers only what you tell it to.
- **Everything local** — one SQLite file you can copy, back up, or delete.

Deliberately **not** in V1: web search, weather, news, voice, autonomous agents,
RAG, multi-user accounts. Those are V2 and V3.

---

## Requirements

| | |
|---|---|
| Node | 22.14 or newer (ships the built-in `node:sqlite`) |
| llama.cpp | a working `llama-server` |
| Model | `Qwen3-1.7B-Q4_K_M.gguf` |

If you are on older Node, `npm install better-sqlite3` and TRON will use that
instead — the driver is chosen automatically at startup.

---

## Setup

```bash
git clone <your-repo-url> tron
cd tron
npm install

cp .env.example .env.local
# Edit .env.local — TRON_PASSPHRASE is required and TRON will not start without it.

npm run build
npm run tron -- start
```

Open `http://localhost:3000`, enter your passphrase, and you're in.

### On the Redmi (Termux)

```bash
pkg install nodejs-lts git
git clone <your-repo-url> tron
cd tron
bash scripts/install-termux.sh
```

That script installs dependencies, builds, installs the `tron` command, and
writes a Termux:Boot script so TRON comes up on its own when the phone powers
on. Afterwards you also need to:

1. Install **Termux:Boot** from F-Droid
2. Open it once so Android grants the permission
3. Turn **off** battery optimisation for Termux and Termux:Boot

---

## Running it

```
tron start      start the model and the app
tron stop       stop everything
tron restart    restart everything
tron status     what's running, and is it healthy
tron logs       tail the app log   (tron logs llama for the model)
```

From the project directory without installing the command:
`npm run tron -- status`.

`tron start` will launch `llama-server` for you if you set
`TRON_LLAMA_MODEL_PATH`. If you prefer to keep your existing llama-server setup
exactly as it is, set `TRON_MANAGE_LLAMA=false` and TRON will simply connect to
whatever is already listening on `TRON_LLM_URL`.

---

## Memory

Memory in V1 is explicit. TRON never decides on its own what to keep — it stores
something only when you say so, in those words:

```
TRON, remember the spare key is under the blue pot
TRON, what do you remember about the spare key?
TRON, forget the spare key
TRON, what do you remember?
```

These are parsed by rule, not by the model, so they behave identically every
time. Anything TRON has been told is offered back to the model as context when
you ask a related question — retrieval is automatic, *storing* never is.

Automatic memory is a V2 feature.

---

## Reaching TRON from your other devices

**On your home network** — nothing to do. Open
`http://<redmi-lan-ip>:3000` from your iPhone or Mac. Add the Redmi's address to
`TRON_ALLOWED_ORIGINS` in `.env.local` first, or server actions will be refused:

```
TRON_ALLOWED_ORIGINS=http://192.168.1.42:3000
```

**From outside your home** — do *not* port-forward 3000 to the internet. Use a
private overlay network instead. Tailscale is the least painful option:

1. Install Tailscale on the Redmi and on your iPhone
2. Both join the same tailnet
3. Reach TRON at `http://<redmi-tailscale-name>:3000` from anywhere

Then add that hostname to `TRON_ALLOWED_ORIGINS` as well. TRON is never exposed
to the public internet; the tunnel is the only way in, and the passphrase is the
second door.

If you later terminate TLS in front of TRON, set `TRON_COOKIE_SECURE=true`.

---

## How it is put together

```
src/
  app/
    api/
      auth/         passphrase login, session cookie, current user
      data/         the one endpoint the whole UI reads and writes through
      data/events/  server-sent events; what makes screens update live
      memory/       explicit remember / recall / forget
      classify/     capture classification via the local model
      briefing/     home-screen briefing via the local model
      health/       what `tron status` reads
    …              every screen, unchanged apart from the theme

  server/           Node-only. Never reaches the browser.
    sqlite.ts       driver selection + schema
    docstore.ts     documents, filters, sentinels
    memory.ts       explicit memory
    auth.ts         single-user sessions
    guard.ts        every request is scoped to the owner

  lib/
    tron/
      firestore.ts  local data client shaped like the old Firestore API
      transport.ts  HTTP + the live-update stream
      timestamp.ts  Timestamp, and wire (de)serialisation
      session.ts    client-side session state
      memory-commands.ts
    ai-gateway.ts   llama.cpp / OpenAI-compatible client
    tron-ai.ts      classifier and briefing prompts
    db.ts           collections and capture routing
    tools.ts        the tools "Ask TRON" can call
```

### Why the data layer looks like Firestore

The brief was to keep the existing interface and swap what's underneath it.
`src/lib/tron/firestore.ts` deliberately exposes the same calls the screens
already used — `collection`, `doc`, `query`, `where`, `onSnapshot`, `addDoc`,
`serverTimestamp`, `increment` — so all 25+ screens kept working untouched while
Firebase was removed completely. Every one of those calls now goes to
`/api/data` and lands in SQLite.

Live updates work the same way they used to look: each write bumps a per-
collection revision counter, and an SSE stream tells open screens which
collections changed so they refetch. No polling loops in the UI.

### Storage

One table holds every document as JSON, keyed by collection path. That keeps the
schemaless shape the screens expect while still being a single, ordinary SQLite
file you fully control:

```
data/tron.db          ← everything lives here
```

Back it up by copying that file. Wipe it by deleting it.

---

## Configuration

Every option lives in `.env.local`. See `.env.example` for the annotated list.
The ones that matter most:

| Variable | What it does |
|---|---|
| `TRON_PASSPHRASE` | **Required.** The only thing that unlocks TRON. |
| `TRON_DB_PATH` | Where SQLite lives. Default `./data/tron.db`. |
| `TRON_LLM_URL` | Your llama.cpp server. Default `http://127.0.0.1:8080`. |
| `TRON_ALLOWED_ORIGINS` | Addresses allowed to call server actions. |
| `TRON_MANAGE_LLAMA` | `false` to leave your llama-server alone. |

---

## Typography

TRON makes no webfont request — it has to render correctly on a phone with no
internet. To use the original Space Grotesk face, drop `SpaceGrotesk.woff2` into
`src/app/fonts/` and follow the four-line note at the top of
`src/app/globals.css`. Nothing else changes.

---

## Roadmap

**V2** — automatic memory, richer retrieval, notifications, voice capture.
**V3** — web search, weather, calendar sync, autonomous routines.
