# EnvShare

EnvShare lets users create and manage `.env` projects, then share encrypted read-only views with anyone using a link.

## Stack

- Vite + React + TypeScript
- Clerk (authentication)
- Turso (libSQL/SQLite) backend storage
- Vercel serverless functions (`/api`)
- Tailwind + shadcn/ui + Framer Motion

## Local development

```bash
npm install
npm run dev
```

`npm run dev` starts the full stack on `http://localhost:5173` — the Vite
frontend **and** the `/api/*` functions. A dev-only Vite plugin
(`vite/api-dev-server.ts`) runs the same handler files locally and loads `.env`
into `process.env`, so no `vercel dev` / Vercel login is needed day to day.

Alternatively, to run against the real Vercel runtime:

```bash
vercel link
npm run dev:vercel
```

`npm run dev:vercel` serves both frontend and serverless functions on one port (usually `http://localhost:3000`).

## Environment variables

Copy `.env.example` to `.env` and fill in values:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
VITE_API_BASE_URL=
CLERK_SECRET_KEY=sk_test_xxx
TURSO_DATABASE_URL=libsql://xxx.turso.io
TURSO_AUTH_TOKEN=xxx
```

`VITE_API_BASE_URL` is optional. Leave it empty for same-origin API calls (recommended); set it only when frontend and API are hosted on different origins.

## Clerk setup

1. Create an app at [clerk.com](https://clerk.com/).
2. Copy:
   - Publishable key -> `VITE_CLERK_PUBLISHABLE_KEY`
   - Secret key -> `CLERK_SECRET_KEY`
3. In Clerk dashboard, enable sign-in/sign-up methods:
   - Email magic link
   - Google OAuth
   - GitHub OAuth
4. Set allowed redirect URLs for your deployed Vercel URL.

## Turso setup

1. Create a database at [turso.tech](https://turso.tech/) (free tier; unlike
   many free stores it does not delete inactive databases). You can use the
   dashboard or the [Turso CLI](https://docs.turso.tech/cli).
2. Copy the database URL and an auth token into `.env` (and Vercel project
   settings) as `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
3. Create the schema (`api/_lib/schema.sql`) — no CLI required:
   ```bash
   node --env-file=.env scripts/init-schema.mjs
   ```

## Deploying to Vercel

1. Import the repository in Vercel.
2. Add all five environment variables in the Vercel project settings.
3. Deploy.
4. Use preview deployments to verify API/auth behavior (`/api/projects`, `/api/share/:shareCode`).

## Security model

- Protected endpoints require Clerk Bearer tokens and enforce owner checks.
- Shared view endpoint is public (`/s/:shareCode` and `/api/share/:shareCode`).
- Environment payloads are encrypted client-side (Web Crypto AES-GCM).
- Encryption key stays in browser context (`#key=...` URL fragment and localStorage key cache).
