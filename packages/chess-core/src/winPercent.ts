import type { PlayerColor, Score } from "./types.js";

/** Centipawn clamp bound used by the win% model and cpLoss (lichess model). */
export const CP_CEILING = 1000;

/**
 * Lichess win-probability model (lichess.org/page/accuracy):
 * Win% = 50 + 50 · (2 / (1 + e^(−0.00368208·cp)) − 1), cp clamped to ±1000.
 * White POV in, white POV out.
 */
export function winPercentFromCp(cp: number): number {
  const clamped = Math.max(-CP_CEILING, Math.min(CP_CEILING, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

/** Mate scores collapse to certainty. White POV. */
export function winPercentFromScore(score: Score): number {
  if (score.mate !== undefined) return score.mate > 0 ? 100 : 0;
  return winPercentFromCp(score.cp ?? 0);
}

/** Convert a white-POV win% to the given side's perspective. */
export function povWinPercent(whiteWinPercent: number, color: PlayerColor): number {
  return color === "white" ? whiteWinPercent : 100 - whiteWinPercent;
}

/** Collapse a Score to clamped centipawns (mate → ±1000). White POV. */
export function scoreToCp(score: Score): number {
  if (score.mate !== undefined) return score.mate > 0 ? CP_CEILING : -CP_CEILING;
  return Math.max(-CP_CEILING, Math.min(CP_CEILING, score.cp ?? 0));
}

/** Convert a white-POV cp value to the given side's perspective. */
export function povCp(cp: number, color: PlayerColor): number {
  return color === "white" ? cp : -cp;
}
