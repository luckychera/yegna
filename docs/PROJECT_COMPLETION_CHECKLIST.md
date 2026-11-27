# Yegna completion checklist

Last updated: 2026-11-27, after browser checks of invitations and roles, a measured contrast adjustment, and the Chapa fake-server contract test. The earlier notes below still stand. A local commit is created only after the checks in this file. Nothing is pushed.

Work is on `main`. `upstream/development` is an ancestor of `main` (it was merged through the imported master history). The completion commits are only on `main`, so this work was not moved onto a `development` branch. Nothing was merged, switched, committed, or pushed in this stage.

Nothing in this file is a claim of production readiness.

## Branch and save point

- Committed on `main`, not pushed: backend account and announcements APIs (`c48a007`), payment and authorization hardening (`4d333f8`), test and install fixes (`d46f0e8`). `main` is 39 commits ahead of `origin/main`.
- Not committed, by request: the account workspace UI, the announcements UI, contrast tokens, `qrcode`, the release documents, and the role-management work (migration `025`, `backend/src/modules/role/`, invitation and membership wiring, and the member and invitation screens). See `git status`.

## Phase 4 — Frontend UI/UX

| Task | Status | Evidence |
| --- | --- | --- |
| Light, dark, and system theme, persisted | Implemented, and light and dark were opened in Chrome | `ThemeProvider` and the top-bar selector. Account cards and security were captured in both themes. System theme was not switched during this pass. |
| Primary and danger button contrast in dark mode | Implemented; dark security and announcement screens looked readable | `--color-on-primary` and `--color-on-danger`. "Update password" and "Remove" were readable in the captures. This was not a measured contrast audit. |
| Dashboard welcome, metric cards, announcements panel, empty states | Partially implemented | The announcements panel uses `GET /announcements/me` and is unit-tested. Recent activity rows are still not links. No fake stats were added. |
| Consistency pass across the other pages | Partially implemented | Profile and announcements were built on the existing design system. Other pages were not restyled. |
| Reduced motion | Implemented in CSS, and the computed duration was checked | With `prefers-reduced-motion: reduce`, a link's transition and animation durations computed to about 0.01ms. Motion was not watched by eye. |

## Role management

Implemented and covered by `backend/tests/role.api.test.js` plus the existing backend suite (217 passed on 2026-11-26) and the community page tests. Not yet exercised in a browser.

| Rule | Status |
| --- | --- |
| Predefined roles only: member, committee member, secretary, treasurer, admin | Implemented in `role.catalog.js`. No custom-role API. |
| New communities receive all five roles. The creator stays admin | `createCommunity` calls `ensureSystemRoles` and still assigns admin to the creator. Existing admin permission lists are not rewritten. |
| Direct join, approved join, and an invitation with no chosen role become member once the membership is active | Pending requests and pending invitations have no role and no membership number. |
| An administrator chooses a role when inviting. It is stored on the invitation and applied only on acceptance | Ordinary members have no role picker. A crafted privileged `roleId` returns 403 `ROLE_ASSIGNMENT_DENIED`. |
| Only the community creator who is currently an admin can appoint another admin | Other admins can assign roles below their own rank. Nobody can change their own role. Another person cannot change the creator's role. |
| The last active administrator cannot be demoted | Returns 409 `LAST_ADMINISTRATOR`. |
| Role changes are audited as `role.changed` | Community, membership, previous roles, new role, actor, and time. Ordinary members do not have `audit.view`. |
| Migration `025` | Adds `community_invitations.role_id`, backfills the four non-admin roles, and assigns member to active memberships that had no role. Applied locally with `node database/migrate.js`. |

The member screen shows the role and, for someone with `roles.assign`, a confirmed change. The invitation screen accepts an email. A role select appears only when the caller has `roles.assign`.

## Phase 5 — Account workspace

The profile is no longer one card. `/profile` is a sectioned account workspace. `/settings` redirects to `/profile?section=security`.

| Section | Status | What is real |
| --- | --- | --- |
| Overview | Implemented, unit-tested | Name, email, phone, account status, registration date, edit action. No Fayda digits. |
| Personal information | Implemented, unit-tested | Edits only `PATCH /users/me` fields. Zod matches the backend rules. Email, phone, and Fayda stay read-only. Save disables while submitting. |
| Identity verification | Implemented, unit-tested | `GET /identity/me`. Status, provider, identifier type, date. `verificationMode: mock` is labeled a development check. A 404 is "Not verified", not an error. No reference number is shown, because the API does not return one. |
| Memberships | Implemented, unit-tested | `GET /communities/me` (default statuses: pending, active, suspended; limit 100). Number, role, status, joined date, link to the community. A missing number stays "Not issued yet". "Manage memberships" goes to the existing memberships page. |
| Membership cards | Implemented, unit-tested | `GET /membership-cards/me`. Number, community, role, status, issue date. QR payload is only `{origin}/verify/{code}`. Regenerating a code calls the real endpoint after a confirmation. |
| Public card check | Implemented, unit-tested | `GET /membership-cards/verify/:code`, outside the signed-in shell. Invalid cards omit the holder and number. |
| Security | Implemented; one revoke path unit-tested | Password change uses the existing endpoint and then signs out locally, because the backend revokes every session. Device list, sign-out of one other device, and sign-out of other devices use the session APIs. Tokens without a session id cannot revoke devices; the screen says so instead of offering a control that would fail. |
| Notification preferences | Implemented, unit-tested | `GET` and `PATCH /notifications/preferences`. In-app categories only. Email and SMS are not offered. |

Browser check, 2026-11-26, headless Chrome against the local API (`http://127.0.0.1:5055`) and Vite (`http://127.0.0.1:4178`):

- Wide light and wide dark: the membership card shows a real QR image (168×168 PNG data URL). "Open verification page" is on screen. Page width matched the viewport (no horizontal overflow).
- The verification link opened `/verify/{code}` without asking for a session first. An active card showed Browser Check Community, Active, the holder, and membership number `YG-3863-MV97`.
- Narrow light (390px): after scrolling the card into view, the QR and the verification link sit above the bottom navigation. They do not overlap it. A full-page capture made the fixed bar look as if it cut the QR; that was the capture, not the layout.
- The phone account nav scrolls sideways. Later section names start off the first screen and remain reachable by scrolling that row.
- Dark "Issue a new code" computed as light text (`rgb(241, 245, 249)`) on the card surface. "Update password" was readable in the dark security capture.
- Keyboard: the first Tab on the phone cards page landed on "Skip to content". A full keyboard walk was not done.

`authApi.updateProfile` now returns the profile payload. The old code read `data.data` after the client had already unwrapped the envelope.

## Phase 6 — Remaining features

| Task | Status | Notes |
| --- | --- | --- |
| Announcements API | Implemented and covered by backend tests in the previous session (`tests/announcement.api.test.js`, included in 209 passing). Not re-run this stage. | Create, edit, archive, read state, member notifications, mute respected. No scheduler. |
| Announcements UI | Implemented, unit-tested, and exercised in Chrome against the real API | Community tab for active members: list, detail, create, edit, remove with confirmation, mark read, loading, empty, and error states. Management buttons require `announcements.manage`. The API still enforces that. In the browser, an administrator published "Sunday notice", opened the detail, and saw it on the dashboard from `GET /announcements/me`. Announcement notifications open `?tab=announcements` and `&announcement=` when the id is present. A missing or blank community id does not navigate. |
| Notification read and unread count | Implemented earlier; announcement navigation added | Other notification types still open invitations, memberships, contributions, or payments. |
| Payments and Chapa | Contract test passed locally on 2026-11-27 | `backend/tests/chapa.contract.test.js` uses a fake server. Checkout, verify, failure, a bad body, a refused connection, amount, and transaction reference are covered. A browser success flag does not settle a payment. No webhook. The client has no timeout of its own. |
| AI features | Not started, on purpose | No AI endpoint exists. No AI button was added. `AI_API_KEY` is loaded and unused. |

## Phase 7 — Quality

Run this stage, from `apps/web`, on 2026-11-26:

- `npx eslint` on the announcement, notification, community, dashboard, validation, and test files touched for this stage: passed, no errors.
- `npx tsc -b`: passed.
- `npx vitest run`: 17 files, 162 tests passed. That includes the new announcements tests and the earlier profile tests.
- `npx vite build`: passed.

After the role screens, on the same date:

- `npx eslint` on the role, invitation, membership, and community files: passed.
- `npx tsc -b`: passed.
- `npx vitest run`: 17 files, 165 tests passed.
- `npx vite build`: passed.

Not run this stage:

- Backend `npm test` was re-run after the role work: 217 passed, 0 failed. That includes `tests/role.api.test.js` and the earlier account and announcement tests.
- Live contract test against Chapa's fake server.
- A full keyboard walk and a measured contrast audit. The Chrome pass covered light, dark, 390px, and 1280px for the account card, the public verify page, and one announcement. Reduced-motion CSS computed to about 0.01ms. The first Tab reached "Skip to content".
- Full-repo ESLint. Two pre-existing `react-refresh` warnings remain in `ThemeProvider.tsx` and `I18nProvider.tsx`.

## Phase 8 — Release preparation

Partially implemented. Documents only. No security default was changed.

| Item | Status |
| --- | --- |
| `backend/.env.example` matches `backend/src/config/env.js` | Written. The API loads `backend/.env` only. |
| Root `.env.example` | Replaced with a pointer. It is not a second, conflicting variable list. |
| `docs/OPERATIONS.md` | Written. Startup, build, CORS, trusted proxy, rate limits, token lifetime, database, Chapa, Fayda mock, unused keys, operational checks. |
| `docs/RELEASE_CHECKLIST.md` | Written. The boxes are unchecked. Nobody has run them against a deployment. |
| Access-token lifetime | Still defaults to 15 minutes. `JWT_EXPIRES_IN=330m` is documented as an override. It was not applied. |

## Known limits

- Access tokens default to 15 minutes. A deployed environment that still sets `JWT_EXPIRES_IN=330m` keeps the old lifetime. Changing that is a deployment choice, not a code change.
- A newly activated membership receives the member role unless an authorized invitation stored a different role. Pending memberships still have no role. A membership that was already active before migration `025` and already had a role is left on that role.
- Announcements stay readable by any active member. The member role does not include `announcements.manage`.
- Contributions, finance, and role changes still require their own permissions. A member cannot grant those to themselves.
- Membership numbers and card codes are created by `community_memberships_assign_identifiers` when a membership becomes active. Pending memberships have neither.
- The public verify response for an inactive card includes the community name and status only.
- QR codes need a browser canvas. The verification link is the fallback. Headless Chrome did paint the image and the link opened the public page. jsdom still cannot paint it, which is why the unit test checks the link.
- The Chapa fake-server contract test passed locally. `CHAPA_WEBHOOK_SECRET` is loaded and unused. There is no webhook. The Chapa client does not time out a connection that stays open.
- `AI_API_KEY`, `SMS_API_KEY`, and `EMAIL_API_KEY` are loaded and unused.
- A full keyboard walk and a measured contrast audit remain outstanding. Reduced-motion CSS is present and its computed duration was checked. Light, dark, narrow, and wide layouts were looked at for the account card, public verification, and one announcement.
- Full-repository ESLint still has two pre-existing React Fast Refresh warnings in `ThemeProvider.tsx` and `I18nProvider.tsx`.

## Browser and contrast, 2026-11-27

Headless Chrome against the local API on port 5055 and Vite on port 4178.

- An ordinary member can invite by email, sees no role selector, and a crafted admin `roleId` returns 403 `ROLE_ASSIGNMENT_DENIED`.
- The community creator sees the role selector, invites someone as treasurer, and that role is absent until acceptance. After acceptance the person is an active treasurer (`YG-5NCQ-BS4J`). An invitation with no privileged role becomes member (`YG-23VF-UWGH`).
- The creator changes a member to secretary. The dialog names that member. The table shows Secretary only after the API succeeds. The change is in `audit_logs` as `role.changed`.
- The creator's own row has no role control. A second administrator cannot demote the creator; the creator stays admin.
- Light and dark, 1280 and 390: no horizontal overflow. The role dialog stays inside the viewport.
- First Tab in the signed-in shell is "Skip to content". Escape closes the role dialog. Focus moves into the invite dialog.
- Reduced motion computed transition and animation durations of `1e-05s`.
- Measured text contrast after the token change: body 17.06:1 light and 16.56:1 dark; muted text 6.15:1 light and 6.67:1 dark. Primary button text on the primary fill is 5.11:1 light and the dark on-primary pairing is 8.23:1. Focus outline against the page background is 4.89:1 light and 7.80:1 dark.
- The login page's first control is the language switch, because that page is outside the signed-in shell. The public verify error page's first control was "Try again".
- The auth rate limit stopped a later login, so the treasurer's community tabs were not opened again in the browser. The database shows the treasurer role and membership number after the acceptance click.

## Next task

Do not describe this build as production-ready. A deployment still has to walk `docs/RELEASE_CHECKLIST.md`. The web live-contract suite needs three unused mock Fayda IDs. There is no Chapa webhook and no Chapa client timeout.
