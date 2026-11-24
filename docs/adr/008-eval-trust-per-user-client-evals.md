# ADR 008 — Eval trust: client evaluations are per-user, the shared cache is server-only

- Status: accepted
- Date: 2026-11-24
- Amends: ADR 006 (shared EPD cache), ADR 007 (client analyses, server derives)

## Context

ADR 007 made the server *derive* every statistic from raw engine evals, so
clients can't fake accuracy or labels by sending them. But the raw evals
themselves still came from clients, and ADR 006 wrote them into
`EngineEvaluation`, a cache shared across users. Any deeper submission
overwrote an existing row.

That combination was exploitable:

- `PUT /v1/games/:id/analysis` accepted any depth up to 99, from any
  authenticated user, for any position in a game they own.
- `deriveMoves` read the shared cache, so every user's labels for that
  position were computed from the forged row.
- `GET /v1/evals` served the forged row to every client. `GameAnalyser` then
  resubmitted it as that user's own analysis, spreading it further.

One forged deep eval for a common position (e.g. after 1.e4) silently changed
other users' move classifications and accuracy. Server-side derivation
protected the *maths* but not the *inputs*.

## Decision

- **Client-submitted evals are untrusted and scoped to their submitter.** They
  are stored in a new `ClientEvaluation` table, unique on `(userId, epd)`, with
  depth-monotonic writes per user and a cascading delete with the user.
  "Clear chess data" deletes them too.
- **`EngineEvaluation` is the trusted cross-user cache.** Only server-produced
  evaluations may be written to it. Today nothing writes it; the server
  Stockfish worker (roadmap Phase 3) will.
- **What a user sees is their own row or the trusted row, whichever is
  deeper.** On equal depth the trusted row wins. Another user's client row is
  never visible. The pure policy lives in `apps/api/src/analysis/eval-sources.ts`
  (`mergeEvalSources`, unit-tested). Both `deriveMoves` and `GET /v1/evals` go
  through it.
- **Migration `20261124120000_eval_trust`** works in three steps:
  1. Backfill. Every existing shared row was client-submitted, so it is copied
     per user for the positions of that user's analysed games: each move's
     `epdAfter`, plus the standard start EPD for games with no `[FEN]` header.
  2. Delete every legacy row from `EngineEvaluation`.
  3. Existing analyses then resume and re-derive exactly as before.

  Custom-FEN games lose only their start-position row. They self-heal: the
  next derivation stops at ply 0 and the client re-analyses that one position.

## Consequences

- One user can no longer influence another user's analysis.
  This was verified with a forged depth-99 submission from one user against a
  position shared with another user's game: the second user's lookup and
  re-derived labels were unchanged.
- **Cross-user cache hits are lost until server evals exist.**
  Users now re-analyse common positions in their own browser. That costs local
  CPU, not server cost, and matches ADR 003's WASM-first stance.
  Phase 3's worker restores cross-user sharing through trusted rows.
- `EngineEvaluation` will later gain provenance columns (engine build,
  server source) when its writer is added. That change belongs to that work,
  not this one.
- The API contract is unchanged. `GET /v1/evals` keeps its shape; only its
  scope narrows to the caller's own evals plus trusted evals.
