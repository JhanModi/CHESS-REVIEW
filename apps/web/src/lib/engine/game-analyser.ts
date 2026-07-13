import { epdFromFen } from "@tempo/chess-core";
import { UciSession, type EvalUpdate, type PvLine } from "@tempo/engine-core";
import type { AnalysisDto, EvalCacheEntryDto, GameDetailDto, PositionEval } from "@tempo/types";
import { STANDARD_INITIAL_FEN } from "@/stores/review-store";

export const DEFAULT_ANALYSIS_DEPTH = 16;
const SUBMIT_BATCH_SIZE = 8;
const CACHE_LOOKUP_CHUNK = 60;

export interface AnalyserCallbacks {
  onEngineReady(info: { name: string; engineId: string; threads: number }): void;
  onProgress(progress: { done: number; total: number; currentDepth: number }): void;
  /** Fired after every accepted batch — payload is the server's canonical state. */
  onServerUpdate(analysis: AnalysisDto): void;
  onComplete(analysis: AnalysisDto): void;
  onError(error: Error): void;
}

type ApiCall = <T>(path: string, options?: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown }) => Promise<T>;

function toPositionLines(lines: PvLine[]): PositionEval["lines"] {
  return lines.slice(0, 2).map((line) => ({
    moveUci: line.moveUci,
    cp: line.score.cp,
    mate: line.score.mate,
    pv: line.pv.slice(0, 24),
  }));
}

/**
 * Client-side analysis pipeline (ADR 007): evaluate every position with the
 * local engine, consult the shared eval cache first, and stream raw evals to
 * the API in resumable batches. The server owns classification.
 */
export class GameAnalyser {
  private stopped = false;
  private session: UciSession | null = null;

  constructor(
    private readonly game: GameDetailDto,
    private readonly api: ApiCall,
    private readonly callbacks: AnalyserCallbacks,
    private readonly targetDepth = DEFAULT_ANALYSIS_DEPTH,
  ) {}

  stop(): void {
    this.stopped = true;
    void this.session?.stop();
  }

  async run(): Promise<void> {
    try {
      await this.runInner();
    } catch (err) {
      if (!this.stopped) this.callbacks.onError(err as Error);
    } finally {
      await this.session?.dispose().catch(() => undefined);
      this.session = null;
    }
  }

  private async runInner(): Promise<void> {
    const game = this.game;
    const initialFen = game.initialFen ?? STANDARD_INITIAL_FEN;
    const fens = [initialFen, ...game.moves.map((m) => m.fenAfter)];
    const epds = fens.map(epdFromFen);
    const total = fens.length;

    // Resume: skip everything at or below the server's contiguous frontier.
    const startIndex = game.analysis && game.analysis.lastPly > 0 ? game.analysis.lastPly : 0;

    // Shared-cache consult (ADR 006): positions already analysed deeply
    // enough — by anyone — don't burn local CPU.
    const cached = await this.lookupCache(epds.slice(startIndex));

    const { createStockfishTransport } = await import("./stockfish-transport");
    const handle = createStockfishTransport();
    this.session = new UciSession(handle.transport, { engineId: handle.engineId });
    const caps = await this.session.init({ threads: handle.threads, hashMb: 64 });
    this.callbacks.onEngineReady({ name: caps.name, engineId: handle.engineId, threads: caps.threads });

    let batch: PositionEval[] = [];
    let done = startIndex;

    const flush = async (): Promise<void> => {
      if (batch.length === 0) return;
      const positions = batch;
      batch = [];
      const analysis = await this.api<AnalysisDto>(`/games/${game.id}/analysis`, {
        method: "PUT",
        body: { engineId: handle.engineId, targetDepth: this.targetDepth, positions },
      });
      this.callbacks.onServerUpdate(analysis);
    };

    for (let index = startIndex; index < total; index++) {
      if (this.stopped) break;

      const cachedEntry = cached.get(epds[index]!);
      if (cachedEntry && cachedEntry.depth >= this.targetDepth && cachedEntry.lines.length > 0) {
        batch.push({
          index,
          depth: cachedEntry.depth,
          lines: cachedEntry.lines.map((l) => ({ moveUci: l.moveUci, cp: l.cp, mate: l.mate, pv: l.pv.slice(0, 24) })),
        });
      } else {
        const final = await this.analysePosition(fens[index]!);
        if (this.stopped && !final) break;
        if (final && final.lines.length > 0) {
          batch.push({ index, depth: final.depth, lines: toPositionLines(final.lines) });
        } else {
          // Terminal position (mate/stalemate): synthesise the game-over eval.
          const lastSan = index > 0 ? game.moves[index - 1]!.san : "";
          const mated = lastSan.endsWith("#");
          const whiteJustMoved = index % 2 === 1;
          batch.push({
            index,
            depth: this.targetDepth,
            lines: [
              mated
                ? { moveUci: "none", mate: whiteJustMoved ? 1 : -1, pv: [] }
                : { moveUci: "none", cp: 0, pv: [] },
            ],
          });
        }
      }

      done = index + 1;
      this.callbacks.onProgress({ done, total, currentDepth: this.targetDepth });
      if (batch.length >= SUBMIT_BATCH_SIZE) await flush();
    }

    await flush();

    if (!this.stopped) {
      const final = await this.api<AnalysisDto>(`/games/${game.id}/analysis`);
      this.callbacks.onComplete(final);
    }
  }

  private async analysePosition(fen: string): Promise<EvalUpdate | null> {
    let final: EvalUpdate | null = null;
    for await (const update of this.session!.analyse({ fen, depth: this.targetDepth, multiPv: 2 })) {
      if (update.final) final = update;
    }
    return final;
  }

  private async lookupCache(epds: string[]): Promise<Map<string, EvalCacheEntryDto>> {
    const map = new Map<string, EvalCacheEntryDto>();
    const unique = [...new Set(epds)];
    for (let i = 0; i < unique.length; i += CACHE_LOOKUP_CHUNK) {
      const chunk = unique.slice(i, i + CACHE_LOOKUP_CHUNK);
      try {
        const entries = await this.api<EvalCacheEntryDto[]>(
          `/evals?epds=${encodeURIComponent(chunk.join(","))}`,
        );
        for (const entry of entries) map.set(entry.epd, entry);
      } catch {
        // Cache lookups are an optimisation — analysis proceeds without them.
        break;
      }
    }
    return map;
  }
}
