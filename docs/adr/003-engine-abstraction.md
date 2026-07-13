# ADR 003 — Engine abstraction with WASM-first analysis

- Status: accepted
- Date: 2026-07-13

## Context

Analysis must run today in the browser (zero infra cost, offline-capable) and
later on server workers (Stockfish native), with Leela Chess Zero and remote
"cloud engine" pools as future options. Business logic must not know which
engine produced an evaluation.

## Decision

`@tempo/engine-core` defines an `EngineAdapter` interface:

```ts
interface EngineAdapter {
  init(options: EngineInitOptions): Promise<EngineCapabilities>;
  analyse(request: AnalyseRequest): AsyncIterable<EvalUpdate>; // streaming
  stop(): Promise<void>;
  dispose(): Promise<void>;
}
```

- UCI text protocol parsing lives **only** inside adapters; the rest of the
  system consumes typed `EvalUpdate`s (cp/mate score, depth, multiPV lines).
- First implementation: `StockfishWasmAdapter` running Stockfish 18 (lite NNUE)
  in a browser Web Worker. The engine artifact is served unmodified from
  `public/stockfish/` and spoken to over `postMessage` — never bundled — both
  because Emscripten pthread workers break under bundlers and to keep the
  GPL-3.0 engine a separate, replaceable artifact from proprietary app code.
- Multithreaded build when `self.crossOriginIsolated === true`; automatic
  fallback to the single-threaded build otherwise (Safari).
- Server-side (`StockfishNativeAdapter`, Step 3) implements the same interface
  over a child process, so the classification pipeline is transport-agnostic.

## Consequences

- Client and server analysis produce byte-identical result shapes; resume and
  caching logic is shared.
- Adding an engine = writing one adapter + registering capabilities.
