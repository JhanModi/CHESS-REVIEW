/**
 * Engine-agnostic evaluation types. Every engine adapter — browser WASM,
 * server child-process, remote pool — produces these shapes (ADR 003).
 */

/** Evaluation score. Exactly one of `cp` / `mate` is set. Always white POV. */
export interface Score {
  /** Centipawns, white's perspective. */
  cp?: number;
  /** Moves to mate; positive = white mates, negative = black mates. */
  mate?: number;
}

export interface PvLine {
  /** First move of the line, UCI. */
  moveUci: string;
  score: Score;
  /** Full principal variation, UCI moves. */
  pv: string[];
}

/** One streaming update while an engine analyses a single position. */
export interface EvalUpdate {
  depth: number;
  /** index 0 = best line. Length ≤ requested multiPv. */
  lines: PvLine[];
  nodes?: number;
  timeMs?: number;
  /** Set on the terminal update, when the engine reported its bestmove. */
  bestMoveUci?: string;
  final: boolean;
}

export interface AnalyseRequest {
  fen: string;
  /** Fixed-depth search. */
  depth?: number;
  /** Or time-bound search (ms). One of depth/moveTimeMs required. */
  moveTimeMs?: number;
  multiPv?: number;
}

export interface EngineCapabilities {
  name: string;
  /** Stable identifier persisted with evaluations, e.g. "stockfish-18-lite-wasm". */
  engineId: string;
  maxMultiPv: number;
  threads: number;
}

export interface EngineInitOptions {
  threads?: number;
  hashMb?: number;
}

/**
 * The contract every engine implementation fulfils. `analyse` streams
 * progressively deeper evaluations and completes after the terminal update.
 */
export interface EngineAdapter {
  init(options?: EngineInitOptions): Promise<EngineCapabilities>;
  analyse(request: AnalyseRequest): AsyncIterable<EvalUpdate>;
  /** Abort the current search (its iterator completes with a final update). */
  stop(): Promise<void>;
  dispose(): Promise<void>;
}
