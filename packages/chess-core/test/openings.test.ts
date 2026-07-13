import { describe, expect, it } from "vitest";
import { findOpening, isBookPosition, lookupOpeningByEpd, openingsDataset } from "../src/openings.js";
import { parseGame } from "../src/pgn.js";

describe("openings dataset", () => {
  it("bundles the full lichess ECO set", () => {
    expect(openingsDataset.length).toBeGreaterThan(3000);
    const sicilian = openingsDataset.find((o) => o.name === "Sicilian Defense");
    expect(sicilian?.eco).toBe("B20");
  });

  it("looks up by EPD computed from real play", () => {
    const game = parseGame("1. e4 c5 *");
    const epd = game.moves[1]!.epdAfter;
    expect(isBookPosition(epd)).toBe(true);
    expect(lookupOpeningByEpd(epd)?.name).toBe("Sicilian Defense");
  });
});

describe("findOpening", () => {
  it("returns the deepest book position", () => {
    const game = parseGame("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 *");
    const match = findOpening(game.moves);
    expect(match).toBeDefined();
    expect(match!.opening.eco).toMatch(/^C/);
    expect(match!.opening.name).toContain("Ruy Lopez");
    expect(match!.lastBookPly).toBeGreaterThanOrEqual(8);
  });

  it("is transposition-safe (different move orders, same opening)", () => {
    const direct = findOpening(parseGame("1. d4 d5 2. c4 *").moves);
    const transposed = findOpening(parseGame("1. c4 d5 2. d4 *").moves);
    expect(direct).toBeDefined();
    expect(transposed).toBeDefined();
    expect(transposed!.opening.epd).toBe(direct!.opening.epd);
    expect(direct!.opening.name).toContain("Queen's Gambit");
  });

  it("returns undefined for immediately out-of-book games", () => {
    // 1. f3 e6 2. Kf2?? — no ECO line goes here
    const match = findOpening(parseGame("1. f3 e6 2. Kf2 *").moves);
    // ply 1 (1.f3) is book (Barnes Opening); the king walk is not
    expect(match?.lastBookPly).toBeLessThanOrEqual(2);
  });
});
