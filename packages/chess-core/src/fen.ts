export { INITIAL_FEN, INITIAL_EPD } from "chessops/fen";

/**
 * EPD = the first four FEN fields (pieces, turn, castling, en passant).
 * Evaluations and opening positions are keyed by EPD (ADR 006).
 */
export function epdFromFen(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(" ");
}
