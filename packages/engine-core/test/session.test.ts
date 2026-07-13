import { describe, expect, it } from "vitest";
import { UciSession, type UciTransport } from "../src/session.js";
import type { EvalUpdate } from "../src/types.js";

/** A fake engine: scripts responses to the commands a session sends. */
class FakeTransport implements UciTransport {
  sent: string[] = [];
  private handler: ((line: string) => void) | null = null;

  onLine(handler: (line: string) => void): void {
    this.handler = handler;
  }

  send(line: string): void {
    this.sent.push(line);
    queueMicrotask(() => {
      if (line === "uci") {
        this.emit("id name FakeFish 1.0");
        this.emit("option name MultiPV type spin default 1 min 1 max 256");
        this.emit("uciok");
      } else if (line === "isready") {
        this.emit("readyok");
      } else if (line.startsWith("go")) {
        // Two depths of MultiPV=2 output, then bestmove. Black to move in the
        // scripted position, so raw cp values must come out negated.
        this.emit("info depth 10 multipv 1 score cp 30 nodes 1000 pv g8f6 b1c3");
        this.emit("info depth 10 multipv 2 score cp -15 nodes 1000 pv e7e5 g1f3");
        this.emit("info depth 12 multipv 1 score cp 25 nodes 5000 pv g8f6 b1c3 d7d5");
        this.emit("info depth 12 multipv 2 score cp -40 nodes 5000 pv e7e5 g1f3");
        this.emit("bestmove g8f6 ponder b1c3");
      }
    });
  }

  emit(line: string): void {
    this.handler?.(line);
  }
}

const BLACK_TO_MOVE_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

describe("UciSession", () => {
  it("initialises and reports capabilities", async () => {
    const transport = new FakeTransport();
    const session = new UciSession(transport, { engineId: "fakefish-test", defaultThreads: 4 });
    const caps = await session.init();
    expect(caps.name).toBe("FakeFish 1.0");
    expect(caps.engineId).toBe("fakefish-test");
    expect(caps.maxMultiPv).toBe(256);
    expect(transport.sent).toContain("setoption name Threads value 4");
  });

  it("streams white-POV updates and terminates on bestmove", async () => {
    const transport = new FakeTransport();
    const session = new UciSession(transport, { engineId: "fakefish-test" });
    await session.init();

    const updates: EvalUpdate[] = [];
    for await (const update of session.analyse({ fen: BLACK_TO_MOVE_FEN, depth: 12, multiPv: 2 })) {
      updates.push(update);
    }

    expect(transport.sent).toContain("setoption name MultiPV value 2");
    expect(transport.sent).toContain(`position fen ${BLACK_TO_MOVE_FEN}`);
    expect(transport.sent).toContain("go depth 12");

    const final = updates.at(-1)!;
    expect(final.final).toBe(true);
    expect(final.bestMoveUci).toBe("g8f6");
    expect(final.depth).toBe(12);
    // Black to move: engine's +25 (side to move) is -25 for white.
    expect(final.lines[0]).toMatchObject({ moveUci: "g8f6", score: { cp: -25 } });
    expect(final.lines[1]).toMatchObject({ moveUci: "e7e5", score: { cp: 40 } });

    // Progress updates arrived before the final one.
    expect(updates.length).toBeGreaterThan(1);
    expect(updates[0]!.final).toBe(false);
  });

  it("allows a second analyse after completion", async () => {
    const transport = new FakeTransport();
    const session = new UciSession(transport, { engineId: "fakefish-test" });
    await session.init();
    for await (const _ of session.analyse({ fen: BLACK_TO_MOVE_FEN, depth: 12 })) {
      /* drain */
    }
    const second: EvalUpdate[] = [];
    for await (const update of session.analyse({ fen: BLACK_TO_MOVE_FEN, depth: 12 })) {
      second.push(update);
    }
    expect(second.at(-1)!.final).toBe(true);
  });

  it("rejects concurrent searches", async () => {
    const transport = new FakeTransport();
    const session = new UciSession(transport, { engineId: "fakefish-test" });
    await session.init();
    session.analyse({ fen: BLACK_TO_MOVE_FEN, depth: 12 });
    expect(() => session.analyse({ fen: BLACK_TO_MOVE_FEN, depth: 12 })).toThrow(/already searching/);
  });
});
