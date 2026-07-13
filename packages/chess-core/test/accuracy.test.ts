import { describe, expect, it } from "vitest";
import { averageCentipawnLoss, gameAccuracy, moveAccuracy } from "../src/accuracy.js";

describe("moveAccuracy", () => {
  it("no loss = 100", () => {
    expect(moveAccuracy(50, 50)).toBe(100);
    expect(moveAccuracy(50, 60)).toBe(100); // gaining is capped at 100
  });
  it("10% loss ≈ 64.6", () => {
    expect(moveAccuracy(60, 50)).toBeCloseTo(103.1668 * Math.exp(-0.04354 * 10) - 3.1669 + 1, 6);
    expect(moveAccuracy(60, 50)).toBeGreaterThan(60);
    expect(moveAccuracy(60, 50)).toBeLessThan(70);
  });
  it("catastrophic loss approaches 0", () => {
    expect(moveAccuracy(99, 1)).toBeLessThan(3);
    expect(moveAccuracy(100, 0)).toBeGreaterThanOrEqual(0);
  });
  it("monotonically decreasing in loss", () => {
    let prev = 101;
    for (const loss of [0, 5, 10, 20, 30, 50, 80]) {
      const acc = moveAccuracy(90, 90 - loss);
      expect(acc).toBeLessThan(prev);
      prev = acc;
    }
  });
});

describe("gameAccuracy", () => {
  it("perfect play on both sides ≈ 100", () => {
    const plies = 30;
    const winPercents = Array.from({ length: plies + 1 }, () => 50);
    const accuracies = Array.from({ length: plies }, () => 100);
    const result = gameAccuracy(winPercents, accuracies);
    expect(result.white).toBeGreaterThan(99);
    expect(result.black).toBeGreaterThan(99);
  });

  it("one side blundering scores lower than the clean side", () => {
    const plies = 20;
    const winPercents: number[] = [50];
    const accuracies: number[] = [];
    for (let ply = 1; ply <= plies; ply++) {
      if (ply % 2 === 0 && ply % 6 === 0) {
        // black blunders every third move pair
        winPercents.push(winPercents.at(-1)! + 25);
        accuracies.push(20);
      } else {
        winPercents.push(winPercents.at(-1)!);
        accuracies.push(98);
      }
    }
    const result = gameAccuracy(winPercents, accuracies);
    expect(result.white).toBeGreaterThan(90);
    expect(result.black).toBeLessThan(75);
    expect(result.black).toBeGreaterThan(0);
  });

  it("returns nulls for empty games or length mismatches", () => {
    expect(gameAccuracy([50], [])).toEqual({ white: null, black: null });
    expect(gameAccuracy([50, 50], [100, 100])).toEqual({ white: null, black: null });
  });
});

describe("averageCentipawnLoss", () => {
  it("splits by colour (odd plies = white)", () => {
    const result = averageCentipawnLoss([10, 100, 20, 200]);
    expect(result.white).toBe(15);
    expect(result.black).toBe(150);
  });
  it("handles empty input", () => {
    expect(averageCentipawnLoss([])).toEqual({ white: null, black: null });
  });
});
