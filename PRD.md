# Tempo — Product Requirements Document

_Status: living document. Last meaningful update: 2026-11-24 (ChessMind direction, §7)._

## 1. Vision

Turn chess games into lessons. A player imports their games, Tempo analyses
every move with a real engine, and the player comes away understanding **where
the game turned and why** — accuracy, mistakes, brilliancies, openings,
turning points — in a fast, premium, original interface. Analysis runs in the
browser by default (free, private, offline-capable), with a server engine
fleet for scale.

Original code, UI and branding throughout — comparable capability to leading
analysis platforms, not a clone of any.

## 2. Users

- **Improving club player** (primary): imports Lichess/Chess.com games, wants
  accuracy, mistake spotting, and trends over time.
- **Coach & student** (M11): coach reviews and annotates students' games,
  assigns studies.
- **Casual/one-off**: pastes a single PGN or opens a shared game, no account.
- **Developer/integrator** (M13): consumes the public API with keys/webhooks.

## 3. Principles

- **Understanding over numbers.** Every metric is explainable; the AI coach
  narrates from computed features, never invents evaluation.
- **Private & free by default.** In-browser engine; no game leaves the device
  unless the user imports/shares it.
- **Trustworthy accuracy.** Uses the published lichess win-probability model so
  numbers are comparable and defensible (ADR 004).
- **API-first.** Every capability is a versioned REST endpoint; web is one
  client, mobile could be another.

## 4. Feature scope

### Shipped (v0 — foundational product)
- Import: PGN paste, drag-and-drop upload (multi-game), Lichess + Chess.com
  username sync (keyless, background jobs, progress; 10 most recent games).
- In-browser Stockfish 18 analysis (multithreaded + single-thread fallback),
  MultiPV 2, resumable, EPD-deduplicated.
- Classification: brilliant, great, best, excellent, good, book, inaccuracy,
  mistake, blunder, miss, forced — configurable thresholds.
- Review: animated original board, eval bar, win-probability graph with
  click-to-jump, engine lines (SAN), move list with badges, game summary
  (accuracy, ACPL, turning points, worst moves, phase split), keyboard nav,
  autoplay.
- Opening recognition: 3,803 ECO lines, transposition-safe.
- Dashboard: score, avg accuracy/ACPL, accuracy trend, move-quality
  distribution, top openings, recent games.
- Public share pages. Auth via Clerk (Google + email/password).

### Planned: the ChessMind track (active; see §7 and [docs/ROADMAP.md](docs/ROADMAP.md))
It replaces the old M7–M9:
- **M7 → Phases 1 and 3.** Eval trust is done (ADR 008). The server Stockfish
  worker comes in Phase 3.
- **M8 → Phase 3, trimmed** to four motifs: hanging piece, fork, pin and mate
  threat.
- **M9 → Phases 3–6.** The AI coach becomes a verified multi-agent coach,
  backed by an eval study.

### Paused: product track
- **M10** Training: guess-the-best-move, puzzle generation from your blunders,
  learn-from-your-blunders spaced repetition, interactive "find the better
  move" review.
- **M11** Organizations & teams, coach/student mode, study collections.
- **M12** Stripe: Free/Pro tiers, usage quotas, webhooks, billing UI.
- **M13** Admin dashboard, programmatic API (keys, scopes, webhooks), rate
  limiting polish.
- **M14** Deployment: Docker images, production compose, CDN, monitoring,
  error tracking, CI deploy.
- **M15** Polish: offline analysis, opening explorer, heatmaps, material
  graph, richer keyboard shortcuts, accessibility, end-to-end tests.

### Out of scope (for now)
- Playing chess vs the engine / online multiplayer.
- Native mobile apps (architecture stays mobile-ready; no app this roadmap).
- Variants beyond standard chess (schema/engine allow it later).

## 5. Non-functional requirements

- **Scale target**: 100k users, millions of games. Stateless API, horizontal
  workers, EPD cache keeps engine cost sublinear (see ARCHITECTURE §8).
- **Performance**: engine off the UI thread; lazy-loaded NNUE; immutable-cached
  static assets; cursor-paginated lists; resumable/incremental analysis.
- **Quality**: TDD for domain logic; ADRs for decisions; CI runs
  lint+typecheck+test+build; no placeholder code.
- **Security/privacy**: bearer-token auth (Clerk); secrets only in env; no game
  data leaves the client unless imported/shared.

## 6. Success criteria (v0 → v1)

- A user can go signup → import → analyse → understand a game in one sitting.
- Accuracy numbers land within ~±2 of lichess's for the same game/depth.
- Famous sacrifices classify as Brilliant (validated: Kasparov–Topalov 1999
  24.Rxd4!! / 25.Re7+!!).
- Dashboard reflects real history and trends.

## 7. ChessMind: the verified coach (current direction)

**Goal.** Tempo is now primarily a public engineering portfolio and learning
project, not a product chasing users. It should be practical enough to use,
simple enough to explain in five minutes, and deep enough to learn from.

**Problem.** LLMs explain chess fluently and wrongly. They invent tactics,
misread evaluations and suggest illegal moves.

**Approach.**
- The coach's agents produce **typed claims**: a move, an evaluation or a
  motif.
- A critic verifies every claim against Stockfish and `chess-core` before
  anything reaches the user. Claims that can't be verified are dropped.
- The LLM narrates facts; it never computes them. This extends §3's
  "never invents evaluation" principle to a multi-agent system.

**Research question.** How much does each layer (tools, critic, token
optimisation) improve verified-claim rate and reduce hallucinated moves, and
what does it cost in tokens and latency? The study is reproducible: one
command, local models with pinned digests, and confidence intervals.

**Personalisation.** A small rating-conditioned transformer predicts what
players at the user's level would play, so coaching can say "most 1400s miss
this". That is the project's deep-learning component.

**Constraints.**
- **Fair play:** post-game analysis and training only, never assistance in
  live games.
- **Cost:** the LLMs are local (Ollama) or opt-in free-tier hosted models.
  The public demo runs in no-LLM mode.
- **Licensing:** GPL-3.0-or-later (ADR 009).
- **Architecture:** Python agents reach the TypeScript chess maths only
  through the chess-tools MCP server (ADR 010).
- **Scope:** every component must answer "why does this exist?" in its ADR.

Phases, gates and cut order are in [docs/ROADMAP.md](docs/ROADMAP.md).
