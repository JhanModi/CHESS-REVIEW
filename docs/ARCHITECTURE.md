# Tempo — System Architecture

Tempo is an original AI-powered chess analysis platform: import games from
Lichess/Chess.com/PGN, analyse them with Stockfish, and understand every move.
This document is the architecture of record; decisions link to ADRs in
[docs/adr/](adr/).

> Project-management companions live at the repo root:
> [CLAUDE.md](../CLAUDE.md) (session rules), [PRD.md](../PRD.md) (product
> scope), [PROGRESS.md](../PROGRESS.md) (milestone roadmap + changelog),
> [MEMORY.md](../MEMORY.md) (durable facts).

## 1. Topology

```
┌────────────────────────────┐        ┌──────────────────────────────┐
│  apps/web  (Next.js 15)    │  REST  │  apps/api  (NestJS, /v1)     │
│  ─ review UI, dashboard    │ ─────► │  ─ games / imports / stats   │
│  ─ Stockfish 18 WASM in a  │  JSON  │  ─ analysis derivation       │
│    Web Worker (UCI)        │        │  ─ Clerk JWT guard           │
└────────────┬───────────────┘        └───────┬──────────┬───────────┘
             │ static: engine WASM,           │          │ BullMQ (queue port;
             │ pieces (CDN-cacheable)         ▼          ▼  in-process in dev)
             │                        ┌────────────┐  ┌─────────────┐
             │                        │ PostgreSQL │  │ Redis       │
             │                        │ (Prisma)   │  │ (optional   │
             │                        └────────────┘  │  in dev)    │
             │                                        └─────────────┘
   packages/: chess-core · engine-core · ai-core · types · db · config
   (framework-free domain logic shared by every runtime — ADR 001)
```

- **Dependency direction:** `apps → packages`, never sideways (ADR 001).
- **API-first:** the web app consumes the same `/v1` JSON API a mobile client
  would; auth is bearer-token, so any client works.

## 2. Engine abstraction (ADR 003)

`@tempo/engine-core` defines the `EngineAdapter` contract; UCI parsing lives in
one transport-agnostic `UciSession`. Adapters:

| Adapter | Runtime | Status |
|---|---|---|
| Stockfish 18 lite WASM (multithread + single-thread fallback) | browser Web Worker | **shipped** |
| Stockfish native child process | server workers | Step 3 |
| Leela Chess Zero / cloud engine pool | server / remote | future |

Client and server produce identical `EvalUpdate` shapes, so classification is
transport-agnostic. Engine artifacts are served unmodified from
`public/stockfish/` (GPL isolation, no bundling), multithreaded only when
`crossOriginIsolated` (COEP `credentialless` — ADR 005).

## 3. Analysis pipeline (ADRs 006, 007)

1. Client evaluates every *position* (MultiPV=2, depth 16 default), consulting
   the shared **EPD-keyed evaluation cache** first (`GET /v1/evals`).
2. Raw evals stream to `PUT /v1/games/:id/analysis` in batches of 8 —
   **resumable** via the `lastPly` frontier; interrupting and resuming
   re-analyses nothing.
3. The **server derives everything**: win% (lichess model), per-move accuracy,
   cpLoss, classification labels (book/forced/brilliant/great/best/miss/bands —
   ADR 004), game accuracy, ACPL, and the summary (turning points, worst moves,
   phase split). Client math is never trusted; classifications are re-derivable
   from raw evals without re-running engines.
4. Terminal positions (mate/stalemate) are synthesised as `moveUci: "none"`
   with a game-over score.

Per-user classification thresholds live in `User.settings.thresholds` and are
merged over defaults at derivation time.

## 4. AI explanation pipeline (Step 4 — designed, schema shipped)

```
MoveAnalysis ─► FeatureExtractor (pure TS) ─► prompt template ─► LlmAdapter ─► AiExplanation cache ─► SSE stream
```

- Features (sacrifice flags, hanging pieces, phase, motifs) are computed
  deterministically in `@tempo/chess-core`; the LLM narrates, it never computes.
- `@tempo/ai-core` will define `LlmAdapter` with Anthropic/OpenAI/Gemini
  implementations, switchable per request; graceful degradation when no key is
  configured.
- Cache key: `(moveAnalysisId, provider, model, skillLevel, language)` — an
  explanation is generated once, ever. Multi-language and four skill levels are
  first-class columns.

## 5. Performance

- **Resumable + deduplicated analysis** (above): popular openings are analysed
  once platform-wide.
- Engine WASM/NNUE and piece SVGs ship with `Cache-Control: immutable`
  (CDN-ready); the ~7 MB engine loads lazily on first analysis.
- Games lists are cursor-paginated; review state is client-side (Zustand) with
  precomputed per-ply board snapshots for O(1) jumps and stable piece-identity
  animation.
- Queue port (`JobQueueService`): BullMQ workers when `REDIS_URL` is set,
  in-process execution in dev — same handler code.

## 6. SaaS & extensibility (schema shipped; features land Steps 4–6)

- **Organizations/Membership** with roles (OWNER/COACH/STUDENT/MEMBER) →
  coach/student mode.
- **Public sharing**: `Game.shareSlug` → `/share/[slug]` (shipped).
- **ApiKey** (hashed, scoped) + **Webhook** (`analysis.completed`, …) tables →
  customer API is policy, not rework (the REST API is already versioned and
  OpenAPI-documented).
- **Puzzle** table → puzzles generated from your blunders (Step 4).
- **Subscription/Payment** → Stripe (Step 5).

## 7. UX roadmap

Interactive review ("find the better move"), guess-the-best-move training,
learn-from-your-blunders spaced repetition, AI coach conversations grounded in
extracted features, personalised weekly training plans. Progress tracking v1
(dashboard) is shipped.

## 8. Scaling path

| Load | Change |
|---|---|
| 100k users | API is stateless → horizontal replicas behind a load balancer; Redis for cache + queues; Postgres read replicas for stats |
| Millions of games | Move table already normalised & indexed; partition `MoveAnalysis` by analysisId hash if needed; EPD cache keeps engine cost sublinear |
| Server-side analysis | Step 3 worker fleet: BullMQ `analysis` queue → N containers with native Stockfish; results stream via Redis pub/sub → SSE |
| Web delivery | Static assets → CDN; Next.js output standalone in a container |

## 9. Delivery roadmap (Steps 2–6 of the product spec)

- **Step 3**: server engine fleet (native adapter), SSE progress, spot
  re-verification of client-submitted evals.
- **Step 4**: AI coach (§4), tactical/endgame motif detection in chess-core,
  interactive review, puzzle generation, studies.
- **Step 5**: Stripe subscriptions + quotas, orgs UI, admin dashboard, API
  keys/webhooks UI.
- **Step 6**: Docker images, deployment manifests, monitoring/alerting, CDN.

## 10. Development requirements

No placeholder code; TDD in the pure-logic packages (94 tests across
chess-core/engine-core); ADRs for every structural decision; clean
architecture (framework-free domain, thin app layer); repo-wide typecheck must
pass; CI runs lint + typecheck + tests + builds on every push.
