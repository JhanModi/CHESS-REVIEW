import { colorOfPly, type PlayerColor } from "./types.js";

/**
 * Lichess per-move accuracy: 103.1668 · e^(−0.04354·Δwin%) − 3.1669 (+1
 * uncertainty bonus), clamped to 0–100. Δwin% is the mover's win-probability
 * loss versus best play.
 */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const loss = Math.max(0, winBefore - winAfter);
  const raw = 103.1668 * Math.exp(-0.04354 * loss) - 3.1669 + 1;
  return Math.max(0, Math.min(100, raw));
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function weightedMean(pairs: Array<{ value: number; weight: number }>): number {
  const total = pairs.reduce((a, p) => a + p.weight, 0);
  if (total === 0) return 0;
  return pairs.reduce((a, p) => a + p.value * p.weight, 0) / total;
}

function harmonicMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, v) => a + 1 / Math.max(v, 1e-6), 0);
  return values.length / sum;
}

export interface GameAccuracy {
  white: number | null;
  black: number | null;
}

/**
 * Lichess game accuracy: the average of a volatility-weighted mean and the
 * harmonic mean of move accuracies, per colour. Volatile stretches of the
 * game count more; a single collapse drags the harmonic mean down.
 *
 * @param whiteWinPercents white-POV win% for every position: index 0 = before
 *   ply 1, index i = after ply i. Length = plies + 1.
 * @param accuracies per-ply move accuracy, index i−1 = ply i.
 */
export function gameAccuracy(whiteWinPercents: number[], accuracies: number[]): GameAccuracy {
  const plies = accuracies.length;
  if (plies === 0 || whiteWinPercents.length !== plies + 1) {
    return { white: null, black: null };
  }

  const windowSize = Math.max(2, Math.min(8, Math.floor(plies / 10)));
  // weight for ply i = std-dev of the win% window ending at that position
  const weights: number[] = [];
  for (let i = 0; i < plies; i++) {
    const start = Math.max(0, i + 1 - windowSize);
    const window = whiteWinPercents.slice(start, i + 2);
    weights.push(Math.max(0.5, Math.min(12, stdDev(window))));
  }

  const result: GameAccuracy = { white: null, black: null };
  for (const color of ["white", "black"] as PlayerColor[]) {
    const pairs: Array<{ value: number; weight: number }> = [];
    const values: number[] = [];
    for (let ply = 1; ply <= plies; ply++) {
      if (colorOfPly(ply) !== color) continue;
      const accuracy = accuracies[ply - 1]!;
      pairs.push({ value: accuracy, weight: weights[ply - 1]! });
      values.push(accuracy);
    }
    if (values.length === 0) continue;
    const combined = (weightedMean(pairs) + harmonicMean(values)) / 2;
    result[color] = Math.max(0, Math.min(100, combined));
  }
  return result;
}

/** Average centipawn loss for one colour. */
export function averageCentipawnLoss(cpLosses: number[], plyOffset = 1): { white: number | null; black: number | null } {
  const byColor: Record<PlayerColor, number[]> = { white: [], black: [] };
  cpLosses.forEach((loss, i) => {
    byColor[colorOfPly(i + plyOffset)].push(Math.max(0, Math.min(1000, loss)));
  });
  const avg = (xs: number[]): number | null =>
    xs.length === 0 ? null : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  return { white: avg(byColor.white), black: avg(byColor.black) };
}
