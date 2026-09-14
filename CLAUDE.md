# TRON

Private, self-hosted personal AI. Next.js + SQLite + local llama.cpp on a Redmi.

## Non-negotiables

- **No cloud services.** No Firebase, Supabase, Gemini, or any hosted API.
  Everything runs on the owner's own device.
- **The UI is the asset.** Screens are preserved and improved, never rebuilt.
  `src/lib/tron/firestore.ts` keeps a Firestore-shaped surface precisely so the
  screens stayed untouched when the storage swapped to SQLite. Do not "clean it
  up" into a different API without migrating every screen.
- **Memory is explicit.** TRON stores something only when the owner says
  "TRON, remember ...". Never add automatic memory writes in V1.
- **Single user.** One owner, one passphrase. No roles, no multi-tenancy.

## Layout

- `src/server/**` is Node-only and must never be imported from a client
  component. It holds SQLite, sessions, and explicit memory.
- `src/lib/tron/**` is the browser-side data client.
- All reads and writes go through `/api/data`. Nothing talks to SQLite directly
  from the browser.
- Every request is scoped to the owner in `src/server/guard.ts`.

## Theme

Electric blue on deep navy. Tokens live in `src/app/globals.css` — use the CSS
variables rather than new hardcoded colors. Glow is for interactive and live
elements only; this should not look like gaming RGB.

## Offline

No webfont or CDN requests anywhere. The app must render correctly on a phone
with no internet connection.

## Commands

    npm run build
    npm run tron -- start | stop | restart | status | logs
