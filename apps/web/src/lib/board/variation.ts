import { Chess } from "chessops/chess";
import { makeFen, parseFen } from "chessops/fen";
import { makeSanAndPlay } from "chessops/san";
import { parseUci } from "chessops/util";

export interface VariationStep {
  uci: string;
  san: string;
  fenAfter: string;
}

/** How many variation moves we ever play back (PVs are stored longer). */
export const MAX_VARIATION_MOVES = 12;

/**
 * Replays a UCI line from a starting FEN, producing SAN + FEN per step.
 * Stops silently at the first illegal/unparseable move — stored PVs come from
 * the engine and are trusted, but a truncated tail must never crash playback.
 * Pure: safe to unit-test and to call from the store.
 */
export function replayLine(fen: string, ucis: readonly string[], maxMoves = MAX_VARIATION_MOVES): VariationStep[] {
  try {
    const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
    const steps: VariationStep[] = [];
    for (const uci of ucis.slice(0, maxMoves)) {
      const move = parseUci(uci);
      if (!move || !pos.isLegal(move)) break;
      const san = makeSanAndPlay(pos, move);
      steps.push({ uci, san, fenAfter: makeFen(pos.toSetup()) });
    }
    return steps;
  } catch {
    return [];
  }
}

/** SAN of a single move in a position, or null if it doesn't apply. */
export function sanOfUci(fen: string, uci: string): string | null {
  return replayLine(fen, [uci], 1)[0]?.san ?? null;
}
