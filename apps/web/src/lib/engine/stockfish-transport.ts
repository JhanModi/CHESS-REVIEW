import type { UciTransport } from "@tempo/engine-core";

export interface StockfishHandle {
  transport: UciTransport;
  engineId: string;
  threads: number;
  multithreaded: boolean;
}

/**
 * Boots Stockfish 18 (lite NNUE) from the static files in /public/stockfish
 * as a plain Web Worker speaking UCI over postMessage (ADR 003). Picks the
 * multithreaded build only when the page is cross-origin isolated (ADR 005).
 */
export function createStockfishTransport(): StockfishHandle {
  const multithreaded = typeof self !== "undefined" && self.crossOriginIsolated === true;
  const file = multithreaded ? "stockfish-18-lite.js" : "stockfish-18-lite-single.js";
  const worker = new Worker(`/stockfish/${file}`);

  let lineHandler: ((line: string) => void) | null = null;
  worker.onmessage = (event: MessageEvent) => {
    if (typeof event.data === "string") lineHandler?.(event.data);
  };

  const threads = multithreaded
    ? Math.min(8, Math.max(1, (navigator.hardwareConcurrency || 4) - 2))
    : 1;

  return {
    transport: {
      send: (line) => worker.postMessage(line),
      onLine: (handler) => {
        lineHandler = handler;
      },
      dispose: () => worker.terminate(),
    },
    engineId: multithreaded ? "stockfish-18-lite-wasm" : "stockfish-18-lite-single-wasm",
    threads,
    multithreaded,
  };
}
