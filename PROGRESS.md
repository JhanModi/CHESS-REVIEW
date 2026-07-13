# Tempo — Development Progress

_Update this after every finished task: tick the item, add a dated changelog
entry, and note anything durable in [MEMORY.md](MEMORY.md)._

Legend: ✅ done · 🟡 in progress · ⬜ not started

---

## Milestone roadmap

Each milestone is scoped to fit in **one working session without losing
context**. Do them roughly in order; M7–M15 are independent enough to
reorder by priority. "Needs" flags external prerequisites.

### Phase 0 — Foundational product ✅ (delivered 2026-07-13)

- ✅ **M1 — Monorepo & domain packages**: Turborepo + pnpm; `@tempo/db`
  (Prisma schema incl. future tables, migration, 3,803-opening seed),
  `@tempo/chess-core` (PGN, win%/accuracy, classification, SEE sacrifice,
  openings, summary — 61 tests), `@tempo/engine-core` (EngineAdapter, UCI
  codec, UciSession — 16 tests). ADRs 001–007.
- ✅ **M2 — API**: NestJS `/v1`, Swagger, Clerk guard, games (PGN/import CRUD,
  share slugs), imports (Lichess/Chess.com, queue port), analysis (ADR-007
  derivation + EPD cache), stats.
- ✅ **M3 — Web foundation & auth**: Next 15 + Tailwind v4 + shadcn-style UI,
  COOP/COEP, theming, landing, app shell, auth seam. Clerk wired via CLI
  (sign-in/up, route protection, user provisioning verified).
- ✅ **M4 — Board & in-browser analysis**: custom animated board, review page
  (move list, eval graph, engine lines, summary, keyboard nav), Stockfish 18
  WASM worker, resumable GameAnalyser. Verified on Kasparov–Topalov 1999.
- ✅ **M5 — Imports, dashboard, sharing**: import UI, dashboard analytics,
  public `/share/[slug]`.
- ✅ **M6 — Docs & CI**: ARCHITECTURE/API/DATABASE, ADRs, GitHub Actions,
  README, docker-compose. Project-management docs (this file, CLAUDE, PRD,
  MEMORY) added 2026-07-13.

### Phase 1 — Depth & intelligence

- ⬜ **M7 — Server engine fleet** _(needs Redis/Docker)_: `StockfishNativeAdapter`
  (child process), BullMQ `analysis` queue, N worker processes, Redis pub/sub
  → SSE progress to client, spot re-verification of client-submitted evals.
  Deliverable: a game can be analysed server-side with identical results.
- ⬜ **M8 — Tactical & endgame detection**: pure-TS motif detectors in
  `chess-core` (forks, pins, skewers, discovered/double attacks, deflection,
  overload, back-rank, smothered, Greek gift, sacrifice, zwischenzug,
  clearance, interference, mate nets; Lucena, Philidor, opposition,
  triangulation, fortress, outside passer, R/Q/minor endings) with tests;
  motif tags stored on `MoveAnalysis` and shown in review.
- ⬜ **M9 — AI coach** _(needs one LLM API key)_: `@tempo/ai-core` `LlmAdapter`
  (Anthropic/OpenAI/Gemini), deterministic feature extractor, skill-level ×
  language prompt templates, SSE streaming, `AiExplanation` caching, coach
  tab + graceful no-key degradation.

### Phase 2 — Engagement

- ⬜ **M10 — Training**: guess-the-best-move, puzzle generation from blunders
  (`Puzzle` table), learn-from-your-blunders spaced repetition, interactive
  "find the better move" review mode.
- ⬜ **M11 — Orgs & coaching**: Clerk Organizations, `Membership` roles UI,
  coach views/annotates student games, `Study`/`StudyItem` collections.

### Phase 3 — Business & operations

- ⬜ **M12 — Billing**: Stripe subscriptions, Free/Pro tiers + usage quotas,
  webhook handling, billing UI, plan gating.
- ⬜ **M13 — Admin & public API**: admin dashboard (users, usage), `ApiKey`
  issuance + scopes, `Webhook` delivery (`analysis.completed`, …), rate-limit
  polish per key.
- ⬜ **M14 — Deployment**: Docker images (web/api/worker), production compose /
  manifests, CDN for static+engine assets, monitoring, error tracking, CI
  deploy pipeline.
- ⬜ **M15 — Polish & perf**: offline analysis, opening explorer, heatmaps,
  material-balance graph, richer keyboard shortcuts, accessibility pass,
  end-to-end (Playwright) tests.

---

## Changelog

### 2026-07-13 (later)
- **Best Move Suggestion** shipped on the review page (feature request,
  outside the numbered milestones): per-move learning card (per-classification
  copy incl. "you played the engine's best move" / brilliant / blunder
  punishment), Play Best Move + Play Engine Line with on-board PV playback
  (pause/step/exit, distinct variation highlight, "Viewing engine variation"
  banner), 💡 best-move hints in the move list. Zero backend changes — reuses
  stored `MoveAnalysis` (ADR 007); verified no engine/network work on
  interaction. Added web vitest setup (`replayLine` + variation-store suites);
  workspace now at 95 tests.

### 2026-07-13
- Delivered Phase 0 (M1–M6): runnable product — signup → import → analyse →
  review → dashboard → share, all verified end-to-end (real Lichess/Chess.com
  imports; Kasparov–Topalov 24.Rxd4!! classified Brilliant). 81 unit tests
  green; full turbo build + typecheck pass.
- Wired Clerk via the CLI (linked app `app_3GSC6…`); verified real sign-in,
  route protection, and API user provisioning. Disabled `AUTH_DEV_BYPASS`.
- Added project-management docs: CLAUDE.md, PRD.md, PROGRESS.md, MEMORY.md.

---

## Next session — start here

1. Read CLAUDE.md, this file, MEMORY.md.
2. Pick the next ⬜ milestone (default: **M7**, or M8/M9 if Redis/LLM-key
   prerequisites aren't ready — M8 needs neither and is high-value).
3. Confirm scope with the user if the milestone is large, then build
   test-first where logic is involved.
4. On finish: tick the milestone, add a changelog entry, update MEMORY.md,
   commit.
