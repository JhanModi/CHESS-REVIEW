import type { Position } from "chessops/chess";
import { makeFen } from "chessops/fen";
import { parseComment, parsePgn, startingPosition } from "chessops/pgn";
import { parseSan } from "chessops/san";
import type { Move } from "chessops/types";
import { makeSquare, makeUci, squareFile, squareRank } from "chessops/util";
import type { ParsedGame, ParsedMove, PgnResult } from "./types.js";

/**
 * chessops encodes castling as the king moving onto its own rook's square
 * (e1a1 / e1h1). Convert those to standard UCI (e1c1 / e1g1) so the played
 * move matches the engine's own-UCI convention (important for classification)
 * and renders correctly on the board. Must be called BEFORE `pos.play(move)`.
 */
function toStandardUci(pos: Position, move: Move): string {
  if ("from" in move) {
    const piece = pos.board.get(move.from);
    const target = pos.board.get(move.to);
    if (piece?.role === "king" && target?.role === "rook" && target.color === piece.color) {
      const kingside = squareFile(move.to) > squareFile(move.from);
      const kingTo = squareRank(move.from) * 8 + (kingside ? 6 : 2);
      return makeSquare(move.from) + makeSquare(kingTo);
    }
  }
  return makeUci(move);
}

export class PgnParseError extends Error {
  constructor(
    message: string,
    readonly gameIndex: number,
    readonly ply?: number,
  ) {
    super(message);
    this.name = "PgnParseError";
  }
}

function resultFromHeader(result: string | undefined): PgnResult {
  switch (result) {
    case "1-0":
      return "white";
    case "0-1":
      return "black";
    case "1/2-1/2":
      return "draw";
    default:
      return "unknown";
  }
}

function countLegalMoves(dests: Map<number, Iterable<number>>): number {
  let count = 0;
  for (const [, targets] of dests) {
    for (const _ of targets) count++;
  }
  return count;
}

/**
 * Parses a PGN string (possibly containing multiple games) and replays each
 * game's mainline, producing per-ply FEN/EPD snapshots. Variations and
 * comments are preserved in the raw PGN; analysis runs on the mainline.
 *
 * Throws PgnParseError on illegal moves or unplayable starting positions.
 */
export function parseGames(pgnText: string): ParsedGame[] {
  const games = parsePgn(pgnText);
  return games.map((game, gameIndex) => {
    const posResult = startingPosition(game.headers);
    if (posResult.isErr) {
      throw new PgnParseError(`Game ${gameIndex + 1}: invalid starting position (${posResult.error.message})`, gameIndex);
    }
    const pos = posResult.unwrap();
    const initialFen = makeFen(pos.toSetup());
    const moves: ParsedMove[] = [];
    let ply = 0;

    for (const node of game.moves.mainline()) {
      ply++;
      const move = parseSan(pos, node.san);
      if (!move) {
        throw new PgnParseError(`Game ${gameIndex + 1}: illegal move "${node.san}" at ply ${ply}`, gameIndex, ply);
      }
      const fenBefore = makeFen(pos.toSetup());
      const epdBefore = makeFen(pos.toSetup(), { epd: true });
      const legalMovesBefore = countLegalMoves(pos.allDests());

      let clockSeconds: number | undefined;
      for (const comment of node.comments ?? []) {
        const parsed = parseComment(comment);
        if (parsed.clock !== undefined) clockSeconds = Math.round(parsed.clock);
      }

      const uci = toStandardUci(pos, move);
      pos.play(move);
      moves.push({
        ply,
        san: node.san,
        uci,
        fenBefore,
        fenAfter: makeFen(pos.toSetup()),
        epdBefore,
        epdAfter: makeFen(pos.toSetup(), { epd: true }),
        legalMovesBefore,
        clockSeconds,
      });
    }

    return {
      headers: Object.fromEntries(game.headers),
      moves,
      result: resultFromHeader(game.headers.get("Result")),
      initialFen,
    };
  });
}

/** Parses exactly one game; throws if the text contains none. */
export function parseGame(pgnText: string): ParsedGame {
  const games = parseGames(pgnText);
  const first = games[0];
  if (!first) throw new PgnParseError("No game found in PGN", 0);
  return first;
}
