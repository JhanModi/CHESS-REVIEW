import { describe, expect, it } from "vitest";
import {
  buildGoCommand,
  fenTurn,
  parseBestMoveLine,
  parseInfoLine,
  toWhitePov,
} from "../src/uci.js";

describe("parseInfoLine", () => {
  it("parses a full stockfish info line", () => {
    const info = parseInfoLine(
      "info depth 18 seldepth 30 multipv 1 score cp 34 nodes 1520000 nps 950000 time 1600 pv e2e4 e7e5 g1f3",
    );
    expect(info).toMatchObject({
      depth: 18,
      selDepth: 30,
      multiPv: 1,
      score: { cp: 34 },
      nodes: 1_520_000,
      nps: 950_000,
      timeMs: 1600,
      pv: ["e2e4", "e7e5", "g1f3"],
    });
  });

  it("parses mate scores", () => {
    const info = parseInfoLine("info depth 12 score mate -3 pv h7h8q");
    expect(info?.score).toEqual({ mate: -3 });
  });

  it("marks bound scores", () => {
    const info = parseInfoLine("info depth 20 score cp 55 lowerbound nodes 99 pv e2e4");
    expect(info?.score).toEqual({ cp: 55, bound: "lower" });
  });

  it("returns null for non-info lines", () => {
    expect(parseInfoLine("bestmove e2e4")).toBeNull();
  });

  it("survives unknown tokens", () => {
    const info = parseInfoLine("info depth 5 currmove e2e4 currmovenumber 1 score cp 10 pv e2e4");
    expect(info?.depth).toBe(5);
    expect(info?.score).toEqual({ cp: 10 });
  });
});

describe("parseBestMoveLine", () => {
  it("parses bestmove with ponder", () => {
    expect(parseBestMoveLine("bestmove e2e4 ponder e7e5")).toBe("e2e4");
  });
  it("returns null for (none)", () => {
    expect(parseBestMoveLine("bestmove (none)")).toBeNull();
  });
});

describe("score POV normalisation", () => {
  const blackToMove = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
  it("negates cp when black is to move", () => {
    expect(fenTurn(blackToMove)).toBe("black");
    expect(toWhitePov({ cp: 42 }, "black")).toEqual({ cp: -42 });
    expect(toWhitePov({ cp: 42 }, "white")).toEqual({ cp: 42 });
  });
  it("negates mate when black is to move", () => {
    expect(toWhitePov({ mate: 2 }, "black")).toEqual({ mate: -2 });
  });
});

describe("buildGoCommand", () => {
  it("prefers depth", () => {
    expect(buildGoCommand({ depth: 18 })).toBe("go depth 18");
  });
  it("supports movetime", () => {
    expect(buildGoCommand({ moveTimeMs: 500 })).toBe("go movetime 500");
  });
  it("throws without either", () => {
    expect(() => buildGoCommand({})).toThrow();
  });
});
