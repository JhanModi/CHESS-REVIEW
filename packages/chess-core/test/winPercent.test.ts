import { describe, expect, it } from "vitest";
import { povWinPercent, scoreToCp, winPercentFromCp, winPercentFromScore } from "../src/winPercent.js";

describe("winPercentFromCp (lichess model goldens)", () => {
  it("equal position is 50%", () => {
    expect(winPercentFromCp(0)).toBeCloseTo(50, 6);
  });
  it("+100cp ≈ 59.1%", () => {
    expect(winPercentFromCp(100)).toBeCloseTo(59.1, 1);
  });
  it("-100cp ≈ 40.9% (symmetry)", () => {
    expect(winPercentFromCp(-100)).toBeCloseTo(100 - winPercentFromCp(100), 6);
  });
  it("+300cp is clearly winning (~75%)", () => {
    expect(winPercentFromCp(300)).toBeGreaterThan(70);
    expect(winPercentFromCp(300)).toBeLessThan(85);
  });
  it("clamps beyond ±1000cp", () => {
    expect(winPercentFromCp(5000)).toBeCloseTo(winPercentFromCp(1000), 6);
    expect(winPercentFromCp(1000)).toBeGreaterThan(95);
  });
});

describe("winPercentFromScore", () => {
  it("mate for white = 100, mate for black = 0", () => {
    expect(winPercentFromScore({ mate: 3 })).toBe(100);
    expect(winPercentFromScore({ mate: -1 })).toBe(0);
  });
  it("cp path delegates to the model", () => {
    expect(winPercentFromScore({ cp: 0 })).toBeCloseTo(50, 6);
  });
});

describe("POV helpers", () => {
  it("inverts for black", () => {
    expect(povWinPercent(59.1, "black")).toBeCloseTo(40.9, 6);
    expect(povWinPercent(59.1, "white")).toBeCloseTo(59.1, 6);
  });
  it("scoreToCp maps mates to the clamp bound", () => {
    expect(scoreToCp({ mate: 5 })).toBe(1000);
    expect(scoreToCp({ mate: -2 })).toBe(-1000);
    expect(scoreToCp({ cp: 12345 })).toBe(1000);
    expect(scoreToCp({ cp: -37 })).toBe(-37);
  });
});
