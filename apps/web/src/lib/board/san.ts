import { Chess } from "chessops/chess";
import { parseFen } from "chessops/fen";
import { makeSanAndPlay } from "chessops/san";
import { parseUci } from "chessops/util";

/** Renders a UCI principal variation as SAN from a starting FEN. */
export function pvToSan(fen: string, pvUci: string[], maxMoves = 8): string {
  try {
    const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
    const sans: string[] = [];
    for (const uci of pvUci.slice(0, maxMoves)) {
      const move = parseUci(uci);
      if (!move || !pos.isLegal(move)) break;
      const fullmove = pos.fullmoves;
      const prefix = pos.turn === "white" ? `${fullmove}.` : sans.length === 0 ? `${fullmove}…` : "";
      sans.push(`${prefix}${makeSanAndPlay(pos, move)}`);
    }
    return sans.join(" ");
  } catch {
    return pvUci.slice(0, maxMoves).join(" ");
  }
}
