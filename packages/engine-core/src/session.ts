import {
  type AnalyseRequest,
  type EngineAdapter,
  type EngineCapabilities,
  type EngineInitOptions,
  type EvalUpdate,
  type PvLine,
} from "./types.js";
import {
  buildGoCommand,
  buildPositionCommand,
  buildSetOption,
  fenTurn,
  parseBestMoveLine,
  parseInfoLine,
  toWhitePov,
} from "./uci.js";

/**
 * The transport a UCI engine is reached through: a Web Worker postMessage
 * bridge, a child process stdio pair, a WebSocket… Anything that moves lines.
 */
export interface UciTransport {
  send(line: string): void;
  /** Registers THE line handler (a session owns its transport exclusively). */
  onLine(handler: (line: string) => void): void;
  dispose?(): void | Promise<void>;
}

/** Unbounded push→pull adapter between the line handler and async iteration. */
class AsyncQueue<T> implements AsyncIterable<T> {
  private buffer: T[] = [];
  private waiting: ((value: IteratorResult<T>) => void)[] = [];
  private closed = false;

  push(value: T): void {
    if (this.closed) return;
    const waiter = this.waiting.shift();
    if (waiter) waiter({ value, done: false });
    else this.buffer.push(value);
  }

  close(): void {
    this.closed = true;
    for (const waiter of this.waiting.splice(0)) {
      waiter({ value: undefined as never, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        const value = this.buffer.shift();
        if (value !== undefined) return Promise.resolve({ value, done: false });
        if (this.closed) return Promise.resolve({ value: undefined as never, done: true });
        return new Promise((resolve) => this.waiting.push(resolve));
      },
    };
  }
}

export interface UciSessionOptions {
  engineId: string;
  defaultThreads?: number;
  defaultHashMb?: number;
}

/**
 * A generic UCI engine session: implements EngineAdapter over any
 * UciTransport. All Stockfish-family adapters are this class plus a
 * transport-specific factory.
 */
export class UciSession implements EngineAdapter {
  private name = "unknown engine";
  private maxMultiPv = 1;
  private threads = 1;
  private currentMultiPv = 1;
  private pendingReady: (() => void) | null = null;
  private pendingUciOk: (() => void) | null = null;
  private search: {
    queue: AsyncQueue<EvalUpdate>;
    turn: "white" | "black";
    lines: Map<number, PvLine & { depth: number }>;
    lastDepth: number;
    nodes?: number;
    timeMs?: number;
  } | null = null;

  constructor(
    private readonly transport: UciTransport,
    private readonly options: UciSessionOptions,
  ) {
    transport.onLine((line) => this.handleLine(line));
  }

  async init(initOptions?: EngineInitOptions): Promise<EngineCapabilities> {
    await new Promise<void>((resolve) => {
      this.pendingUciOk = resolve;
      this.transport.send("uci");
    });
    this.threads = initOptions?.threads ?? this.options.defaultThreads ?? 1;
    if (this.threads > 1) this.transport.send(buildSetOption("Threads", this.threads));
    const hash = initOptions?.hashMb ?? this.options.defaultHashMb;
    if (hash) this.transport.send(buildSetOption("Hash", hash));
    await this.isReady();
    return {
      name: this.name,
      engineId: this.options.engineId,
      maxMultiPv: this.maxMultiPv,
      threads: this.threads,
    };
  }

  analyse(request: AnalyseRequest): AsyncIterable<EvalUpdate> {
    if (this.search) throw new Error("Engine is already searching; call stop() first");
    const multiPv = Math.max(1, Math.min(request.multiPv ?? 1, this.maxMultiPv || 1));
    if (multiPv !== this.currentMultiPv) {
      this.transport.send(buildSetOption("MultiPV", multiPv));
      this.currentMultiPv = multiPv;
    }
    const queue = new AsyncQueue<EvalUpdate>();
    this.search = {
      queue,
      turn: fenTurn(request.fen),
      lines: new Map(),
      lastDepth: 0,
    };
    this.transport.send(buildPositionCommand(request.fen));
    this.transport.send(buildGoCommand(request));
    return queue;
  }

  async stop(): Promise<void> {
    if (this.search) this.transport.send("stop");
  }

  async dispose(): Promise<void> {
    this.transport.send("quit");
    await this.transport.dispose?.();
  }

  private isReady(): Promise<void> {
    return new Promise((resolve) => {
      this.pendingReady = resolve;
      this.transport.send("isready");
    });
  }

  private handleLine(raw: string): void {
    const line = raw.trim();
    if (line === "uciok") {
      this.pendingUciOk?.();
      this.pendingUciOk = null;
      return;
    }
    if (line === "readyok") {
      this.pendingReady?.();
      this.pendingReady = null;
      return;
    }
    if (line.startsWith("id name ")) {
      this.name = line.slice("id name ".length);
      return;
    }
    if (line.startsWith("option name MultiPV")) {
      const max = /max (\d+)/.exec(line);
      if (max) this.maxMultiPv = Number(max[1]);
      return;
    }

    const search = this.search;
    if (!search) return;

    if (line.startsWith("bestmove")) {
      const bestMoveUci = parseBestMoveLine(line);
      search.queue.push({
        depth: search.lastDepth,
        lines: this.collectLines(),
        nodes: search.nodes,
        timeMs: search.timeMs,
        bestMoveUci: bestMoveUci ?? undefined,
        final: true,
      });
      search.queue.close();
      this.search = null;
      return;
    }

    const info = parseInfoLine(line);
    if (!info?.pv?.length || !info.score || info.score.bound || !info.depth) return;
    const slot = info.multiPv ?? 1;
    search.lines.set(slot, {
      moveUci: info.pv[0]!,
      score: toWhitePov(info.score, search.turn),
      pv: info.pv,
      depth: info.depth,
    });
    if (info.nodes !== undefined) search.nodes = info.nodes;
    if (info.timeMs !== undefined) search.timeMs = info.timeMs;
    if (slot === 1) {
      search.lastDepth = info.depth;
      search.queue.push({
        depth: info.depth,
        lines: this.collectLines(),
        nodes: search.nodes,
        timeMs: search.timeMs,
        final: false,
      });
    }
  }

  private collectLines(): PvLine[] {
    const search = this.search;
    if (!search) return [];
    return [...search.lines.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, line]) => ({ moveUci: line.moveUci, score: line.score, pv: line.pv }));
  }
}
