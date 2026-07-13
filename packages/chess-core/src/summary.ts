import { averageCentipawnLoss, gameAccuracy, type GameAccuracy } from "./accuracy.js";
import { findOpening } from "./openings.js";
import type { ClassifiedMove, MoveLabel, ParsedMove, PlayerColor } from "./types.js";

export interface ByColor<T> {
  white: T;
  black: T;
}

export interface TurningPoint {
  ply: number;
  /** White-POV win% swing across this move. */
  swing: number;
}

export interface GameSummary {
  accuracy: GameAccuracy;
  acpl: ByColor<number | null>;
  labelCounts: ByColor<Partial<Record<MoveLabel, number>>>;
  turningPoints: TurningPoint[];
  bestPly: ByColor<number | null>;
  worstPly: ByColor<number | null>;
  opening: { eco: string; name: string; lastBookPly: number } | null;
  phases: {
    /** Last ply of the opening phase. */
    openingEndPly: number;
    /** First ply of the endgame, when reached. */
    endgameStartPly: number | null;
  };
  phaseAccuracy: {
    opening: ByColor<number | null>;
    middlegame: ByColor<number | null>;
    endgame: ByColor<number | null>;
  };
}

const LABEL_RANK: Record<MoveLabel, number> = {
  brilliant: 6,
  great: 5,
  best: 4,
  excellent: 3,
  good: 2,
  book: 1,
  forced: 0,
  inaccuracy: -1,
  miss: -2,
  mistake: -3,
  blunder: -4,
};

/** Major+minor piece count from a FEN board field (endgame divider). */
function majorsAndMinors(fen: string): number {
  const board = fen.split(/\s+/)[0] ?? "";
  return (board.match(/[nbrqNBRQ]/g) ?? []).length;
}

function whitePov(move: ClassifiedMove, value: number): number {
  return move.color === "white" ? value : 100 - value;
}

function meanOrNull(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Derives the whole game report from parsed moves + per-move classification.
 * Pure: identical inputs give identical summaries on client and server.
 */
export function summarizeGame(parsed: readonly ParsedMove[], classified: readonly ClassifiedMove[]): GameSummary {
  if (parsed.length !== classified.length) {
    throw new Error(`summarizeGame: ${parsed.length} parsed moves but ${classified.length} classified`);
  }
  const plies = classified.length;

  // White-POV win% per position (index 0 = initial position).
  const whiteWinPercents: number[] = [];
  if (plies > 0) whiteWinPercents.push(whitePov(classified[0]!, classified[0]!.winBefore));
  for (const move of classified) whiteWinPercents.push(whitePov(move, move.winAfter));

  const accuracies = classified.map((m) => m.accuracy);
  const accuracy = gameAccuracy(whiteWinPercents, accuracies);
  const acpl = averageCentipawnLoss(classified.map((m) => m.cpLoss));

  const labelCounts: GameSummary["labelCounts"] = { white: {}, black: {} };
  for (const move of classified) {
    const counts = labelCounts[move.color];
    counts[move.label] = (counts[move.label] ?? 0) + 1;
  }

  // Turning points: big white-POV swings, largest first, max 5.
  const turningPoints: TurningPoint[] = classified
    .map((move) => ({
      ply: move.ply,
      swing: whiteWinPercents[move.ply]! - whiteWinPercents[move.ply - 1]!,
    }))
    .filter((t) => Math.abs(t.swing) >= 20)
    .sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing))
    .slice(0, 5)
    .sort((a, b) => a.ply - b.ply);

  const bestPly: ByColor<number | null> = { white: null, black: null };
  const worstPly: ByColor<number | null> = { white: null, black: null };
  for (const color of ["white", "black"] as PlayerColor[]) {
    const own = classified.filter((m) => m.color === color && m.label !== "book" && m.label !== "forced");
    if (own.length === 0) continue;
    bestPly[color] = own.reduce((best, m) =>
      LABEL_RANK[m.label] > LABEL_RANK[best.label] ||
      (LABEL_RANK[m.label] === LABEL_RANK[best.label] && m.cpLoss < best.cpLoss)
        ? m
        : best,
    ).ply;
    worstPly[color] = own.reduce((worst, m) => (m.cpLoss > worst.cpLoss ? m : worst)).ply;
  }

  const openingMatch = findOpening(parsed);
  const openingEndPly = openingMatch?.lastBookPly ?? Math.min(plies, 16);
  let endgameStartPly: number | null = null;
  for (const move of parsed) {
    if (majorsAndMinors(move.fenAfter) <= 6) {
      endgameStartPly = move.ply;
      break;
    }
  }

  const phaseOf = (ply: number): "opening" | "middlegame" | "endgame" => {
    if (endgameStartPly !== null && ply >= endgameStartPly) return "endgame";
    if (ply <= openingEndPly) return "opening";
    return "middlegame";
  };
  const phaseAccuracy: GameSummary["phaseAccuracy"] = {
    opening: { white: null, black: null },
    middlegame: { white: null, black: null },
    endgame: { white: null, black: null },
  };
  for (const phase of ["opening", "middlegame", "endgame"] as const) {
    for (const color of ["white", "black"] as PlayerColor[]) {
      phaseAccuracy[phase][color] = meanOrNull(
        classified.filter((m) => m.color === color && phaseOf(m.ply) === phase).map((m) => m.accuracy),
      );
    }
  }

  return {
    accuracy,
    acpl,
    labelCounts,
    turningPoints,
    bestPly,
    worstPly,
    opening: openingMatch
      ? { eco: openingMatch.opening.eco, name: openingMatch.opening.name, lastBookPly: openingMatch.lastBookPly }
      : null,
    phases: { openingEndPly, endgameStartPly },
    phaseAccuracy,
  };
}
