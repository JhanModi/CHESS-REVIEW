import { describe, expect, it } from "vitest";
import { classifyMove } from "../src/classify.js";
import { parseGame } from "../src/pgn.js";
import { isBookPosition } from "../src/openings.js";
import { summarizeGame } from "../src/summary.js";
import type { ClassifiedMove, Score } from "../src/types.js";

/**
 * Builds a plausible classified game from a PGN and a white-POV eval curve
 * (cp after each ply; index i = after ply i+1).
 */
function classifiedFromEvals(pgn: string, cpAfter: number[]): ReturnType<typeof build> {
  return build(pgn, cpAfter);
}

function build(pgn: string, cpAfter: number[]) {
  const game = parseGame(pgn);
  const parsed = game.moves;
  expect(parsed.length).toBe(cpAfter.length);
  const classified: ClassifiedMove[] = parsed.map((move, i) => {
    const evalBefore: Score = { cp: i === 0 ? 20 : cpAfter[i - 1]! };
    const evalAfter: Score = { cp: cpAfter[i]! };
    // pretend the played move was the engine choice unless the eval crashed
    const lostGround = Math.abs(cpAfter[i]! - (evalBefore.cp ?? 0)) > 50;
    return classifyMove({
      ply: move.ply,
      uci: move.uci,
      evalBefore,
      bestMoveUci: lostGround ? "0000" : move.uci,
      evalAfter,
      legalMovesBefore: move.legalMovesBefore,
      isBook: isBookPosition(move.epdAfter),
      isSacrifice: false,
    });
  });
  return { parsed, classified };
}

describe("summarizeGame", () => {
  it("produces a coherent report for a quiet game", () => {
    const { parsed, classified } = classifiedFromEvals(
      "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 *",
      [30, 25, 30, 28, 32, 30, 28, 30, 32, 30],
    );
    const summary = summarizeGame(parsed, classified);

    expect(summary.opening?.name).toContain("Ruy Lopez");
    expect(summary.accuracy.white).toBeGreaterThan(95);
    expect(summary.accuracy.black).toBeGreaterThan(95);
    expect(summary.turningPoints).toHaveLength(0);
    expect(summary.phases.openingEndPly).toBeGreaterThanOrEqual(8);
    expect(summary.phases.endgameStartPly).toBeNull();
    expect(summary.acpl.white).toBeLessThan(10);
  });

  it("detects turning points and the worst move", () => {
    const { parsed, classified } = classifiedFromEvals(
      "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 b5 5. Bb3 Na5 *",
      // white collapses on ply 9 (Bb3?? hypothetical eval crash)
      [30, 25, 30, 28, 32, 30, 28, 30, -450, -440],
    );
    const summary = summarizeGame(parsed, classified);

    expect(summary.turningPoints.length).toBeGreaterThan(0);
    expect(summary.turningPoints[0]!.ply).toBe(9);
    expect(summary.worstPly.white).toBe(9);
    expect(summary.labelCounts.white.blunder).toBe(1);
    expect(summary.accuracy.white).toBeLessThan(summary.accuracy.black!);
  });

  it("flags endgames by major/minor piece count", () => {
    // A pawn endgame from a custom position
    const { parsed, classified } = classifiedFromEvals(
      `[FEN "4k3/pppp4/8/8/8/8/4PPPP/4K3 w - - 0 1"]\n[SetUp "1"]\n\n1. Kd2 Kd8 2. Kc3 Kc8 *`,
      [0, 0, 0, 0],
    );
    const summary = summarizeGame(parsed, classified);
    expect(summary.phases.endgameStartPly).toBe(1);
    expect(summary.phaseAccuracy.endgame.white).not.toBeNull();
  });

  it("rejects mismatched inputs", () => {
    const { parsed, classified } = classifiedFromEvals("1. e4 e5 *", [30, 28]);
    expect(() => summarizeGame(parsed, classified.slice(1))).toThrow(/parsed/);
  });
});
