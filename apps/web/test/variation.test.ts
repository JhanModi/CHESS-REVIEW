import { describe, expect, it } from "vitest";
import { replayLine, sanOfUci, MAX_VARIATION_MOVES } from "@/lib/board/variation";
import { STANDARD_INITIAL_FEN } from "@/stores/review-store";

describe("replayLine", () => {
  it("replays a legal line with SAN and a consistent FEN chain", () => {
    const steps = replayLine(STANDARD_INITIAL_FEN, ["e2e4", "e7e5", "g1f3", "b8c6"]);
    expect(steps.map((s) => s.san)).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    expect(steps[0]!.fenAfter).toContain(" b "); // black to move after e4
    expect(steps[3]!.fenAfter.split(" ")[0]).toBe("r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R");
  });

  it("truncates at the first illegal move instead of throwing", () => {
    const steps = replayLine(STANDARD_INITIAL_FEN, ["e2e4", "e7e5", "e4e5"]); // e4e5 blocked
    expect(steps).toHaveLength(2);
  });

  it("renders castling and promotion correctly", () => {
    const castled = replayLine("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", ["e1g1", "e8c8"]);
    expect(castled.map((s) => s.san)).toEqual(["O-O", "O-O-O"]);
    const promoted = replayLine("8/P6k/8/8/8/8/8/K7 w - - 0 1", ["a7a8q"]);
    expect(promoted[0]!.san).toBe("a8=Q");
  });

  it("caps line length", () => {
    const long = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? "g1f3" : "g8f6")).map((uci, i) =>
      i % 4 < 2 ? uci : uci === "g1f3" ? "f3g1" : "f6g8",
    );
    const steps = replayLine(STANDARD_INITIAL_FEN, long);
    expect(steps.length).toBeLessThanOrEqual(MAX_VARIATION_MOVES);
  });

  it("returns [] on garbage input", () => {
    expect(replayLine("not a fen", ["e2e4"])).toEqual([]);
    expect(replayLine(STANDARD_INITIAL_FEN, ["zzzz"])).toEqual([]);
  });
});

describe("sanOfUci", () => {
  it("names a single move", () => {
    expect(sanOfUci(STANDARD_INITIAL_FEN, "g1f3")).toBe("Nf3");
  });
  it("returns null for illegal moves", () => {
    expect(sanOfUci(STANDARD_INITIAL_FEN, "e2e5")).toBeNull();
  });
});
