# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Meme Rush is a hackathon MVP (5-hour build). Specs live in `docs/` and are the source of truth; read them before changing behavior:

- `docs/MVP_SCOPE.md` — scope, decisions, DB schema, API contract, screens. Its "가이드 적용 규칙" table says which doc wins where the screen guides disagree.
- `docs/MEME_GAME_DESIGN.md` — game design and the meme card format (day file `meme` field).
- `docs/GAME_FRAME_SPEC.md` — game frame contract (`timing_stop`, 3 rounds summed).
- `docs/ADMIN_UX_GUIDE.md`, `docs/SERVICE_UX_GUIDE.md`, `docs/GAME_SCREEN_GUIDE.md`, `docs/ASSET_FORMATS.md` — visual rules and asset formats.

## Layout

- `web/` — the Next.js app (deployed on Vercel with root directory `web`).
- `tools/discovery/` — Simon's offline Python discovery CLI (PR #16, separate; the app does not import it).
- `art/` — style references, not shipping assets.

## Commands (run in `web/`)

- `npm run dev` — dev server
- `npm run build` — production build (also type-checks)
- `npm run lint`
- Env: copy `.env.example` to `.env.local` and fill `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- DB schema: `web/supabase/migrations/0001_init.sql`, run once in the Supabase SQL Editor.

## Architecture notes

- Next.js 16 (App Router). Its APIs differ from older versions; check `web/node_modules/next/dist/docs/` before using an unfamiliar API. Cache Components is turned off in `next.config.ts` on purpose.
- Day files: `web/content/challenges/{id}.json`, validated by the zod schema in `web/src/lib/challenge.ts`. Every `YYYY-MM-DD.json` in that folder is loaded at startup (no registry to edit); today's challenge is the latest file not after today in KST, and the daily number (`#001`…) is the file's position in date order. A bad file fails the build.
- All DB access goes through API routes using the service-role client in `web/src/lib/supabase.ts` (`server-only`). The browser never gets a Supabase key; every table has RLS on with no policies.
