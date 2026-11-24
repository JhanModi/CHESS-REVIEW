# ADR 009 — License Tempo under GPL-3.0-or-later

- Status: accepted
- Date: 2026-11-24
- Supersedes: the licensing consequence of ADR 002
- Amends: ADR 003's "GPL isolation from proprietary app code" rationale

## Context

Tempo was published as "all rights reserved" source-available code, but it
ships GPL components:

- **chessops** (GPL-3.0-or-later) is compiled into the public web bundle
  through `@tempo/chess-core`. ADR 002 called this "fine until commercial
  distribution", but serving the bundle to browsers already counts as
  distribution, so the live site was already in a grey area.
- **Stockfish** (GPL-3.0) is served as a separate WASM artifact today. The
  roadmap (server engine worker, Docker images) puts a native Stockfish binary
  inside published container images.

There are two ways to resolve this:

1. Keep the code proprietary and replace chessops at the `chess-core` seam.
   chess.js lacks the variation-aware PGN parsing chosen in ADR 002, so this
   means real feature loss and work.
2. Release Tempo under a GPL-compatible license.

The project's purpose is a public portfolio and learning project, not a
closed commercial product. The repository owner is the sole author; the
early commits made under a work git identity were also written by them, on
personal time.

## Decision

- Tempo is licensed under **GPL-3.0-or-later**. That matches chessops and is
  compatible with Stockfish's GPL-3.0.
- `LICENSE` holds the verbatim GPL-3.0 text, so tooling detects it.
- `NOTICE` holds the copyright line, the "or later" grant and the third-party
  list.
- Every workspace `package.json` declares `"license": "GPL-3.0-or-later"`.
- Server images may include an **unmodified native Stockfish binary**. This
  amends ADR 003's "never bundled" rule for server images only. Such an image
  must ship Stockfish's `COPYING` and record the exact upstream source tag.
  The browser continues to load the WASM artifact unmodified from
  `public/stockfish/`.
- Each new dependency, dataset or model adds its license to `NOTICE` when it
  is introduced. This covers future Python packages, Lichess data (CC0) and
  local LLM weights.

## Consequences

- The web bundle and future container images can be distributed publicly
  without breaching chessops' or Stockfish's terms.
- A future closed-source commercial edition is no longer possible without
  rewriting the GPL-dependent parts. That trade-off was accepted.
- The `chess-core` seam from ADR 002 still keeps chessops swappable. The
  reason has changed: it is now good architecture, not a licensing escape
  hatch.
