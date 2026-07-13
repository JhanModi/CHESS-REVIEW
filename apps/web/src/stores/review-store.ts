import { create } from "zustand";
import type { GameDetailDto } from "@tempo/types";
import { buildSnapshots, snapshotMatchesFen, type BoardSnapshot } from "@/lib/board/piece-track";
import { replayLine, type VariationStep } from "@/lib/board/variation";

export const STANDARD_INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Engine-line preview state, layered over the game without mutating it. */
export interface VariationState {
  /** Game ply to restore when the preview closes. */
  returnPly: number;
  /** Position the studied move was played in. */
  baseFen: string;
  steps: VariationStep[];
  /** Index 0 = base position, i = after variation move i. */
  snapshots: BoardSnapshot[];
  cursor: number;
  playing: boolean;
}

interface ReviewState {
  game: GameDetailDto | null;
  snapshots: BoardSnapshot[];
  /** 0 = initial position; i = after ply i. */
  currentPly: number;
  orientation: "white" | "black";
  autoplay: boolean;
  variation: VariationState | null;

  setGame(game: GameDetailDto): void;
  clear(): void;
  goTo(ply: number): void;
  next(): void;
  prev(): void;
  first(): void;
  last(): void;
  flip(): void;
  setAutoplay(on: boolean): void;

  /**
   * Opens an engine-line preview from the position BEFORE `studyPly`.
   * `autoPlay` starts stepping through the line immediately.
   * No engine or network work happens here — the line is stored data.
   */
  enterVariation(studyPly: number, ucis: readonly string[], autoPlay?: boolean): void;
  exitVariation(): void;
  variationNext(): void;
  variationPrev(): void;
  setVariationPlaying(playing: boolean): void;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  game: null,
  snapshots: [],
  currentPly: 0,
  orientation: "white",
  autoplay: false,
  variation: null,

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
      variation: null,
      orientation: game.userColor === "BLACK" ? "black" : "white",
    });
  },

  clear() {
    set({ game: null, snapshots: [], currentPly: 0, autoplay: false, variation: null });
  },

  goTo(ply) {
    const { game } = get();
    if (!game) return;
    set({ currentPly: Math.max(0, Math.min(game.moves.length, Math.round(ply))), variation: null });
  },

  next() {
    const { currentPly, game, variation } = get();
    if (!game) return;
    if (variation) {
      get().variationNext();
      return;
    }
    if (currentPly >= game.moves.length) set({ autoplay: false });
    else set({ currentPly: currentPly + 1 });
  },

  prev() {
    const { currentPly, variation } = get();
    if (variation) {
      get().variationPrev();
      return;
    }
    set({ currentPly: Math.max(0, currentPly - 1), autoplay: false });
  },

  first() {
    set({ currentPly: 0, autoplay: false, variation: null });
  },

  last() {
    const { game } = get();
    if (game) set({ currentPly: game.moves.length, autoplay: false, variation: null });
  },

  flip() {
    set((state) => ({ orientation: state.orientation === "white" ? "black" : "white" }));
  },

  setAutoplay(on) {
    set({ autoplay: on });
  },

  enterVariation(studyPly, ucis, autoPlay = true) {
    const { game } = get();
    if (!game || studyPly < 1 || studyPly > game.moves.length) return;
    const baseFen = currentFen({ game, currentPly: studyPly - 1 });
    const steps = replayLine(baseFen, ucis);
    if (steps.length === 0) return;
    set({
      variation: {
        returnPly: studyPly,
        baseFen,
        steps,
        snapshots: buildSnapshots(
          baseFen,
          steps.map((s) => s.uci),
        ),
        cursor: 0,
        playing: autoPlay,
      },
      autoplay: false,
    });
  },

  exitVariation() {
    const { variation } = get();
    if (!variation) return;
    set({ variation: null, currentPly: variation.returnPly });
  },

  variationNext() {
    const { variation } = get();
    if (!variation) return;
    if (variation.cursor >= variation.steps.length) {
      set({ variation: { ...variation, playing: false } });
      return;
    }
    set({ variation: { ...variation, cursor: variation.cursor + 1 } });
  },

  variationPrev() {
    const { variation } = get();
    if (!variation) return;
    set({ variation: { ...variation, cursor: Math.max(0, variation.cursor - 1), playing: false } });
  },

  setVariationPlaying(playing) {
    const { variation } = get();
    if (!variation) return;
    // Restart from the top when resuming a finished line.
    const cursor = playing && variation.cursor >= variation.steps.length ? 0 : variation.cursor;
    set({ variation: { ...variation, playing, cursor } });
  },
}));

/** The FEN of the currently shown position (for engine/analysis consumers). */
export function currentFen(state: Pick<ReviewState, "game" | "currentPly">): string {
  const { game, currentPly } = state;
  if (!game) return STANDARD_INITIAL_FEN;
  if (currentPly === 0) return game.initialFen ?? STANDARD_INITIAL_FEN;
  return game.moves[currentPly - 1]!.fenAfter;
}
