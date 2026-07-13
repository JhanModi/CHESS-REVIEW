# ADR 001 — Turborepo monorepo with framework-free domain packages

- Status: accepted
- Date: 2026-07-13

## Context

Tempo ships a Next.js web app, a NestJS API, and (later) headless analysis
workers and possibly a mobile client. All of them need the same chess domain
logic (PGN parsing, classification math, engine protocol) and the same data
contracts. Duplicating that logic per app guarantees drift; putting it in the
API and calling over HTTP makes client-side analysis impossible.

## Decision

A pnpm + Turborepo monorepo with a strict dependency direction:

```
apps/web ─┐
apps/api ─┼──> packages/{chess-core, engine-core, ai-core, types, db}
(workers)─┘
```

- `packages/*` are framework-free TypeScript (no Nest, no React imports) and
  compile to ESM with type declarations.
- Apps never import from other apps. Packages never import from apps.
- `@tempo/types` (zod schemas) is the single source of truth for DTOs shared
  between web and api.
- Node ≥ 22.12 is required so the CommonJS NestJS app can `require()` our ESM
  packages (and ESM-only chessops) natively.

## Consequences

- Domain logic is unit-testable in isolation (vitest, no app bootstrapping).
- Future workers/mobile/CLI consume the same packages unchanged.
- One more build layer (`tsc` per package); Turborepo caches it.
