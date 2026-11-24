# Roadmap: Tempo → ChessMind

## The pitch

> LLMs hallucinate when explaining chess. Tempo's coach is a multi-agent
> system where every chess claim is verified against Stockfish before the
> user sees it. The project measures how much each technique improves
> accuracy and reduces token cost. It also trains a small transformer that
> predicts what a player at a given rating would actually play.

Every component must pass one test: **"Why does this exist?"** The answer has
to be a product or engineering reason, recorded in that component's ADR.
Anything that fails the test is cut or deferred.

## What already exists (Phase 0, shipped)

- Imports from Lichess, Chess.com and PGN.
- In-browser Stockfish 18 behind `EngineAdapter`.
- Server-derived win%, accuracy and classifications (ADRs 004 and 007).
- An EPD-keyed eval cache. Its trust model was hardened in ADR 008.
- The review UI, dashboard and share pages.
- A live deployment on Vercel and Render.

## Scope decisions

**Core:**
- Stockfish-verified *typed claims*, checked by a critic agent.
- An eval study.
- A rating-aware move transformer.

**Kept, trimmed to what the problem needs:**
- A chess-tools MCP server with 4 tools (ADR 010).
- LangGraph with an explainer, a critic and a rule-based router.
- 4 motif detectors: hanging piece, fork, pin, mate threat.
- Token optimisation, using caching and context compaction.
- A server Stockfish worker.
- Player weaknesses computed as plain SQL aggregation.

**Deferred until a real need appears:**
- pgvector / RAG.
- Kubernetes autoscaling (KEDA), Grafana and Locust.
- A LangGraph checkpointer.
- More than two agents.
- Discovered-attack and endgame detectors.

**Kubernetes:** optional polish at the end. At most a Helm chart plus a kind
smoke test.

## Phases

Total effort is about 395 hours: roughly 6–7 months at 15–20 h/week,
including learning time. Each phase is planned in detail when it starts, and
its gate is its acceptance test.

| Phase | What | Gate |
|---|---|---|
| **1. Prove the idea** | Fix the eval-cache poisoning bug (done, ADR 008). Then a throwaway spike in `spikes/`: one local LLM explains a blunder, typed claims are extracted, and each claim is verified with Stockfish. | **Go/no-go**, on about 30 real blunders: report hallucinated-move rate, verified-claim rate and latency per model size. If small local models can't reach a usable verified rate, the coach defaults to an opt-in free-tier hosted model. |
| **2. Learn transformers** (in parallel) | Notebooks in `ml/notebooks/`: a GPT from scratch, then a tiny chess next-move model. | Attention, causal masking and KV caching can be explained from the project's own code. |
| **3. The real coach** | **Engine and motifs:** a server Stockfish worker (BullMQ) that writes trusted evals, plus 4 motif detectors and a feature extractor in `chess-core`. **Agents:** `apps/chess-tools` (MCP) and `apps/agents` (LangGraph explainer + critic). **App:** the `/v1/coach` SSE endpoint and a coach tab in review. | "Explain this blunder" streams a grounded answer, with a verification flag on every claim. |
| **4. Eval study** | `eval/` compares (A) LLM alone, (B) LLM + tools, and (C) LLM + tools + critic. It uses an independent verifier and local models with pinned digests, and reports bootstrap confidence intervals. | One command reproduces the results table. |
| **5. Personalisation** | A rating-conditioned transformer (about 6M parameters) trained on streamed Lichess data (CC0), served on CPU via ONNX. It is exposed as a `human_move_distribution(gameId, ply)` tool, which needs the game's move history. Also recurring-weakness insights from SQL aggregation. | Beats a popular-move baseline in each rating band, with p95 under 50 ms. The coach can say "x% of players at your rating play this". |
| **6. Token optimisation** | Exact caching, context compaction (FEN + features JSON instead of PGN) and model routing. Adds architecture D to the study. | Measured token savings for D vs C, with the quality change and its confidence interval. |
| **7. Ship it** | Dockerfiles, CI for both toolchains, optional Helm + kind smoke test, an architecture diagram, a results table and a demo video. | A fresh clone runs with `docker compose up`, and CI is green. |

**Cut order if behind:**
1. Phase 7's Helm/kind work.
2. Phase 6's model routing.
3. The weakness insights.

Phases 1, 3, 4 and 5 are the pitch and are never cut.

## Ground rules

- **Fair play:** post-game analysis and training only. Tempo never assists
  during live games.
- **Production:** the public demo runs in no-LLM mode. The full stack runs
  locally.
- **Licensing:** GPL-3.0-or-later (ADR 009). Every new dependency, dataset
  or model is added to [NOTICE](../NOTICE).
- **Prior art cited honestly:**
  - Rating-conditioned move prediction: Maia and Maia-2.
  - World models learned from move sequences: Othello-GPT and Karvonen
    (2024).

  The project's contribution is the verified-quality vs. token-cost study.
