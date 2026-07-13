import { attacks } from "chessops/attacks";
import { Chess } from "chessops/chess";
import { parseFen } from "chessops/fen";
import type { Board } from "chessops/board";
import type { SquareSet } from "chessops/squareSet";
import type { Color, Role, Square } from "chessops/types";
import { isNormal } from "chessops/types";
import { opposite, parseUci } from "chessops/util";

const PIECE_VALUES: Record<Role, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 99,
};

function leastValuableAttacker(
  board: Board,
  target: Square,
  color: Color,
  occupied: SquareSet,
): Square | undefined {
  let best: { sq: Square; value: number } | undefined;
  for (const sq of board[color].intersect(occupied)) {
    const piece = board.get(sq);
    if (!piece || !attacks(piece, sq, occupied).has(target)) continue;
    const value = PIECE_VALUES[piece.role];
    if (!best || value < best.value) best = { sq, value };
  }
  return best?.sq;
}

/**
 * Static exchange evaluation: material `attackerColor` wins by starting the
 * capture sequence on `target`, both sides capturing with their least
 * valuable attacker and free to stop. ≥ 0 (declining is always allowed).
 * X-rays are handled by recomputing attacks on the shrinking occupancy;
 * pins and en passant are ignored — fine for sacrifice *detection*.
 */
export function staticExchangeGain(board: Board, target: Square, attackerColor: Color): number {
  const victim = board.get(target);
  if (!victim) return 0;

  let occupied = board.occupied;
  const gains: number[] = [];
  let victimValue = PIECE_VALUES[victim.role];
  let side = attackerColor;

  for (;;) {
    const from = leastValuableAttacker(board, target, side, occupied);
    if (from === undefined) break;
    const attacker = board.get(from)!;
    gains.push(victimValue);
    if (victimValue === PIECE_VALUES.king) break; // "captured" a king: sequence is illegal beyond here
    victimValue = PIECE_VALUES[attacker.role];
    occupied = occupied.without(from);
    side = opposite(side);
  }

  let net = 0;
  for (let i = gains.length - 1; i >= 0; i--) {
    net = Math.max(0, gains[i]! - net);
  }
  return net;
}

/** Biggest material gain `attackerColor` can take from `victimColor` right now. */
function maxExposure(board: Board, victimColor: Color, attackerColor: Color): number {
  let max = 0;
  for (const sq of board[victimColor]) {
    const piece = board.get(sq);
    if (!piece || piece.role === "king") continue;
    max = Math.max(max, staticExchangeGain(board, sq, attackerColor));
  }
  return max;
}

/**
 * Does this move deliberately give up material? True when, after the move,
 * the opponent can win ≥ 2 points more (net of anything the move captured)
 * than they could before it — a piece left en prise, an under-compensated
 * capture, an exchange sac. Pawn-only offers don't count (chess.com-style
 * "brilliant" requires a piece sacrifice).
 */
export function isSacrifice(fenBefore: string, uci: string): boolean {
  try {
    const setup = parseFen(fenBefore).unwrap();
    const pos = Chess.fromSetup(setup).unwrap();
    const move = parseUci(uci);
    if (!move || !isNormal(move)) return false;

    const mover = pos.turn;
    const opponent = opposite(mover);
    const capturedPiece = pos.board.get(move.to);
    const capturedValue = capturedPiece ? PIECE_VALUES[capturedPiece.role] : 0;

    const exposureBefore = maxExposure(pos.board, mover, opponent);
    pos.play(move);
    const exposureAfter = maxExposure(pos.board, mover, opponent);

    return exposureAfter - capturedValue >= 2 && exposureAfter > exposureBefore;
  } catch {
    return false;
  }
}
