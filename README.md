# EnvShare

EnvShare lets users create and manage `.env` projects, then share encrypted read-only views with anyone using a link.

## Stack

- Vite + React + TypeScript
- Clerk (authentication)
- Upstash Redis (backend storage)
- Vercel serverless functions (`/api`)
- Tailwind + shadcn/ui + Framer Motion

## Local development

```bash
npm install
npm run dev
```

`npm run dev` starts the Vite frontend on `http://localhost:5173`.
For full-stack local development (frontend + Vercel `/api/*` functions), run:

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
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
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

## Upstash Redis setup

1. Create a Redis database at [upstash.com](https://upstash.com/).
2. From the database REST API section, copy:
   - REST URL -> `UPSTASH_REDIS_REST_URL`
   - REST TOKEN -> `UPSTASH_REDIS_REST_TOKEN`
3. Add both to your `.env` and Vercel project environment variables.

## Deploying to Vercel

1. Import the repository in Vercel.
2. Add all four environment variables in the Vercel project settings.
3. Deploy.
4. Use preview deployments to verify API/auth behavior (`/api/projects`, `/api/share/:shareCode`).

## Security model

- Protected endpoints require Clerk Bearer tokens and enforce owner checks.
- Shared view endpoint is public (`/s/:shareCode` and `/api/share/:shareCode`).
- Environment payloads are encrypted client-side (Web Crypto AES-GCM).
- Encryption key stays in browser context (`#key=...` URL fragment and localStorage key cache).