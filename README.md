# Tempo — every move, understood

An original AI-powered chess analysis platform. Import games from Lichess,
Chess.com or PGN; analyse them with Stockfish 18 running **in your browser**;
get chess.com-Game-Review-class insight — accuracy, move classifications
(brilliant → blunder), turning points, opening recognition and trend
dashboards — with original UI, branding and implementation.

![CI](https://github.com/JhanModi/CHESS-REVIEW/actions/workflows/ci.yml/badge.svg)
&nbsp;![stack](https://img.shields.io/badge/stack-Next.js%2015%20·%20NestJS%20·%20Prisma%20·%20Stockfish%2018-6d5ae6)
&nbsp;![license](https://img.shields.io/badge/license-all%20rights%20reserved-lightgrey)

## What works today

- **Import**: PGN paste, drag-and-drop upload (multi-game), Lichess and
  Chess.com username sync (keyless public APIs, background jobs, progress UI —
  fetches your 10 most recent games)
- **Analysis**: Stockfish 18 lite (WASM, multithreaded when the browser allows,
  single-thread fallback) evaluates every position at MultiPV 2; raw evals
  stream to the server, which derives win% (lichess model), per-move accuracy,
  centipawn loss and the full classification set — book, forced, brilliant,
  great, best, excellent, good, inaccuracy, mistake, blunder, miss.
  Interruptible + resumable; positions dedupe across users via an EPD cache.
- **Review**: animated custom board (piece-identity animations, last-move /
  check highlights, engine arrows, classification glyphs), eval bar,
  win-probability graph with click-to-jump, engine lines as SAN, move list with
  badges, game summary (accuracy rings, turning points, worst moves), keyboard
  navigation (← → ↑ ↓ · f flips · space autoplays)
- **Dashboard**: score, average accuracy/ACPL, accuracy trend, move-quality
  distribution (your moves only), top openings with scores, recent games
- **Sharing**: public read-only game pages at `/share/<slug>`
- **Auth**: Clerk (or a zero-config local dev identity until keys are added)

The architecture (engine adapters, AI explanation pipeline, orgs/coach mode,
API keys/webhooks, puzzles) is designed and schema-shipped for the next
delivery steps — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[docs/adr/](docs/adr/).

## Monorepo layout

```
apps/web        Next.js 15 · React 19 · Tailwind v4 · shadcn-style UI · Zustand · React Query
apps/api        NestJS · /v1 REST · Swagger at /docs · Clerk guard · queue port (BullMQ/in-process)
packages/
  chess-core    PGN (chessops) · win%/accuracy math · classification · SEE sacrifice detection ·
                3,803-opening EPD book · game summaries        (61 tests)
  engine-core   EngineAdapter contract · UCI codec · UciSession (16 tests)
  types         zod schemas + DTOs shared web↔api
  db            Prisma schema · migrations · ECO seed
  ai-core       LLM adapter seam (Step 4)
docs/           architecture · API · database · ADRs 001–007
```

## Getting started

Prerequisites: **Node ≥ 22.13** (pnpm 11's own floor), **pnpm ≥ 9**,
**PostgreSQL 16+** (native or `docker compose up -d`). Redis is optional in dev.

```bash
pnpm install

# 1. environment
cp .env.example .env            # fill in DATABASE_URL (and Clerk keys when ready)

# 2. database
pnpm db:migrate                 # applies migrations
pnpm db:seed                    # loads 3,803 ECO openings

# 3. run everything
pnpm dev                        # web on :3000, api on :3001 (Swagger at :3001/docs)
```

Without Clerk keys, set `AUTH_DEV_BYPASS="true"` in `.env` and the app runs
with a local dev identity. To enable real auth, create a free Clerk app and
fill `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` and (optionally,
for networkless verification) `CLERK_JWT_KEY`.

### Useful scripts

| Command | Effect |
|---|---|
| `pnpm test` | vitest suites (chess-core, engine-core) |
| `pnpm typecheck` | strict TS across the workspace |
| `pnpm build` | production builds (packages → api → web) |
| `pnpm --filter @tempo/chess-core build:openings` | regenerate the opening book from the TSVs |
| `pnpm --filter @tempo/db studio` | Prisma Studio |

## Roadmap

The foundational product above works today. Designed next — each against
interfaces and schema already present in the repo:

- **Server-side engine fleet** — native Stockfish workers behind the same
  `EngineAdapter`, streaming progress over SSE for heavy batch analysis
- **Tactical & endgame detection** — motif tags (forks, pins, skewers, back-rank,
  Greek gift, sacrifices; Lucena, Philidor, opposition, …)
- **AI coach** — per-move natural-language explanation at four skill levels,
  multi-language, streaming, provider-switchable (Anthropic / OpenAI / Gemini)
- **Training** — puzzles generated from your own blunders, guess-the-best-move,
  spaced repetition
- **Teams & coaching** — organizations, coach/student mode, study collections
- **Platform** — Stripe tiers, admin dashboard, public API keys + webhooks,
  containerized deployment + CDN

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [PRD.md](PRD.md) for the
full design.

## License & credits

Source-available for review — **all rights reserved** (see [LICENSE](LICENSE)).
Bundled third-party artifacts: **Stockfish 18**
(GPL-3.0) is served as an unmodified separate WASM artifact and spoken to over
UCI; **rhosgfx** piece set (CC0); **lichess-org/chess-openings** data (public
domain); chessops (GPL-3.0-or-later — review before commercial distribution,
or swap for a permissive move-gen library at the `chess-core` seam).
