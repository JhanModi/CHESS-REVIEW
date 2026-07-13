import { beforeEach, describe, expect, it } from "vitest";
import type { GameDetailDto, MoveDto } from "@tempo/types";
import { replayLine } from "@/lib/board/variation";
import { STANDARD_INITIAL_FEN, currentFen, useReviewStore } from "@/stores/review-store";

/** Builds a real GameDetailDto by replaying UCI moves from the start. */
function fixtureGame(ucis: string[]): GameDetailDto {
  const steps = replayLine(STANDARD_INITIAL_FEN, ucis, 99);
  expect(steps).toHaveLength(ucis.length);
  const moves: MoveDto[] = steps.map((step, i) => ({
    ply: i + 1,
    san: step.san,
    uci: step.uci,
    fenAfter: step.fenAfter,
    epdAfter: step.fenAfter.split(" ").slice(0, 4).join(" "),
    clockSeconds: null,
  }));
  return {
    id: "test-game",
    source: "PASTE",
    whiteName: "White",
    blackName: "Black",
    whiteElo: null,
    blackElo: null,
    userColor: null,
    result: "UNKNOWN",
    timeControl: null,
    eco: null,
    openingName: null,
    playedAt: null,
    createdAt: new Date().toISOString(),
    analysisStatus: null,
    userAccuracy: null,
    pgn: "",
    initialFen: null,
    shareSlug: null,
    moves,
    analysis: null,
  };
}

const GAME = fixtureGame(["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"]);

beforeEach(() => {
  useReviewStore.getState().setGame(GAME);
});

describe("variation mode", () => {
  it("enters a variation from the position before the studied move, synchronously", () => {
    const store = useReviewStore.getState();
    store.goTo(3); // after 2.Nf3
    // Study move 3 (Nf3): preview an alternative line from the position before it.
    store.enterVariation(3, ["d2d4", "e5d4"]);

    const state = useReviewStore.getState();
    expect(state.variation).not.toBeNull();
    expect(state.variation!.baseFen).toBe(GAME.moves[1]!.fenAfter); // after 1...e5
    expect(state.variation!.steps.map((s) => s.san)).toEqual(["d4", "exd4"]);
    expect(state.variation!.snapshots).toHaveLength(3); // base + 2 moves
    expect(state.variation!.cursor).toBe(0);
    expect(state.variation!.playing).toBe(true);
  });

  it("steps through the stored line exactly and clamps at the ends", () => {
    const store = useReviewStore.getState();
    store.enterVariation(3, ["d2d4", "e5d4"], false);
    store.variationNext();
    expect(useReviewStore.getState().variation!.cursor).toBe(1);
    store.variationNext();
    expect(useReviewStore.getState().variation!.cursor).toBe(2);
    store.variationNext(); // past the end → stays, stops playing
    expect(useReviewStore.getState().variation!.cursor).toBe(2);
    store.variationPrev();
    store.variationPrev();
    store.variationPrev(); // below 0 → clamps
    expect(useReviewStore.getState().variation!.cursor).toBe(0);
  });

  it("exit restores the original game move", () => {
    const store = useReviewStore.getState();
    store.goTo(3);
    store.enterVariation(3, ["d2d4"]);
    useReviewStore.getState().exitVariation();
    const state = useReviewStore.getState();
    expect(state.variation).toBeNull();
    expect(state.currentPly).toBe(3);
    expect(currentFen(state)).toBe(GAME.moves[2]!.fenAfter);
  });

  it("game navigation leaves variation mode", () => {
    const store = useReviewStore.getState();
    store.enterVariation(2, ["c7c5"]); // black to move after 1.e4
    expect(useReviewStore.getState().variation).not.toBeNull();
    store.goTo(4);
    expect(useReviewStore.getState().variation).toBeNull();
    expect(useReviewStore.getState().currentPly).toBe(4);
  });

  it("next/prev route to the variation while it is open", () => {
    const store = useReviewStore.getState();
    store.goTo(2);
    store.enterVariation(2, ["c7c5", "g1f3"], false); // black to move after 1.e4
    store.next();
    expect(useReviewStore.getState().variation!.cursor).toBe(1);
    store.prev();
    expect(useReviewStore.getState().variation!.cursor).toBe(0);
    // still in variation; game ply untouched
    expect(useReviewStore.getState().variation).not.toBeNull();
    expect(useReviewStore.getState().currentPly).toBe(2);
  });

  it("rejects unplayable lines and out-of-range plies without changing state", () => {
    const store = useReviewStore.getState();
    store.enterVariation(1, ["e2e5"]); // illegal from the initial position
    expect(useReviewStore.getState().variation).toBeNull();
    store.enterVariation(99, ["e2e4"]);
    expect(useReviewStore.getState().variation).toBeNull();
  });

  it("replays from the start when resuming a finished line", () => {
    const store = useReviewStore.getState();
    store.enterVariation(1, ["e2e4"], false);
    store.variationNext();
    expect(useReviewStore.getState().variation!.cursor).toBe(1);
    store.setVariationPlaying(true); // at end → restart
    expect(useReviewStore.getState().variation!.cursor).toBe(0);
    expect(useReviewStore.getState().variation!.playing).toBe(true);
  });
});
