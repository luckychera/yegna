# Yegna web app

React + TypeScript single-page app for Yegna (communities, memberships, contributions, payments,
notifications, reports). It talks only to the existing Yegna API (Node/Express/PostgreSQL).

## Run the whole application locally

Requirements: **Node 20+** and **PostgreSQL 14+**.

```bash
# 1. install everything (npm workspaces: backend + apps/web)
npm install

# 2. database + backend
createdb yegna
cp backend/.env.example backend/.env      # then edit DATABASE_URL, JWT_SECRET, CHAPA_SECRET_KEY
npm run db:migrate --workspace backend
npm run dev --workspace backend           # API on http://localhost:5000

# 3. web app (second terminal)
cp apps/web/.env.example apps/web/.env    # optional: the defaults work locally
npm run dev --workspace apps/web          # http://localhost:5173
```

In development Vite proxies `/api` to the backend (`VITE_DEV_API_TARGET`, default
`http://localhost:5000`), so no CORS setup is needed.

### Try it

1. Open http://localhost:5173 and **Sign Up**. With `FAYDA_MODE=mock` the Fayda step accepts three test
   IDs, each usable once: `100000000001` (FIN), `100000000002` (FAN), `100000000003` (FIN).
2. Create a community. You become its administrator and see Members, Contributions, Payments,
   Invitations and Reports on its page.
3. Register a second person, **Join** the community, then approve them as the administrator.
4. As administrator create a contribution for that member (Contributions → New Contribution).
5. As the member open Contributions → **Pay**. You are sent to Chapa (needs a Chapa **test** key in
   `backend/.env`); after paying you return to `/payments/return`, where the backend confirms the
   payment with Chapa. Nothing is ever shown as paid until the backend has verified it.

## Commands

| Task | Command (from the repo root) |
| --- | --- |
| Web unit/component tests | `npm test --workspace apps/web` |
| Typecheck | `npm run typecheck --workspace apps/web` |
| Production build | `npm run build --workspace apps/web` |
| Lint (web + backend) | `npm run lint` |
| Backend tests | `npm test --workspace backend` (needs PostgreSQL and `DATABASE_URL`) |
| **Live contract test** (web API layer vs the real backend) | see below |

### Live contract test

Runs the web app's real API modules against a running backend, with a small fake Chapa server so the
backend's real payment code executes. Start the backend with `CHAPA_BASE_URL=http://127.0.0.1:5099`
and `FAYDA_MODE=mock`, on a database where the three mock Fayda IDs are unused, then:

```bash
YEGNA_API_URL=http://127.0.0.1:5000/api/v1 npm run test:integration --workspace apps/web
```

It stays under the API's 100-requests-per-15-minutes limit, so restart the backend between runs.

**Install from the repo root with a plain `npm install`** (not `--workspace apps/web` alone): the web app
resolves some React type packages that are hoisted to the root, and a partial install can make `tsc` report
bogus implicit-`any` errors.

## Configuration (`apps/web/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api/v1` | API base URL. Keep it same-origin in production (reverse proxy), or set an absolute URL and allow the web origin in the backend CORS settings. |
| `VITE_DEV_API_TARGET` | `http://localhost:5000` | Where the dev server proxies `/api`. |

## How it is organised

```
src/app/        providers, router (lazy routes, guards), layouts
src/components/ ui primitives, layout (sidebar/top bar/bottom nav), feedback states, data display
src/features/   auth, dashboard, communities, memberships, invitations, contributions,
                payments, notifications, reports, profile  (each: api, types, hooks, pages)
src/lib/        api client + errors, auth/token handling, formatting, validation
```

Design rules worth knowing:

- **Permissions** come from the backend's permission strings (`GET /communities/me`), never from role
  names. Hidden UI is a convenience; the API still enforces everything.
- **Tokens**: the access token lives in memory only; the refresh token is in `localStorage`. Refreshes are
  single-flight and serialized across tabs (Web Locks), because the backend revokes *every* session if a
  rotated refresh token is ever reused.
- **Money** is always `ETB 12,500`, from decimal strings returned by the API.

## Known limitations

These come from what the backend supports today; the app does not pretend otherwise.

- **Brand assets**: no Yegna logo files were in the repository. `BrandLogo` renders a text wordmark and
  `public/favicon.svg` is a plain placeholder. Replace both with the official assets.
- **Official credentials**: Fayda is the built-in **mock** (3 test IDs). Payments need a Chapa **test**
  secret key; going live needs official Chapa (and Fayda) credentials and a real Fayda provider.
- **Chapa confirmation** happens when the member returns to `/payments/return` (or presses *Check status*
  on Payments). There is no Chapa webhook, so a member who pays and never returns stays "pending" until
  they check. The backend's verify endpoint is the only thing that can mark a payment successful.
- **Not offered (no backend support)**: Fayda sign-in, forgot password, language/notification settings,
  profile editing or avatar upload, community location/cover images, events, report export, inviting
  members by email/phone (needs a user lookup endpoint; invitations to existing members can be accepted,
  rejected and revoked).
- **Roles**: a community only gets an `admin` role and the API cannot assign others, so ordinary members have
  no community permissions: they can browse, join/leave, accept invitations, pay their own contributions and
  see their own contributions/payments/notifications, but not member lists or community reports.
- **Reports** are aggregates "to date": contributions are counted by due date, so future dues are not in
  "month/quarter/year to date". "All time" has no date filter.
- **Rate limit**: the API allows 100 requests per 15 minutes per IP (shared by everyone behind one address).
- **Visual QA**: layouts were verified by tests and a build, not by looking at them in a browser. Please
  review desktop, tablet and phone widths before release.
- **Format check**: the repo has no Prettier configuration, so `format:check` is not part of the gates.
