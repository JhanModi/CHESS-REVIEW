import { describe, expect, it } from "vitest";
import { parseGame, parseGames, PgnParseError } from "../src/pgn.js";

const SIMPLE = `[Event "Test"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`;

describe("parseGames", () => {
  it("parses a simple game with headers and result", () => {
    const game = parseGame(SIMPLE);
    expect(game.headers.Event).toBe("Test");
    expect(game.result).toBe("white");
    expect(game.moves).toHaveLength(6);
    expect(game.moves[0]).toMatchObject({ ply: 1, san: "e4", uci: "e2e4" });
    expect(game.moves[5]).toMatchObject({ ply: 6, san: "a6", uci: "a7a6" });
  });

  it("produces consistent FEN/EPD chains", () => {
    const game = parseGame(SIMPLE);
    for (let i = 1; i < game.moves.length; i++) {
      expect(game.moves[i]!.fenBefore).toBe(game.moves[i - 1]!.fenAfter);
    }
    // EPD is the FEN without move counters
    const move = game.moves[2]!;
    expect(move.fenAfter.startsWith(move.epdAfter)).toBe(true);
    expect(move.epdAfter.split(" ")).toHaveLength(4);
  });

  it("extracts clock comments", () => {
    const game = parseGame(`1. e4 {[%clk 0:02:59]} e5 {[%clk 0:02:58]} 2. Nf3 *`);
    expect(game.moves[0]!.clockSeconds).toBe(179);
    expect(game.moves[1]!.clockSeconds).toBe(178);
    expect(game.moves[2]!.clockSeconds).toBeUndefined();
  });

  it("ignores variations, keeps the mainline", () => {
    const game = parseGame(`1. e4 (1. d4 d5) 1... e5 2. Nf3 (2. f4 exf4) 2... Nc6 *`);
    expect(game.moves.map((m) => m.san)).toEqual(["e4", "e5", "Nf3", "Nc6"]);
  });

  it("handles castling, en passant and promotion", () => {
    const game = parseGame(
      `1. e4 Nf6 2. e5 d5 3. exd6 e6 4. dxc7 Bd7 5. cxb8=Q Rxb8 6. Nf3 Be7 7. Bc4 O-O 8. O-O *`,
    );
    const sans = game.moves.map((m) => m.san);
    expect(sans).toContain("exd6"); // en passant
    expect(sans).toContain("cxb8=Q"); // promotion
    expect(game.moves.find((m) => m.san === "cxb8=Q")!.uci).toBe("c7b8q");
    expect(game.moves.find((m) => m.san === "O-O" && m.ply === 15)!.uci).toMatch(/^e1[gh]1$/);
  });

  it("splits multi-game files", () => {
    const games = parseGames(`${SIMPLE}\n\n[Event "Second"]\n[Result "0-1"]\n\n1. d4 d5 0-1`);
    expect(games).toHaveLength(2);
    expect(games[1]!.headers.Event).toBe("Second");
    expect(games[1]!.result).toBe("black");
  });

  it("supports a custom starting position via FEN header", () => {
    const game = parseGame(
      `[FEN "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1"]\n[SetUp "1"]\n\n1. Kd6 Kd8 2. e6 Ke8 3. e7 *`,
    );
    expect(game.initialFen).toBe("4k3/8/4K3/4P3/8/8/8/8 w - - 0 1");
    expect(game.moves).toHaveLength(5);
  });

  it("counts legal moves for forced-move detection", () => {
    // After 1. e4 e5 2. Qh5 Nc6 3. Qxf7+ black's only legal move is Kxf7
    const game = parseGame(`1. e4 e5 2. Qh5 Nc6 3. Qxf7+ Kxf7 *`);
    expect(game.moves[5]!.legalMovesBefore).toBe(1);
    expect(game.moves[0]!.legalMovesBefore).toBe(20);
  });

  it("throws a helpful error on illegal moves", () => {
    expect(() => parseGame(`1. e4 e5 2. Ke2 Qh4#`)).not.toThrow();
    expect(() => parseGame(`1. e4 e4`)).toThrow(PgnParseError);
    try {
      parseGame(`1. e4 e4`);
    } catch (err) {
      expect((err as PgnParseError).ply).toBe(2);
    }
  });
});
