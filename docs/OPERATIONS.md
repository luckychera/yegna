# Running Yegna

This is how the API and the web app start today. It is not a production-readiness claim. Several product decisions are still open; see `docs/PROJECT_COMPLETION_CHECKLIST.md`.

The API loads environment variables from `backend/.env` only. A `.env` at the repository root is ignored. The web app loads `apps/web/.env`.

## Local startup

From `backend/`, after copying `backend/.env.example` to `backend/.env` and pointing `DATABASE_URL` at a PostgreSQL database:

```bash
npm run db:migrate
npm run dev
```

`npm run db:migrate` applies every SQL file in `backend/database/migrations` inside a transaction and records it in `schema_migrations`. `npm run dev` restarts the API with nodemon. `npm start` runs `node src/server.js` without reloading.

The API listens on `PORT` (default 5000). A local `backend/.env` may choose another port; the web app must be told that address.

From `apps/web/`, after copying `apps/web/.env.example` to `apps/web/.env`:

```bash
npm run dev
npm run build
```

`npm run dev` starts Vite. In development the browser calls `/api` on the Vite server, and Vite forwards those requests to `VITE_DEV_API_TARGET` (default `http://localhost:5000`). If the API is on another port, set `VITE_DEV_API_TARGET` to that origin. `npm run build` typechecks and writes the production bundle to `apps/web/dist`. `npm run preview` serves that bundle.

Install dependencies from the repository root with `npm install`. The repo is an npm workspace (`apps/web`, `apps/mobile`, `backend`).

## Environment

`backend/.env.example` lists every variable the loader reads. Required: `DATABASE_URL` and `JWT_SECRET`. In production `JWT_SECRET` must be at least 32 characters. Do not commit real secrets.

### Access tokens

`JWT_EXPIRES_IN` defaults to `15m`. Access tokens are stateless, so they remain valid until that time even after sign-out or a password change. The web app refreshes them using the refresh session stored in `auth_sessions`.

Setting `JWT_EXPIRES_IN=330m` overrides that default. A stolen access token would then work for five and a half hours. Leave the variable unset unless a deployment has a reviewed reason to change it. This document does not change the default.

### CORS and the web origin

`CORS_ORIGINS` is a comma-separated list of browser origins. Trailing slashes are removed. `APP_BASE_URL` is the public origin of the web app. When it is set, it is added to the trusted-origin list and is also the base for payment return URLs.

Outside production, `http://localhost`, `http://127.0.0.1` and `http://[::1]` (any port) are trusted without being listed, so the Vite dev server needs no CORS entry. In production only `CORS_ORIGINS` and `APP_BASE_URL` are trusted. Requests with no `Origin` header (curl, server-to-server) are not blocked by CORS.

### Trusted proxy

`TRUST_PROXY` is how many reverse proxies sit in front of the API. The default is `0`, which means the API is reached directly and does not trust `X-Forwarded-For`. Behind one proxy, set `TRUST_PROXY=1` so rate limits and session records use the client IP. A non-positive or invalid value falls back to `0`. Do not set this higher than the number of proxies you operate.

### Rate limits

Both limiters use `RATE_LIMIT_WINDOW_MS` (default 15 minutes, `900000`). The general limiter allows `RATE_LIMIT_MAX` requests per window (default 600). Login and register (`/api/v1/auth/login` and `/api/v1/auth/register`) allow `AUTH_RATE_LIMIT_MAX` (default 20) and answer with `RATE_LIMITED` when that budget is spent. Invalid or non-positive values fall back to these defaults.

### Database

`DATABASE_URL` is the PostgreSQL connection string. Migrations are the schema. Membership numbers (`YG-XXXX-XXXX`) and card verification codes are assigned by the trigger `community_memberships_assign_identifiers` when a membership's status is `active`. Pending memberships do not receive either value.

### Chapa

`CHAPA_SECRET_KEY` is sent as the bearer token. A payment cannot start while it is empty (`CHAPA_SECRET_KEY_NOT_CONFIGURED`). `CHAPA_BASE_URL` defaults to `https://api.chapa.co`; override it only to point contract tests at a fake server. `CHAPA_MODE` and `CHAPA_WEBHOOK_SECRET` are read by the loader and are not used. There is no webhook handler.

### Fayda

`FAYDA_MODE=mock` (the default) checks the identifier against the built-in development records. Any other value throws `Real Fayda provider is not configured`. There is no live Fayda integration.

### Unused keys

`AI_API_KEY`, `SMS_API_KEY` and `EMAIL_API_KEY` are read and unused. No AI, SMS or email feature calls them. Leave them empty.

## Operational checks

Before treating a deployment as usable:

- `GET /` returns `{ "success": true, "service": "yegna-api" }`.
- `schema_migrations` contains every file in `backend/database/migrations`, including `025_system_roles_and_invitation_role.sql`.
- New active memberships receive the member role unless an authorized invitation stored another predefined role. Pending invitations do not grant permissions. Only the community creator can appoint another administrator, and the last active administrator cannot be demoted.
- `CORS_ORIGINS` and `APP_BASE_URL` match the web origin that browsers will use. A production API with neither set rejects browser calls.
- `TRUST_PROXY` matches the real proxy count. Wrong values mis-attribute rate limits.
- `JWT_SECRET` is unique to that environment and at least 32 characters in production.
- `JWT_EXPIRES_IN` is unset, or the longer value was chosen deliberately.
- `CHAPA_SECRET_KEY` is set only where payments should work, and `CHAPA_BASE_URL` still points at Chapa unless you are running a contract test.
- Server logs show startup and, on failure, `console.error` lines prefixed with `[error]`. Responses for unexpected errors say "An unexpected error occurred" and do not include the exception text. There is no log shipper in this repo.
- PostgreSQL backups are an operator task. This repo does not schedule or store backups. Take a backup before running migrations on a database that already has data.

## Build and test

From `apps/web`: `npx eslint` on changed files, `npx tsc -b`, `npx vitest run`, `npx vite build`.

From `backend`: `npm test`. The pretest seeds a shared fixture. Do not point `DATABASE_URL` at a database you cannot reset.

`backend/tests/chapa.contract.test.js` runs the real Chapa client against a local fake server. It passed on 2026-11-27. It does not call Chapa, and it does not cover a webhook. The client has no request timeout; a server that accepts the connection and never answers is not failed by the client. A refused connection is an error and does not mark the payment successful.

The broader live contract (`npm run test:integration` in `apps/web`) still needs a running API and three unused mock Fayda IDs. Those IDs are already registered in the local database, so that suite was not re-run.
