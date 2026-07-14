import { describe, expect, it } from "vitest";
import { buildSnapshots, parseSquareName, type BoardSnapshot } from "@/lib/board/piece-track";

const CASTLE_FEN = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";

function at(snap: BoardSnapshot, sq: string) {
  return snap.find((p) => p.square === parseSquareName(sq));
}

describe("buildSnapshots — castling", () => {
  // Both UCI encodings must land the king on c1/g1 and hop the rook to d1/f1,
  // never deleting the rook: standard (e1c1/e1g1) and chessops' king-onto-rook
  // (e1a1/e1h1). Regression for the queenside "king to a1, rook vanishes" bug.
  const cases = [
    { name: "queenside standard", uci: "e1c1", king: "c1", rookFrom: "a1", rookTo: "d1" },
    { name: "queenside chessops (king-onto-rook)", uci: "e1a1", king: "c1", rookFrom: "a1", rookTo: "d1" },
    { name: "kingside standard", uci: "e1g1", king: "g1", rookFrom: "h1", rookTo: "f1" },
    { name: "kingside chessops (king-onto-rook)", uci: "e1h1", king: "g1", rookFrom: "h1", rookTo: "f1" },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const before = buildSnapshots(CASTLE_FEN, [])[0]!;
      const after = buildSnapshots(CASTLE_FEN, [c.uci])[1]!;

      // No piece is lost (the rook must not be treated as captured).
      expect(after).toHaveLength(before.length);

      const king = at(after, c.king);
      expect(king?.role).toBe("k");
      expect(king?.color).toBe("w");

      expect(at(after, c.rookFrom)).toBeUndefined(); // rook left its corner
      const rook = at(after, c.rookTo);
      expect(rook?.role).toBe("r");
      expect(rook?.color).toBe("w");

      // e1 is vacated.
      expect(at(after, "e1")).toBeUndefined();
    });
  }

  it("does not misread a normal king capture of an enemy rook as castling", () => {
    // White king e1 captures black rook on d1 (adjacent) — not castling.
    const snap = buildSnapshots("4k3/8/8/8/8/8/8/3rK3 w - - 0 1", ["e1d1"])[1]!;
    expect(at(snap, "d1")?.role).toBe("k");
    expect(at(snap, "d1")?.color).toBe("w");
    expect(snap.filter((p) => p.role === "r")).toHaveLength(0); // enemy rook captured
  });
});
