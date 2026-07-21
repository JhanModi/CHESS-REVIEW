import type { Score } from "@tempo/engine-core";

export type { Score };

export type PlayerColor = "white" | "black";

/** Which side played a given ply (1-based: ply 1 = White's first move). */
export function colorOfPly(ply: number): PlayerColor {
  return ply % 2 === 1 ? "white" : "black";
}

export interface ParsedMove {
  ply: number;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  epdBefore: string;
  epdAfter: string;
  /** Number of legal (from,to) pairs in the position the move was played in. */
  legalMovesBefore: number;
  clockSeconds?: number;
}

export type PgnResult = "white" | "black" | "draw" | "unknown";

export interface ParsedGame {
  headers: Record<string, string>;
  moves: ParsedMove[];
  result: PgnResult;
  initialFen: string;
}

export interface OpeningRecord {
  eco: string;
  name: string;
  pgn: string;
  epd: string;
  plyCount: number;
}

export type MoveLabel =
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "book"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "miss"
  | "forced";

export interface ClassificationThresholds {
  /**
   * Win%-loss at/below which a move that isn't the engine's #1 still clusters
   * as "best". Chess rarely has a single best move — near-ties (a few cp apart)
   * should share the top bucket rather than being split into best vs excellent.
   */
  bestMaxLoss: number;
  /** Win%-loss below which a non-best move is still "excellent". */
  excellent: number;
  /** Win%-loss bands. */
  inaccuracy: number;
  mistake: number;
  blunder: number;
  /** Min win% gap between best and second line for "great" (only move). */
  greatGap: number;
  /** "Brilliant" sacrifice: max win% loss, and sanity bounds. */
  brilliantMaxLoss: number;
  brilliantMinWinAfter: number;
  brilliantMaxWinBefore: number;
  /** "Miss": was winning ≥ missWinBefore, lost ≥ missMinLoss, still ≥ floor. */
  missWinBefore: number;
  missMinLoss: number;
  missWinAfterFloor: number;
}

export const DEFAULT_THRESHOLDS: ClassificationThresholds = {
  bestMaxLoss: 1,
  excellent: 2,
  inaccuracy: 10,
  mistake: 20,
  blunder: 30,
  greatGap: 20,
  brilliantMaxLoss: 2,
  brilliantMinWinAfter: 40,
  brilliantMaxWinBefore: 97,
  missWinBefore: 90,
  missMinLoss: 10,
  missWinAfterFloor: 40,
};

/** Everything classification needs to know about one played move. */
export interface MoveEvalContext {
  ply: number;
  uci: string;
  /** Engine eval of the position the move was played in (white POV). */
  evalBefore: Score;
  /** Engine's best move in that position, UCI. */
  bestMoveUci: string;
  /** Eval of the second-best line, when MultiPV ≥ 2 was used (white POV). */
  secondScore?: Score;
  /** Engine eval of the position after the played move (white POV). */
  evalAfter: Score;
  legalMovesBefore: number;
  isBook: boolean;
  isSacrifice: boolean;
}

export interface ClassifiedMove {
  ply: number;
  color: PlayerColor;
  label: MoveLabel;
  /** Mover-POV win% before/after the move. */
  winBefore: number;
  winAfter: number;
  /** Mover-POV centipawn loss, clamped ≥ 0. */
  cpLoss: number;
  /** Per-move accuracy, 0–100. */
  accuracy: number;
}
