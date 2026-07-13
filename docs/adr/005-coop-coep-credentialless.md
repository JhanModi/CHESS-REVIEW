# ADR 005 — Cross-origin isolation via COEP `credentialless`

- Status: accepted
- Date: 2026-07-13

## Context

Multithreaded Stockfish WASM needs `SharedArrayBuffer`, which requires the
page to be cross-origin-isolated (`COOP: same-origin` + a COEP policy).
`COEP: require-corp` blocks every cross-origin subresource that doesn't send
CORP headers — which breaks Clerk's hosted scripts/iframes and most third-party
embeds.

## Decision

Send on all routes of the web app:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

and **feature-detect** `self.crossOriginIsolated` at runtime, degrading to the
single-threaded engine build when false.

## Consequences

- Chromium/Firefox users get multithreaded analysis; Safari (no
  `credentialless` support) silently gets the single-threaded engine — slower
  but correct. No user-visible failure.
- Clerk and other cross-origin resources keep working (credentialless strips
  credentials instead of blocking).
- Any future embedded third-party iframe must tolerate credentialless mode;
  documented constraint for the marketing pages.
