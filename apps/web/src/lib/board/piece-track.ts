/**
 * Stable piece identity across a game, so the board can animate pieces
 * between plies (including jumps and rewinds) instead of teleporting them.
 *
 * Board state is derived by applying UCI moves from the initial position —
 * captures (incl. en passant), castling rook hops and promotions included.
 */

export type PieceColor = "w" | "b";
export type PieceRole = "p" | "n" | "b" | "r" | "q" | "k";

export interface TrackedPiece {
  /** Stable for the piece's whole lifetime. */
  id: string;
  color: PieceColor;
  role: PieceRole;
  /** 0..63, a1 = 0, h8 = 63. */
  square: number;
}

export type BoardSnapshot = TrackedPiece[];

export function squareOf(file: number, rank: number): number {
  return rank * 8 + file;
}

export function fileOf(square: number): number {
  return square % 8;
}

export function rankOf(square: number): number {
  return Math.floor(square / 8);
}

export function parseSquareName(name: string): number {
  return squareOf(name.charCodeAt(0) - 97, name.charCodeAt(1) - 49);
}

export function squareName(square: number): string {
  return `${String.fromCharCode(97 + fileOf(square))}${rankOf(square) + 1}`;
}

/** Reads the piece-placement field of a FEN into tracked pieces (fresh ids). */
export function piecesFromFen(fen: string): BoardSnapshot {
  const board = fen.trim().split(/\s+/)[0]!;
  const pieces: TrackedPiece[] = [];
  let rank = 7;
  let file = 0;
  let counter = 0;
  for (const ch of board) {
    if (ch === "/") {
      rank--;
      file = 0;
    } else if (ch >= "1" && ch <= "8") {
      file += Number(ch);
    } else {
      const color: PieceColor = ch === ch.toUpperCase() ? "w" : "b";
      const role = ch.toLowerCase() as PieceRole;
      pieces.push({ id: `${color}${role}${counter++}`, color, role, square: squareOf(file, rank) });
      file++;
    }
  }
  return pieces;
}

/**
 * Precomputes the snapshot for every ply. Index 0 = initial position,
 * index i = after ply i. Snapshots share piece ids across plies.
 */
export function buildSnapshots(initialFen: string, uciMoves: readonly string[]): BoardSnapshot[] {
  let current = piecesFromFen(initialFen);
  const snapshots: BoardSnapshot[] = [current];

  for (const uci of uciMoves) {
    const from = parseSquareName(uci.slice(0, 2));
    const to = parseSquareName(uci.slice(2, 4));
    const promotion = uci[4] as PieceRole | undefined;

    const next = current.map((p) => ({ ...p }));
    const mover = next.find((p) => p.square === from);
    if (!mover) {
      // Should not happen for server-validated games; fail soft.
      snapshots.push(next);
      current = next;
      continue;
    }

    // Castling, handling BOTH UCI encodings: standard (king moves two files,
    // e1g1/e1c1) and chessops' king-onto-own-rook (e1h1/e1a1). Handle it
    // before the capture logic so the friendly rook is never seen as captured.
    const rookAtTarget = next.some((p) => p.square === to && p.role === "r" && p.color === mover.color);
    const isCastle = mover.role === "k" && (Math.abs(fileOf(to) - fileOf(from)) === 2 || rookAtTarget);

    if (isCastle) {
      const kingside = fileOf(to) > fileOf(from);
      const rank = rankOf(from);
      const rook = next.find((p) => p.square === squareOf(kingside ? 7 : 0, rank) && p.role === "r" && p.color === mover.color);
      if (rook) rook.square = squareOf(kingside ? 5 : 3, rank);
      mover.square = squareOf(kingside ? 6 : 2, rank);
    } else {
      // Capture (incl. en passant: pawn moves diagonally onto an empty square).
      const targetIndex = next.findIndex((p) => p.square === to && p.id !== mover.id);
      if (targetIndex >= 0) {
        next.splice(targetIndex, 1);
      } else if (mover.role === "p" && fileOf(from) !== fileOf(to)) {
        const capturedSquare = squareOf(fileOf(to), rankOf(from));
        const epIndex = next.findIndex((p) => p.square === capturedSquare && p.color !== mover.color);
        if (epIndex >= 0) next.splice(epIndex, 1);
      }
      mover.square = to;
      if (promotion) mover.role = promotion;
    }

    snapshots.push(next);
    current = next;
  }
  return snapshots;
}

/** Dev-time cross-check: does a snapshot match a FEN's piece placement? */
export function snapshotMatchesFen(snapshot: BoardSnapshot, fen: string): boolean {
  const expected = piecesFromFen(fen)
    .map((p) => `${p.color}${p.role}@${p.square}`)
    .sort()
    .join(",");
  const actual = snapshot
    .map((p) => `${p.color}${p.role}@${p.square}`)
    .sort()
    .join(",");
  return expected === actual;
}
