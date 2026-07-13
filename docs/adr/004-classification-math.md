# ADR 004 — Move classification and accuracy mathematics

- Status: accepted
- Date: 2026-07-13

## Context

Move quality labels and accuracy percentages must be principled, reproducible,
and tunable. Lichess publishes its accuracy model (lichess.org/page/accuracy,
scalachess `WinPercent`/`AccuracyPercent`); move-label taxonomies like
"Brilliant" are product conventions popularised by commercial sites. We adopt
the published math and define our own label rules on top.

## Decision

All formulas live in `@tempo/chess-core` as pure functions with golden tests.

1. **Win probability**: `win% = 50 + 50 · (2/(1+e^(−0.00368208·cp)) − 1)`,
   cp clamped to ±1000; mate scores map to 0/100.
2. **Move accuracy**: `103.1668 · e^(−0.04354·Δwin%) − 3.1669`, clamped 0–100,
   where Δwin% is the mover's win-probability loss vs the engine's best move.
3. **Game accuracy**: mean of (a) volatility-weighted mean (weights = rolling
   std-dev of win%, window 2–8 plies, clamped 0.5–12) and (b) harmonic mean of
   move accuracies.
4. **Threshold bands** on win% loss (defaults, user-configurable):
   Inaccuracy ≥ 10, Mistake ≥ 20, Blunder ≥ 30.
5. **Label precedence** (first match wins):
   `Book` (position in ECO table) → `Forced` (single legal move) →
   `Brilliant` (best/near-best + sound material sacrifice + not losing after) →
   `Great` (only good move by MultiPV-2 gap, or converts a lost/drawn eval) →
   `Best` (matches engine PV1) → `Miss` (opponent-gifted win/mate not taken) →
   threshold band → `Excellent` / `Good` by remaining win% loss.
6. Analysis runs with **MultiPV = 2** so only-move detection and Miss detection
   have the second-best line available.

## Consequences

- Accuracy numbers are comparable with lichess's published model (±small
  engine-depth variance) — a trust anchor for users.
- Thresholds are injected, not hard-coded: per-user settings and future A/B
  tuning need no code change.
- Server recomputes labels from raw evals (ADR 007), so a labelling bug is
  fixable by re-running classification without re-running engines.
