# ADR 010 — Polyglot services: Python agents and ML, TypeScript keeps the chess maths

- Status: accepted (implementation starts in roadmap Phase 3)
- Date: 2026-11-24

## Context

The ChessMind roadmap ([ROADMAP.md](../ROADMAP.md)) adds three Python pieces:
- an LLM coach built with LangGraph,
- an eval study,
- a move-prediction transformer in PyTorch.

Python is the right tool for these. PyTorch and the agent ecosystem live
there, and it is also a deliberate learning goal.

All of Tempo's chess maths lives in TypeScript: win%, accuracy,
classification, sacrifice SEE, openings and (soon) motif detection, in
`@tempo/chess-core`. Engine I/O lives in `@tempo/engine-core`. Golden rule 1
requires one implementation of that maths. If Python re-implemented it with
`python-chess`, the agents would quietly disagree with the review UI.

## Decision

- **Python product code never re-implements chess analysis.** It reaches
  `chess-core` and `engine-core` only through **`apps/chess-tools`**. That is
  a Node service exposing them as **MCP tools** over streamable HTTP, and
  LangGraph consumes those tools via `langchain-mcp-adapters`. Phase 3 starts
  with four tools: `get_game_context`, `analyse_position`, `extract_features`
  and `check_moves_legal`.
- **`python-chess` is allowed only in three places**, each with a reason:
  - `spikes/` — throwaway experiments.
  - `ml/` — transformer data prep and the legal-move rate metric.
  - `eval/` — the study's **independent** verifier.
- **The eval verifier stays independent.** It may drive its own Stockfish via
  python-chess, deliberately outside `engine-core`, so the system under test
  isn't graded by its own code. This is a written exception to golden rule 2.
- **chess-tools serves `move-model` too.** It computes legal moves with
  chessops and passes them to `apps/move-model` as a mask. So the serving path
  needs no python-chess.
- **Contracts flow one way.** zod in `@tempo/types` stays the source of truth.
  Python models are generated from it (zod → JSON Schema → pydantic), and CI
  fails if they are stale. The details get an ADR in Phase 3.
- **Prisma owns every table and migration.** Python accesses the database
  without migrations of its own.

## Why does this exist?

Without the boundary, the coach would explain a move using maths that differ
from what the review page shows. The user would see two different verdicts on
the same move. One implementation behind a tool interface makes the agent's
facts match the UI's by construction.

## Consequences

- Every Python→chess call is an extra network hop. That's fine for coaching
  latency, where a call costs milliseconds and LLM tokens cost seconds.
- The tool surface is explicit and auditable. It is also the
  prompt-injection boundary: tools are read-only and scoped per request.
- There are now two toolchains (pnpm and uv) and two CI jobs.
