# Release checklist

Use this before a deployment. Checking a box means someone observed that behavior in the target environment. This list does not make Yegna production-ready; open product decisions are in `docs/PROJECT_COMPLETION_CHECKLIST.md`.

## Environment

- [ ] `backend/.env` was copied from `backend/.env.example` and filled in on the server. The API does not read a root `.env`.
- [ ] `DATABASE_URL` points at the intended PostgreSQL database.
- [ ] `JWT_SECRET` is unique to this environment and at least 32 characters when `NODE_ENV=production`.
- [ ] `JWT_EXPIRES_IN` is unset (15-minute access tokens) or `330m` was chosen on purpose. The longer value overrides the default.
- [ ] `CORS_ORIGINS` lists the web origin. `APP_BASE_URL` is that origin, with no trailing slash.
- [ ] `TRUST_PROXY` is `0` when the API is reached directly, or the real proxy count otherwise.
- [ ] `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` and `AUTH_RATE_LIMIT_MAX` are unset (15 minutes, 600, and 20) or set to reviewed numbers.
- [ ] `FAYDA_MODE` is `mock` only on a development server. A live Fayda provider does not exist.
- [ ] `CHAPA_SECRET_KEY` is set where payments should run, and is empty otherwise. `CHAPA_BASE_URL` is Chapa's API unless this host is a contract-test box.
- [ ] `CHAPA_WEBHOOK_SECRET`, `AI_API_KEY`, `SMS_API_KEY` and `EMAIL_API_KEY` are empty. Nothing in the app uses them.
- [ ] No secret from this environment appears in git, logs, or the web bundle.

## Database

- [ ] `npm run db:migrate` (from `backend/`) completed, and `schema_migrations` lists every migration through `025`.
- [ ] Trigger `community_memberships_assign_identifiers` exists. Activating a membership assigns `membership_number` and `card_verification_code`. A pending membership has neither.
- [ ] A database backup was taken before migrating an existing database. This repo does not take backups.

## Authentication and authorization

- [ ] Register, login, refresh, and sign-out work against this database.
- [ ] An access token expires according to `JWT_EXPIRES_IN` (15 minutes when unset). Refresh still issues a new one.
- [ ] Password change revokes sessions. The web app returns the user to login.
- [ ] A member without `announcements.manage` can read announcements and mark them read, and cannot create, edit, or archive them.
- [ ] The API, not only the hidden buttons, returns a permission error for those writes.
- [ ] A direct join and an approved request become the member role, with a membership number, only after the membership is active.
- [ ] An ordinary member's invitation has no role picker and always results in member. Sending `roleId` for admin from that account returns 403.
- [ ] An administrator can invite into a role they are allowed to assign. The role applies when the invitation is accepted, not while it is pending.
- [ ] Only the community creator can appoint another administrator. A person cannot change their own role. The last active administrator cannot be demoted.
- [ ] A role change appears in `audit_logs` as `role.changed` and is not editable by a member.

## Memberships, contributions, and payments

- [ ] Approving a membership shows a membership number and a card code afterward.
- [ ] A member can see their own contributions and start a payment only when Chapa is configured.
- [ ] Checkout verifies the payment with Chapa. There is no webhook. Do not mark a payment successful from an unverified callback.
- [ ] `node --test tests/chapa.contract.test.js` (from `backend/`) passed on this build. A local run on 2026-11-27 passed against a fake server. There is still no webhook. The web live-contract suite was not re-run because its three mock Fayda IDs are already registered.

## Announcements and notifications

- [ ] An active member sees the community announcements tab, including an empty state.
- [ ] A manager can publish, edit, and remove an announcement. Remove asks for confirmation first.
- [ ] Opening an unread announcement marks it read.
- [ ] The dashboard panel lists `GET /announcements/me` and each item opens that announcement.
- [ ] An announcement notification opens the announcements tab and, when `entity_id` is present, the detail. A notification with no community id stays on the notifications page.
- [ ] Other notification types still open invitations, memberships, contributions, or payments.

## QR code and public verification

- [ ] On a membership card, the QR image paints. Its contents are only `{origin}/verify/{code}`.
- [ ] "Open verification page" opens the same public page when the image cannot be drawn.
- [ ] An active card shows the community, the holder, and the membership number.
- [ ] An inactive card shows the community name and status only.

## Browser

- [ ] Light mode and dark mode: primary and danger buttons stay readable. The sidebar stays dark with light text.
- [ ] A narrow viewport and a wide viewport: account sections, dialogs, and the announcements list do not clip, and controls can be reached.
- [ ] Keyboard: dialogs trap focus, Escape closes them, and the skip link works.
- [ ] `prefers-reduced-motion` is still an outstanding check. Do not claim it passed.

## Logging and failures

- [ ] `GET /` answers with the service payload.
- [ ] A forced 500 logs `[error]` on the server and returns "An unexpected error occurred" without a stack trace.
- [ ] Client errors log `[warn]` and return the safe message.
- [ ] Logs are retained by the host. This repo does not ship them anywhere.
