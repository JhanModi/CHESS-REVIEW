# CLAUDE.md — operating guide for every session

This file is the standing brief for working on **Tempo** (repo `CHESS-REVIEW`).
Read it first, every session. Companion docs:

- **[PRD.md](PRD.md)** — what we're building and why (product scope).
- **[PROGRESS.md](PROGRESS.md)** — milestone roadmap + changelog. **Update it after every finished task.**
- **[MEMORY.md](MEMORY.md)** — durable facts, decisions, and things that bit us.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — canonical architecture (+ ADRs in `docs/adr/`).

> Start-of-session ritual: skim PROGRESS.md (where are we?), MEMORY.md (what's
> non-obvious?), and the relevant ADRs. End-of-session ritual: update
> PROGRESS.md and, if something durable changed, MEMORY.md.

---

## 1. What Tempo is

An original AI-powered chess analysis platform (comparable capability to
leading analysis tools; original UI, branding, implementation). Import games
from Lichess/Chess.com/PGN, analyse with Stockfish, understand every move.
Full vision in PRD.md.

## 2. Golden rules (do not violate)

1. **Server derives analysis; never trust the client** (ADR 007). The client
   submits *raw engine evals only*; win%/accuracy/classification/summary are
   recomputed server-side from `@tempo/chess-core`. Same math on both sides.
2. **The engine is a replaceable artifact behind `EngineAdapter`** (ADR 003).
   No UCI parsing outside `@tempo/engine-core`. No engine bundling — served
   static from `public/stockfish/`.
3. **Domain logic is framework-free and tested.** Anything analytical goes in
   `packages/*` (pure TS, vitest), not in Nest or React. Dependency direction
   is `apps → packages`, never sideways.
4. **`@tempo/types` (zod) is the single source of truth for DTOs** crossing
   web↔api. Change the contract there, not in two places.
5. **Every structural decision gets an ADR** in `docs/adr/NNN-*.md` (MADR).
6. **No placeholder code.** Deferred features exist as designed interfaces +
   schema, never dead stubs.
7. **Never commit secrets.** `.env` and `apps/web/.env.local` are gitignored;
   keep it that way. Don't print their contents.
8. **White-POV centipawns everywhere; EPD (FEN minus move counters) is the
   position key** for the eval cache and openings.

## 3. Repo map

```
apps/web        Next.js 15 · React 19 · Tailwind v4 · Zustand · React Query · Clerk
apps/api        NestJS · /v1 REST · Swagger /docs · Clerk guard · queue port
packages/
  chess-core    PGN, win%/accuracy, classification, sacrifice SEE, openings, summary
  engine-core   EngineAdapter, UCI codec, UciSession
  ai-core       LLM adapter seam (Step/M9 — not built yet)
  types         zod schemas + DTOs
  db            Prisma schema, migrations, ECO seed
  config        shared tsconfig/eslint
docs/           ARCHITECTURE.md, API.md, DATABASE.md, adr/001–007
```

## 4. Environment (this machine — Windows)

- **OS/shell**: Windows 11, PowerShell primary (Bash tool available for POSIX).
- **Node** ≥ 22.12. **pnpm 11** — installed via `npm i -g pnpm` (corepack hit
  EPERM). pnpm's global bin is NOT on PATH; install global CLIs with **npm**.
- **pnpm build approvals** live in `pnpm-workspace.yaml` under `allowBuilds:`
  (new native dep flagged? add it there, not the old `onlyBuiltDependencies`).
- **PostgreSQL 17**, native service `postgresql-x64-17`. App DB `chessreview`,
  app user `chessreview` / `chessreview_dev` (dev-only password, in `.env.example`).
- **Redis / Docker**: not installed. The API's queue + cache **fall back to
  in-process by design** when `REDIS_URL` is unset. Server-engine work (M7)
  will need Redis — use `docker compose up -d` then.
- **Clerk**: configured. Keys in `apps/web/.env.local` (web) and root `.env`
  (`CLERK_SECRET_KEY` for the API). Linked app `app_3GSC6OqFWPtn50I3whyJDlQ0Jvb`.
  `AUTH_DEV_BYPASS` is disabled; set it `true` only if running without keys.

## 5. Commands

```bash
pnpm install
pnpm db:migrate            # apply Prisma migrations
pnpm db:seed               # load 3,803 ECO openings
pnpm dev                   # web :3000, api :3001 (Swagger :3001/docs)
pnpm test                  # vitest (chess-core, engine-core, api)
pnpm typecheck             # strict TS, whole workspace
pnpm build                 # production builds
pnpm --filter @tempo/chess-core build:openings   # regen opening book from TSVs
```

## 6. Windows/tooling gotchas (learned the hard way — see MEMORY.md)

- **`prisma generate` fails EPERM while the API process is running** (DLL
  lock). Stop the API before `pnpm build` / `db:generate`.
- **`next build` corrupts a running dev server's `.next`.** Don't build while
  `pnpm dev`/preview is up; restart the preview afterward.
- **Browser-pane screenshots time out on COOP/COEP pages** (our app is
  cross-origin-isolated for SharedArrayBuffer). Verify with `get_page_text` /
  `javascript_tool`, not screenshots.
- **Monorepo**: the Next app is `apps/web`, not root. Run `clerk`/`next`
  commands there (`Push-Location apps\web`). Root `.env` is the API's source;
  web also reads `apps/web/.env.local`.
- **Clerk CLI**: `clerk init` skips files that already exist and may add a
  duplicate `<ClerkProvider>` in `layout.tsx` — keep the conditional one in
  `apps/web/src/lib/auth.tsx` as the single provider.

## 7. Conventions

- **Commits**: imperative subject, explain the *why*; end with
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Commit per logical
  milestone. Branch before committing if on the default branch and the user
  hasn't said otherwise.
- **Classification thresholds** are injectable (`ClassificationThresholds`),
  per-user in `User.settings.thresholds`. Don't hard-code bands.
- **Tests before UI** for pure logic. Keep the golden values (cp=0→50%,
  cp=+100→~59.1%, known-game accuracy within ±2 of lichess).
- **Piece art**: rhosgfx (CC0). **Openings**: lichess public-domain TSV.
  **Engine**: Stockfish 18 (GPL, isolated). **chessops**: GPL-3.0-or-later —
  see ADR 002 before commercial web distribution.
