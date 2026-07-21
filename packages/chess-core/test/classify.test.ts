import { describe, expect, it } from "vitest";
import { classifyMove } from "../src/classify.js";
import type { MoveEvalContext } from "../src/types.js";

/** A white move (ply 1) with sensible defaults, overridable per test. */
function ctx(overrides: Partial<MoveEvalContext>): MoveEvalContext {
  return {
    ply: 1,
    uci: "e2e4",
    evalBefore: { cp: 30 },
    bestMoveUci: "e2e4",
    evalAfter: { cp: 30 },
    legalMovesBefore: 20,
    isBook: false,
    isSacrifice: false,
    ...overrides,
  };
}

describe("classifyMove — label matrix", () => {
  it("book positions are book, regardless of eval", () => {
    expect(classifyMove(ctx({ isBook: true, evalAfter: { cp: -300 } })).label).toBe("book");
  });

  it("single legal move is forced", () => {
    expect(classifyMove(ctx({ legalMovesBefore: 1, uci: "g8f7", bestMoveUci: "g8f7" })).label).toBe("forced");
  });

  it("engine best move is best", () => {
    const result = classifyMove(ctx({ uci: "e2e4", bestMoveUci: "e2e4" }));
    expect(result.label).toBe("best");
    expect(result.accuracy).toBe(100);
    expect(result.cpLoss).toBe(0);
  });

  it("sound sacrifice that is best is brilliant", () => {
    expect(
      classifyMove(ctx({ isSacrifice: true, evalBefore: { cp: 100 }, evalAfter: { cp: 95 } })).label,
    ).toBe("brilliant");
  });

  it("sacrifice while completely winning is not brilliant", () => {
    // +1000cp ≈ 97.5% win — above the 97% "already winning" cutoff
    expect(
      classifyMove(ctx({ isSacrifice: true, evalBefore: { cp: 1000 }, evalAfter: { cp: 990 } })).label,
    ).toBe("best");
  });

  it("losing sacrifice is not brilliant", () => {
    const result = classifyMove(
      ctx({ isSacrifice: true, uci: "h5f7", bestMoveUci: "d1e2", evalBefore: { cp: 30 }, evalAfter: { cp: -500 } }),
    );
    expect(result.label).toBe("blunder");
  });

  it("only good move is great", () => {
    expect(
      classifyMove(
        ctx({ evalBefore: { cp: 0 }, evalAfter: { cp: 0 }, secondScore: { cp: -400 } }),
      ).label,
    ).toBe("great");
  });

  it("best move with a close second stays best", () => {
    expect(
      classifyMove(ctx({ evalBefore: { cp: 0 }, evalAfter: { cp: 0 }, secondScore: { cp: -20 } })).label,
    ).toBe("best");
  });

  it("a non-#1 move within the best cluster is still best", () => {
    // a2a3 isn't the engine's e2e4, but it's only ~0.5 win% worse — a near-tie.
    expect(
      classifyMove(ctx({ uci: "a2a3", bestMoveUci: "e2e4", evalBefore: { cp: 30 }, evalAfter: { cp: 25 } })).label,
    ).toBe("best");
  });

  it("win% bands: best-cluster / excellent / good / inaccuracy / mistake / blunder", () => {
    const at = (cpBefore: number, cpAfter: number) =>
      classifyMove(ctx({ uci: "a2a3", bestMoveUci: "e2e4", evalBefore: { cp: cpBefore }, evalAfter: { cp: cpAfter } })).label;
    expect(at(30, 25)).toBe("best"); // ~0.5 win% loss — inside the best cluster
    expect(at(0, -16)).toBe("excellent"); // ~1.5 win% loss — just outside the cluster
    expect(at(30, -30)).toBe("good"); // ~5.5 win% loss
    expect(at(200, 50)).toBe("inaccuracy"); // ~10.5 win% loss
    expect(at(300, 0)).toBe("mistake"); // ~21 win% loss
    expect(at(300, -300)).toBe("blunder"); // ~42 win% loss
  });

  it("missed mate that stays winning is a miss", () => {
    const result = classifyMove(
      ctx({ uci: "d1d2", bestMoveUci: "d1h5", evalBefore: { mate: 2 }, evalAfter: { cp: 600 } }),
    );
    expect(result.label).toBe("miss");
  });

  it("throwing away a winning position into losing is a blunder, not a miss", () => {
    const result = classifyMove(
      ctx({ uci: "d1d2", bestMoveUci: "d1h5", evalBefore: { mate: 2 }, evalAfter: { cp: -300 } }),
    );
    expect(result.label).toBe("blunder");
  });

  it("giving back a chunk of a winning advantage is a miss", () => {
    const result = classifyMove(
      ctx({ uci: "d1d2", bestMoveUci: "d1h5", evalBefore: { cp: 800 }, evalAfter: { cp: 250 } }),
    );
    expect(result.label).toBe("miss");
  });
});

describe("classifyMove — black perspective", () => {
  it("evals are inverted for black (ply 2)", () => {
    // white +200 before black's move; black blunders into +600 for white
    const result = classifyMove(
      ctx({ ply: 2, uci: "g8h6", bestMoveUci: "g8f6", evalBefore: { cp: 200 }, evalAfter: { cp: 600 } }),
    );
    expect(result.color).toBe("black");
    expect(result.winBefore).toBeLessThan(50);
    expect(result.winAfter).toBeLessThan(result.winBefore);
    expect(result.cpLoss).toBe(400);
    expect(["mistake", "blunder"]).toContain(result.label);
  });

  it("black playing the engine move is best", () => {
    const result = classifyMove(
      ctx({ ply: 2, uci: "e7e5", bestMoveUci: "e7e5", evalBefore: { cp: 30 }, evalAfter: { cp: 30 } }),
    );
    expect(result.label).toBe("best");
  });
});

describe("classifyMove — custom thresholds", () => {
  it("respects user-configured bands", () => {
    const lenient = classifyMove(
      ctx({ uci: "a2a3", bestMoveUci: "e2e4", evalBefore: { cp: 300 }, evalAfter: { cp: 0 } }),
      {
        bestMaxLoss: 1, excellent: 2, inaccuracy: 30, mistake: 45, blunder: 60, greatGap: 20,
        brilliantMaxLoss: 2, brilliantMinWinAfter: 40, brilliantMaxWinBefore: 97,
        missWinBefore: 101, missMinLoss: 10, missWinAfterFloor: 40,
      },
    );
    expect(lenient.label).toBe("good"); // ~25 win% loss < lenient 30 inaccuracy bar
  });
});
