# ADR 006 — Position-keyed engine evaluation cache (EPD)

- Status: accepted
- Date: 2026-07-13

## Context

Engine time is the platform's dominant cost. The same positions recur
constantly: openings across all users, repetitions within a game, and the same
game re-analysed at higher depth. Caching by game or by move misses all of
that; caching by position captures it.

## Decision

- Cache key is the **EPD** — the FEN's first four fields (pieces, side to
  move, castling, en passant), dropping the halfmove/fullmove counters that
  don't affect evaluation (except 50-move edge cases we accept).
- Storage: `EngineEvaluation` table (`epd` unique) holding engine id, depth,
  score, PV and multiPV lines, fronted by Redis in production.
- **Depth monotonicity**: an entry is only overwritten by a *deeper*
  evaluation from the same engine family; shallower results are discarded.
- The analysis orchestrator consults the cache before every position and
  writes through after; cache hits are shared across users (evaluations
  contain no user data).

## Consequences

- Popular openings are engine-analysed once, platform-wide, ever.
- Re-analysis and the quick→deep two-pass pipeline become cheap upgrades
  instead of full reruns.
- EPD ignores move counters, so evaluations near 50-move draws can be slightly
  off; acceptable and documented.
