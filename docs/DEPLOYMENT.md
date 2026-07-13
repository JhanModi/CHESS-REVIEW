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
created automatically on first deploy. Seed openings once from your machine
against Neon:
```bash
DATABASE_URL="<neon pooled url>" pnpm --filter @tempo/db exec tsx src/seed.ts
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

Build/start are already defined in the blueprint:
- build: `pnpm install --frozen-lockfile && pnpm --filter @tempo/db generate && pnpm turbo run build --filter=api`
- start: `pnpm --filter @tempo/db exec prisma migrate deploy && node apps/api/dist/main.js`

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

## Notes & gotchas

- **Cold starts**: Render free sleeps after ~15 min. First request wakes it
  (~30–50 s), then it's fast. Upgrade to Starter ($7/mo) for always-on.
- **Server-side engine (M7)** needs Redis — add Upstash (free tier) and set
  `REDIS_URL`; the queue/cache switch to BullMQ automatically.
- **SharedArrayBuffer / threads**: the COOP/COEP headers in `next.config.ts`
  ship via Vercel, so multithreaded Stockfish works on the deployed site.
- **Analysis runs in the browser**, so the free API stays light — it only
  stores games and derives classifications from submitted evals.
