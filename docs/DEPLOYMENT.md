# Deploying Tempo (free tier)

A complete, free public deployment:

| Piece | Host | Cost | Notes |
|---|---|---|---|
| Web (Next.js) | **Vercel** Hobby | Free, no card | builds from GitHub |
| API (NestJS) | **Render** free web service | Free, no card | sleeps after ~15 min idle → ~30–50 s cold start |
| Postgres | **Neon** free tier | Free, no card | serverless Postgres |
| Redis | — omitted — | — | API uses in-process queue/cache when `REDIS_URL` is unset |
| Auth | **Clerk** free tier | Free | start on the existing dev instance; production instance needs DNS |

Committed artifacts: [`render.yaml`](../render.yaml) (API blueprint),
[`vercel.json`](../vercel.json) (web build).

---

## 0. Prerequisite — push to GitHub

Vercel and Render deploy from a Git repo. Create an **empty** GitHub repo
(e.g. `tempo`), then from the project root:

```bash
git remote add origin https://github.com/<you>/tempo.git
git push -u origin main
```

`.env`, `.env.local` and `.clerk/` are gitignored — no secrets leave your
machine.

## 1. Database — Neon

1. Sign up at neon.tech → **New Project** (pick a region near your users).
2. Copy the **pooled** connection string (host contains `-pooler`), shape:
   `postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require`.
   This becomes the API's `DATABASE_URL`. (No shadow DB needed in prod —
   `migrate deploy` doesn't use one.)

The API's start command runs `prisma migrate deploy` on boot, so the schema is
created automatically on first deploy. **Seed the 3,803 ECO openings once** —
two ways:

- **No laptop needed (recommended):** add a repo secret `PROD_DATABASE_URL`
  (the Neon pooled URL) under GitHub → Settings → Secrets → Actions, then run
  the **DB migrate (production)** workflow (Actions tab) with the *seed* box
  ticked. See [`.github/workflows/migrate.yml`](../.github/workflows/migrate.yml).
- **From your machine:**
  ```bash
  DATABASE_URL="<neon pooled url>" pnpm --filter @tempo/db run seed:ci
  ```

## 2. API — Render

1. Sign up at render.com → **New → Blueprint** → connect the GitHub repo.
   Render reads [`render.yaml`](../render.yaml) and provisions `tempo-api`.
2. When prompted, set the `sync: false` env vars:
   - `DATABASE_URL` → the Neon pooled string
   - `CLERK_SECRET_KEY` → from Clerk dashboard → API keys
   - `CLERK_JWT_KEY` → Clerk → API keys → JWT public key (PEM). Optional but
     recommended: makes token verification networkless.
   - `WEB_URL` → your Vercel URL (fill after step 3; used for CORS). You can
     put a placeholder now and update it once Vercel is live.
   - `CHESSCOM_USER_AGENT` → `Tempo (you@example.com)`
3. Deploy. Health check: `https://tempo-api-xxxx.onrender.com/v1/health` → `{"status":"ok"}`.
   Swagger at `/docs`.

> **If the build fails with `Error: Cannot find matching keyid` from
> corepack**: that's corepack's own signature verification against a stale
> key set, unrelated to this repo. The blueprint installs pnpm via `npm`
> instead of `corepack enable` specifically to avoid it — if you're seeing
> this, pull the latest `render.yaml` and redeploy.

Build/start are already defined in the blueprint:
- build: `pnpm install --frozen-lockfile && pnpm --filter @tempo/db generate && pnpm turbo run build --filter=api`
- start: `pnpm --filter @tempo/db run deploy && node apps/api/dist/main.js`

The API ships production-hardened: `helmet` security headers, `compression`,
CORS locked to `WEB_URL` (comma-separated to allow Vercel preview origins),
rate limiting, and a `/v1/health` check. HTTPS is terminated by Render
automatically. `NODE_ENV=production` and `$PORT` are set by the platform.

## 3. Web — Vercel

1. Sign up at vercel.com → **Add New → Project** → import the GitHub repo.
2. Leave **Root Directory** at the repo root. `vercel.json` already sets the
   framework, install, build (`turbo run build --filter=web`, which builds the
   `@tempo/*` packages first and copies the Stockfish engine via the web
   `prebuild` hook) and output directory.
3. Add environment variables (Production):
   - `NEXT_PUBLIC_API_URL` → your Render API URL (e.g.
     `https://tempo-api-xxxx.onrender.com`). **Build-time** — a redeploy is
     needed if you change it.
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → Clerk → API keys
   - `CLERK_SECRET_KEY` → Clerk (used by Next middleware)
   - The `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` /
     `_FALLBACK_REDIRECT_URL` values from `apps/web/.env.local`.
4. Deploy → note the URL (e.g. `https://tempo.vercel.app`).

> If Vercel fails to detect Next.js from the repo root, set **Root Directory =
> `apps/web`** and override **Build Command = `cd ../.. && pnpm turbo run build
> --filter=web`** instead — same result, dashboard-driven.

## 4. Close the loop

1. Set Render's `WEB_URL` to the Vercel URL → redeploy the API (fixes CORS).
2. Confirm the Vercel `NEXT_PUBLIC_API_URL` points at Render → redeploy web if
   it was a placeholder.
3. Open the Vercel URL, sign in, import a game, run analysis.

## 5. Clerk in production (when ready)

The dev instance works on the live URLs (with a "development" banner and lower
limits) — fine to launch on. For a real production instance:
1. Clerk dashboard → create a **production** instance.
2. Add the DNS records Clerk shows (CNAMEs on your domain).
3. Swap the `pk_live_…` / `sk_live_…` keys into Vercel + Render, redeploy.

## 6. Verify (after the loop is closed)

Run through the live site and confirm each item:

| Check | How | Free-tier note |
|---|---|---|
| Frontend loads | open the Vercel URL | — |
| Backend responds | `GET <api>/v1/health` → `{"status":"ok"}` | first hit may cold-start (~30–50 s) |
| Swagger works | `<api>/docs` renders | — |
| Clerk login works | sign up on the site | dev instance shows a "development" badge |
| PGN upload works | paste/upload a PGN | — |
| Lichess import | import a Lichess username | keyless |
| Chess.com import | import a Chess.com username | needs `CHESSCOM_USER_AGENT` |
| Stockfish analysis | run analysis on a game | multithreaded (see below) |
| Dashboard loads | open the dashboard signed in | — |
| Public share pages | open `<web>/share/<slug>` logged out | no auth |

## Notes, limits & why

- **"Online 24/7 without your laptop": yes.** Web (Vercel) and API (Render)
  run in the cloud; the database is on Neon. Nothing depends on your machine.
- **Render cold starts**: the free API sleeps after ~15 min idle; the next
  request wakes it (~30–50 s) then it's fast. It stays *available*, just slow
  on the first hit after a nap. $7/mo removes this if you ever want it.
- **Multithreaded WASM works.** The COOP/COEP headers in `next.config.ts` ship
  via Vercel, so the site is cross-origin-isolated and Stockfish uses threads;
  Safari (no `credentialless`) auto-falls back to the single-thread engine.
- **Stockfish files**: copied into `public/stockfish/` by the web `prebuild`
  during the Vercel build and served as immutable static assets (CDN-cached).
- **Analysis runs in the browser**, so the free API stays light — it only
  stores games and derives stats from submitted evals. This is *why* the free
  Render tier is sufficient.
- **Redis is optional and left OFF.** With `REDIS_URL` unset the API uses an
  in-process queue + cache — correct for a single instance. Upstash's free tier
  is supported (set `REDIS_URL` to its `rediss://` URL), but BullMQ's polling
  burns Upstash's daily command quota quickly, so in-process is the better free
  choice until you run multiple API instances.
- **Custom domain later**: add it in Vercel (web) and update `WEB_URL` on
  Render + `NEXT_PUBLIC_API_URL` on Vercel; for a Clerk production instance,
  point its CNAMEs at your domain. No code changes.
