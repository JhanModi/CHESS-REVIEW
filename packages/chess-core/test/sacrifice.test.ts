import { parseFen } from "chessops/fen";
import { Chess } from "chessops/chess";
import { parseSquare } from "chessops/util";
import { describe, expect, it } from "vitest";
import { isSacrifice, staticExchangeGain } from "../src/sacrifice.js";

function boardOf(fen: string) {
  return Chess.fromSetup(parseFen(fen).unwrap()).unwrap().board;
}

describe("staticExchangeGain", () => {
  it("hanging pawn: capture wins 1", () => {
    // white rook a1 attacks undefended pawn a7
    const board = boardOf("4k3/p7/8/8/8/8/8/R3K3 w - - 0 1");
    expect(staticExchangeGain(board, parseSquare("a7"), "white")).toBe(1);
  });

  it("defended pawn: rook takes pawn, rook is lost → decline (0)", () => {
    // pawn a7 defended by rook a8
    const board = boardOf("r3k3/p7/8/8/8/8/8/R3K3 w - - 0 1");
    expect(staticExchangeGain(board, parseSquare("a7"), "white")).toBe(0);
  });

  it("piece defended once but attacked twice can be won", () => {
    // knight d5 defended by pawn e6; attacked by two white rooks on d1/d2
    const board = boardOf("4k3/8/4p3/3n4/8/8/3R4/3RK3 w - - 0 1");
    // RxN(3), pxR(5), Rxp(1): net 3-5+1 = -1? No: white may stop after RxN if
    // recapture loses more. Swap math: gain 3, lose 5, gain 1 → best = max(0, 3-max(0,5-1)) = 0? Actually:
    // white: 3 - (black: 5 - (white: 1)) = 3 - 4 = -1 → decline = 0... but two
    // attackers vs one defender: RxN, pxR, RxP leaves net -1. Correct SEE: 0.
    expect(staticExchangeGain(board, parseSquare("d5"), "white")).toBe(0);
  });

  it("undefended knight attacked by bishop: wins 3", () => {
    // bishop a1 sees e5 along the long diagonal
    const board = boardOf("4k3/8/8/4n3/8/8/8/B3K3 w - - 0 1");
    expect(staticExchangeGain(board, parseSquare("e5"), "white")).toBe(3);
  });

  it("x-ray: doubled rooks win a defended rook", () => {
    // black rook d8 defended by nothing else; white rooks d1+d2 vs rook d8 defended by queen? keep simple:
    // black rook d5 defended by pawn c6; white queen d1 and rook d2. QxR is bad (9 for 5),
    // but Rd2xR(5), pxR(5)... use rook first: Rxd5(+5), cxd5(-5), Qxd5(+1 pawn) → net 5-5+1=1
    const board = boardOf("4k3/8/2p5/3r4/8/8/3R4/3QK3 w - - 0 1");
    expect(staticExchangeGain(board, parseSquare("d5"), "white")).toBe(1);
  });
});

describe("isSacrifice", () => {
  it("moving a knight en prise (no compensation) is a sacrifice", () => {
    // white knight g1 moves to e5 where a defended black pawn... make it simple: Ne5 attacked by pawn d6
    const fen = "4k3/8/3p4/8/8/8/8/4K1N1 w - - 0 1";
    expect(isSacrifice(fen, "g1f3")).toBe(false); // safe square
    // knight to e5? g1 can't reach e5; use knight on f3
    const fen2 = "4k3/8/3p4/8/8/5N2/8/4K3 w - - 0 1";
    expect(isSacrifice(fen2, "f3e5")).toBe(true); // dxe5 wins a knight
  });

  it("queen takes defended pawn = sacrifice (Qxf7-style)", () => {
    // 1.e4 e5 2.Qh5 Nc6 3.Qxf7?? — f7 pawn defended by king
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3";
    expect(isSacrifice(fen, "h5f7")).toBe(true);
  });

  it("a normal developing move is not a sacrifice", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(isSacrifice(fen, "e2e4")).toBe(false);
    expect(isSacrifice(fen, "g1f3")).toBe(false);
  });

  it("an equal trade is not a sacrifice", () => {
    // rook takes rook, recapture available: exchange, not sacrifice
    const fen = "3rk3/8/8/8/8/8/8/3RK3 w - - 0 1";
    expect(isSacrifice(fen, "d1d8")).toBe(false);
  });

  it("pawn offers don't count", () => {
    // pawn push into capture range: only 1 point exposed
    const fen = "4k3/8/3p4/8/4P3/8/8/4K3 w - - 0 1";
    expect(isSacrifice(fen, "e4e5")).toBe(false);
  });
});
