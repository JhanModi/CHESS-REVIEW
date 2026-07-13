# Tempo — Project Memory

Durable, non-obvious facts a future session must not rediscover the hard way.
Not a changelog (that's PROGRESS.md); this is "things that are true and would
cost us if forgotten." Never put secret *values* here.

## Decisions (and why)

- **Client analyses, server derives** (ADR 007): the browser sends raw engine
  evals; the API recomputes accuracy/classification/summary. Rationale: client
  math can't be trusted for stats/quotas, and labels stay re-derivable without
  re-running engines. When server engines land (M7), only *who produces raw
  evals* changes — the data model doesn't.
- **Engine behind an adapter, served static, never bundled** (ADR 003): Emscripten
  pthreads break under bundlers, and it keeps GPL Stockfish isolated from
  proprietary code. `EngineAdapter` is the seam for native/Lc0/cloud later.
- **chessops over chess.js** (ADR 002): chess.js still lacks variation parsing.
  **License caveat**: chessops is GPL-3.0-or-later — fine server-side, but the
  browser bundle triggers GPL distribution. Address before commercial launch
  (comply or swap at the `chess-core` seam). App code never imports chessops
  directly, so blast radius is one package.
- **COEP `credentialless`, not `require-corp`** (ADR 005): needed for
  SharedArrayBuffer/threads without breaking Clerk's cross-origin scripts.
  Safari lacks `credentialless` → runtime `crossOriginIsolated` check falls
  back to single-thread engine.
- **EPD (FEN minus counters) is the position key** (ADR 006) for the
  cross-user `EngineEvaluation` cache and opening lookup; depth-monotonic
  writes; transposition-safe opening recognition.
- **Future-feature tables shipped now** (orgs, api keys, webhooks, puzzles,
  subscriptions, payments, ai explanations) as real tables — Steps M9–M13 are
  behaviour migrations, not schema rework.
- **Auth seam** (`apps/web/src/lib/auth.tsx`): a *conditional* `ClerkProvider`
  is the single provider. If Clerk keys are absent it renders a local dev
  identity (paired with API `AUTH_DEV_BYPASS`). Keep it — don't let `clerk init`
  add a second provider in `layout.tsx`.

## Environment & credentials (locations, not values)

- Local **PostgreSQL 17**, native Windows service `postgresql-x64-17`.
  App DB `chessreview`, app role `chessreview` / password `chessreview_dev`
  (dev-only, non-secret, already in `.env.example`). The **superuser** password
  was provided by the user in chat once (for DB creation) — not stored here;
  ask again if a superuser action is needed.
- **Clerk** configured. Linked app **`app_3GSC6OqFWPtn50I3whyJDlQ0Jvb`**
  ("My Application", dev instance `ins_3GSC6…`), account
  `jhanmodi777@gmail.com`. Web keys in `apps/web/.env.local`; API needs
  `CLERK_SECRET_KEY` in **root `.env`** (separate process, separate env file).
  `AUTH_DEV_BYPASS` currently disabled. Optional `CLERK_JWT_KEY` (JWT public
  key) would make API verification networkless — not set; JWKS fetch works.
- **Redis/Docker not installed.** Queue + cache fall back in-process. M7 needs
  Redis (`docker compose up -d`).
- **pnpm 11** installed via `npm i -g` (corepack EPERM). Global CLIs → install
  with **npm** (pnpm global bin not on PATH). Build approvals in
  `pnpm-workspace.yaml` `allowBuilds:`.
- **Node ≥ 22.12** (needed for CJS NestJS to `require()` ESM packages/chessops).

## Windows/tooling hazards (all hit during Phase 0)

- `prisma generate` → EPERM renaming the query-engine DLL **while the API is
  running**. Stop the API before `pnpm build`/`db:generate`.
- `next build` **overwrites a running dev server's `.next`** → the dev server
  starts throwing ENOENT for build-manifest temp files. Don't build while a
  preview/dev server is up; restart the preview after building.
- Browser-pane **screenshots time out** on our COOP/COEP (cross-origin
  isolated) pages. Use `get_page_text` / `javascript_tool` to verify UI.
- The preview browser has **its own cookie jar** — it won't share the user's
  real Clerk session. Verify auth-gated flows via the DB / API, or have the
  user act in their own browser.

## Verified facts (trust anchors)

- Accuracy model reproduces lichess within ~±2 for a game at equal depth.
  Goldens: cp 0 → 50%, cp +100 → ~59.1%.
- Kasparov–Topalov 1999: 24.Rxd4!! and 25.Re7+!! both classify **Brilliant**;
  Carlsen blitz game scored 86.0% accuracy over 56 plies. Resume-after-
  interrupt and checkmate-terminal handling confirmed.
- Real imports work keyless: Lichess (`DrNykterstein`), Chess.com (`hikaru`).

## Data state notes

- Two users exist: the user's real Clerk account (`user_3GSEGET…`, Jhan Modi,
  ~50 self-imported games) and a legacy `dev-user` (~60 demo games from before
  Clerk, orphaned/invisible). User opted to leave user-management as-is.
