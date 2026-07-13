import { create } from "zustand";
import type { GameDetailDto } from "@tempo/types";
import { buildSnapshots, snapshotMatchesFen, type BoardSnapshot } from "@/lib/board/piece-track";

export const STANDARD_INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface ReviewState {
  game: GameDetailDto | null;
  snapshots: BoardSnapshot[];
  /** 0 = initial position; i = after ply i. */
  currentPly: number;
  orientation: "white" | "black";
  autoplay: boolean;

  setGame(game: GameDetailDto): void;
  clear(): void;
  goTo(ply: number): void;
  next(): void;
  prev(): void;
  first(): void;
  last(): void;
  flip(): void;
  setAutoplay(on: boolean): void;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  game: null,
  snapshots: [],
  currentPly: 0,
  orientation: "white",
  autoplay: false,

  setGame(game) {
    const initialFen = game.initialFen ?? STANDARD_INITIAL_FEN;
    const snapshots = buildSnapshots(
      initialFen,
      game.moves.map((m) => m.uci),
    );
    if (process.env.NODE_ENV !== "production" && game.moves.length > 0) {
      const last = game.moves.at(-1)!;
      if (!snapshotMatchesFen(snapshots.at(-1)!, last.fenAfter)) {
        console.warn("piece tracking diverged from server FEN", { gameId: game.id });
      }
    }
    set({
      game,
      snapshots,
      currentPly: 0,
      autoplay: false,
      orientation: game.userColor === "BLACK" ? "black" : "white",
    });
  },

  clear() {
    set({ game: null, snapshots: [], currentPly: 0, autoplay: false });
  },

  goTo(ply) {
    const { game } = get();
    if (!game) return;
    set({ currentPly: Math.max(0, Math.min(game.moves.length, Math.round(ply))) });
  },

  next() {
    const { currentPly, game } = get();
    if (!game) return;
    if (currentPly >= game.moves.length) set({ autoplay: false });
    else set({ currentPly: currentPly + 1 });
  },

  prev() {
    const { currentPly } = get();
    set({ currentPly: Math.max(0, currentPly - 1), autoplay: false });
  },

  first() {
    set({ currentPly: 0, autoplay: false });
  },

  last() {
    const { game } = get();
    if (game) set({ currentPly: game.moves.length, autoplay: false });
  },

  flip() {
    set((state) => ({ orientation: state.orientation === "white" ? "black" : "white" }));
  },

  setAutoplay(on) {
    set({ autoplay: on });
  },
}));

/** The FEN of the currently shown position (for engine/analysis consumers). */
export function currentFen(state: Pick<ReviewState, "game" | "currentPly">): string {
  const { game, currentPly } = state;
  if (!game) return STANDARD_INITIAL_FEN;
  if (currentPly === 0) return game.initialFen ?? STANDARD_INITIAL_FEN;
  return game.moves[currentPly - 1]!.fenAfter;
}
