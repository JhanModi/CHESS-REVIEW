# ADR 007 — Client-computed evals, server-derived statistics

- Status: accepted
- Date: 2026-07-13

## Context

In the first release, analysis runs in the user's browser (WASM). The client
must persist results so games stay analysed across devices. But dashboards,
leaderboard-adjacent stats, and future quotas depend on accuracy numbers —
which must not be forgeable by a modified client.

## Decision

- The client submits only **raw engine output** per ply: score (cp/mate),
  depth, best line, second line. Submissions are validated (zod) and
  incremental (batched every N plies with a `lastPly` cursor → resumable).
- The **server recomputes everything derived**: win%, per-move accuracy,
  cpLoss, classification labels, game accuracy, summary (turning points,
  best/worst move, phase split) using the same `@tempo/chess-core` functions.
- Client-side classification exists purely for instant UI feedback; the
  server's result is canonical and returned on the next fetch.
- Depth monotonicity applies per ply: a submission may not lower stored depth.

## Consequences

- A tampered client can at worst submit fake *engine lines* (bounded harm,
  detectable later by server-side spot re-analysis in Step 3), not fake
  accuracy trends.
- When server-side engines arrive (Step 3), nothing changes in the data
  model — only who produces raw evals.
- One shared implementation of the math (monorepo package) keeps client
  preview and server truth in agreement.
