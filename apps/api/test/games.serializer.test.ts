import { describe, expect, it } from "vitest";
import { toAnalysisDto, toListItem, type GameWithMeta } from "../src/games/games.serializer.js";

function fakeGame(overrides: Partial<GameWithMeta> = {}): GameWithMeta {
  return {
    id: "g1",
    userId: "u1",
    source: "LICHESS",
    externalId: "abc",
    shareSlug: null,
    pgn: "1. e4 *",
    whiteName: "alice",
    blackName: "bob",
    whiteElo: 1500,
    blackElo: 1600,
    userColor: "BLACK",
    result: "BLACK_WIN",
    timeControl: "300+3",
    eco: "B20",
    openingId: null,
    playedAt: new Date("2026-01-02T03:04:05Z"),
    createdAt: new Date("2026-01-03T00:00:00Z"),
    opening: null,
    analysis: { status: "COMPLETE", accuracyWhite: 71.5, accuracyBlack: 88.25 },
    ...overrides,
  } as GameWithMeta;
}

describe("toListItem", () => {
  it("projects the user's own accuracy from their colour", () => {
    const dto = toListItem(fakeGame());
    expect(dto.userAccuracy).toBe(88.25);
    expect(dto.analysisStatus).toBe("COMPLETE");
    expect(dto.playedAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("returns null accuracy when the user's side is unknown", () => {
    const dto = toListItem(fakeGame({ userColor: null }));
    expect(dto.userAccuracy).toBeNull();
  });

  it("survives games without analysis", () => {
    const dto = toListItem(fakeGame({ analysis: null }));
    expect(dto.analysisStatus).toBeNull();
    expect(dto.userAccuracy).toBeNull();
  });
});

describe("toAnalysisDto", () => {
  it("sorts move analyses by ply", () => {
    const dto = toAnalysisDto({
      id: "a1",
      gameId: "g1",
      status: "COMPLETE",
      engineId: "stockfish-18-lite-wasm",
      targetDepth: 16,
      lastPly: 2,
      accuracyWhite: 90,
      accuracyBlack: 91,
      acplWhite: 20,
      acplBlack: 18,
      summary: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      moves: [
        { ply: 2, classification: "GOOD" },
        { ply: 1, classification: "BEST" },
      ].map(
        (m) =>
          ({
            id: `m${m.ply}`,
            analysisId: "a1",
            ply: m.ply,
            evalBeforeCp: 0,
            evalBeforeMate: null,
            evalAfterCp: 0,
            evalAfterMate: null,
            bestMoveUci: "e2e4",
            bestLinePv: "e2e4",
            secondMoveUci: null,
            secondCp: null,
            secondMate: null,
            depth: 16,
            winBefore: 50,
            winAfter: 50,
            cpLoss: 0,
            accuracy: 100,
            classification: m.classification,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    });
    expect(dto.moves.map((m) => m.ply)).toEqual([1, 2]);
  });
});
