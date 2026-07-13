# Tempo — Database Design

PostgreSQL via Prisma; schema of record:
[packages/db/prisma/schema.prisma](../packages/db/prisma/schema.prisma).
Conventions: cuid ids, white-POV centipawns, EPD = FEN minus move counters.

## Core graph

```
User ─┬─ Game ─┬─ Move            (one row per ply: san/uci/fenAfter/epdAfter/clock)
      │        ├─ Analysis ── MoveAnalysis ── AiExplanation
      │        └─ Opening (FK)
      ├─ ImportJob
      ├─ Membership ── Organization
      ├─ Puzzle
      ├─ ApiKey / Webhook
      └─ Subscription ── Payment

EngineEvaluation   (standalone: the cross-user EPD eval cache)
Opening            (3,803 rows seeded from lichess-org/chess-openings)
```

## Design decisions

- **`Game` idempotent sync**: `@@unique([userId, source, externalId])` makes
  platform re-imports no-ops; `shareSlug` (nullable unique) powers public
  pages.
- **`Move` normalised per ply** so per-move queries (classification stats,
  clock analysis) never parse PGN; the raw PGN is kept on `Game` for fidelity
  (variations/comments).
- **`Analysis` vs `MoveAnalysis`**: game-level rollups (accuracy, ACPL, status,
  `lastPly` resume cursor, summary JSON) vs per-ply engine output + derived
  labels. `@@unique([analysisId, ply])` lets derivation upsert idempotently.
- **`EngineEvaluation`** (ADR 006): keyed by EPD, depth-monotonic writes,
  stores MultiPV lines as JSON. Shared across users — evaluations contain no
  user data.
- **`Opening.epd` unique** enables transposition-safe recognition; games link
  by FK so "top openings" is a join, not string matching.
- **Future-feature tables shipped now** (Organizations, ApiKey, Webhook,
  Puzzle, Subscription, Payment, AiExplanation) so Steps 4–6 are migrations of
  *behaviour*, not schema rethinks. All are real tables with correct
  relations/uniques, currently unused by the app layer.
- **Deletes cascade** from User and Game; Opening links use `SetNull`-style
  optional FKs where history should survive.

## Indexing

Hot paths are covered: `Game(userId, playedAt desc)`, `Game(userId, createdAt
desc)` (list + dashboard), `ImportJob(userId, createdAt desc)`,
`Opening(eco)`, plus the unique constraints above which double as lookups.
The label-distribution stat uses one grouped raw query over
`MoveAnalysis ⋈ Analysis ⋈ Game`.
