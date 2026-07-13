# ADR 002 — chessops as the chess rules/PGN library

- Status: accepted
- Date: 2026-07-13

## Context

We need robust PGN parsing (variations, comments, NAGs, multi-game files),
legal move generation, SAN/UCI conversion, and FEN/EPD handling, at a
performance level that allows replaying thousands of imported games. The two
mature TypeScript candidates are chess.js and chessops.

## Decision

Use **chessops** (the library behind lichess tooling) everywhere, including
the interactive board.

## Rationale

- chess.js (v1.x) still has no RAV/variation support in its PGN parser — an
  open roadmap item. chessops has a full game-tree PGN model with variations,
  comments, NAGs and streaming parsing with DoS protection.
- chessops is TypeScript-first with immutable-friendly APIs and has documented
  performance work on bulk game replay.
- One library for parsing *and* the board avoids dual representations of
  moves/positions.

## Consequences

- chessops is ESM-only; the API consumes it via Node ≥ 22.12 `require(esm)`
  (see ADR 001).
- Its API is lower-level than chess.js; `@tempo/chess-core` wraps it behind
  domain functions (`parsePgn`, `replay`, `legalMoves`, `toSan`, …) so app code
  never touches chessops directly.
