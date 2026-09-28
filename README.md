# eGuard — Parent Web App

Parent dashboard and backend control center for eGuard, a family digital-safety platform for Android and iOS devices.
Parents manage children and devices, change protections, and see **Configuration Health**: whether each protection
is set up and verified on each device. It measures configuration, never a child's behavior.

**Stack:** Next.js 16 (App Router, React 19, TypeScript), Tailwind CSS v4, PostgreSQL 16, Prisma 6.19.3, Zod, Leaflet.

## Quick start

```bash
npm install
npm run db:up          # Postgres 16 in Docker on localhost:55433
npx prisma migrate dev # create tables
npm run db:seed        # demo family (Randy, Ana, Mia, Lucas, Sophie, 5 devices)
npm run dev            # http://localhost:3000
```

Sign in with **randy@example.com / ChangeMe123!** (Family Admin) or **ana@example.com / ChangeMe123!** (Parent).

Copy `.env.example` to `.env` if it's missing. Port 55433 is used because a native Postgres service owns 5432 on the
original dev machine; change `docker-compose.yml` and `DATABASE_URL` together if you want another port.

> npm 11 blocks install scripts by default. If Prisma or esbuild complain, run
> `npm approve-scripts @prisma/client @prisma/engines prisma esbuild unrs-resolver && npm rebuild`.

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` (run `npx next typegen` first after adding routes) |
| `npm test` | Vitest unit tests (health scoring, verification rules, profiles, social sign-in tokens) |
| `npm run test:api` | HTTP and service tests against a running server (`API_BASE_URL`, default `http://localhost:3000`) whose `SMTP_URL` points at Mailpit. Creates and deletes its own families. Start the server with `CRON_SECRET=test-cron-secret RATE_LIMIT_IP_ALLOWLIST=::1,127.0.0.1` so the maintenance-job tests can run and one machine can register many test families |
| `node scripts/e2e-smoke.mjs` | End-to-end smoke test against a running dev server (needs Chrome and the seeded DB). Set `BASE_URL`, `SHOTS` |
| `npm run db:seed` / `db:reset` | Reseed / reset the database |

## What's built

- **Auth:** registration creates a family and its admin; sign-in with DB-backed sessions in an httpOnly cookie
  (bcrypt, 30-day expiry). Forgot/reset password by emailed link (signs out every session). Changing the email
  needs the password. Rate limits are kept in Postgres (`src/lib/rate-limit.ts`): failed sign-ins lock an account
  after 10 tries in 15 minutes from anywhere, and per-address limits cover sign-in, sign-up, social sign-in,
  pairing, links and password resets. Roles: `FAMILY_ADMIN` and `PARENT`.
- **Account deletion:** Settings › Export or delete data, and `DELETE /api/mobile/v1/me`. The admin's account takes
  the whole family with it; another parent's removes only them.
- **Dashboard:** hero summary, Family Protection score, children, devices, today's activity (screen time, apps,
  location, device status), device protection status, weekly screen-time trend, recent alerts, quick actions.
- **Children:** list, add, edit, delete (password-confirmed). Each child has 8 tabs: overview, activity, apps
  (approve/decline requests, per-app limits), screen time, protection checks, location, devices, history.
- **Devices:** grouped by child, pairing codes for new devices, and a detail page with every protection, its platform
  capability and verification time. Rename and remove devices; run a configuration check on one device.
- **Protection:** the Configuration Health ring (10 checks), a breakdown by status, all protections with their
  Android/iOS capability, and a guide to what each capability means.
- **Configuration workflow:** select, review current config, choose new config, confirm, apply or guided setup,
  verify, health updated. See below.
- **Notifications:** filters by category, severity labels, unread state, mark all read, dismiss info items, show
  resolved. Each alert has an action: fix the setting, view the device, review the app, and so on.
- **Reports:** Today, 7 days, 30 days or a custom range. Health, average screen time vs the previous period,
  protection changes, device health, top apps, a change timeline, and CSV export.
- **Location:** a Leaflet/OpenStreetMap map of current locations only. Children who don't share location get a
  "Turn on" link into the guided flow.
- **Settings:** account and family time zone, family members (admin can add or remove parents), notification
  preferences, privacy controls, security (sessions, password), subscription, connected devices, platform
  integrations, data export (JSON), support.
- **Search** (press `/`): children, devices, protection policies, alerts and settings.
- Light, dark and system themes (stored in a cookie, so there's no flash on load). Responsive layouts: sidebar on
  desktop, icon rail on tablet, bottom nav and drawer on phones.

## How verification works

The core rule: **eGuard never reports a setting as successful until the device confirms it.**

```
Parent submits change ──► ConfigRequest per device (PENDING, or AWAITING_PARENT for guided setup)
                              │
   Android "Available" ───────┤ device picks it up on /sync  ─► DELIVERED
   iOS "Guided setup" ────────┤ parent follows steps, taps "Verify now" ─► DELIVERED + full report requested
                              ▼
Device POSTs /report with the config it actually has
                              │
         matches request? ── yes ─► VERIFIED, policy updated, history entry, alerts resolved, health recomputed
                              └─ no ──► FAILED (with the reported value)
```

- `src/lib/engine.ts` holds `deviceSync()`, `processReport()` and check runs. Both the device API and the simulator
  go through it.
- `src/lib/health.ts` computes the score. Each check takes the worst status across devices, and `UNSUPPORTED`
  never counts against the score.
- `src/lib/protections.ts` is the catalog of the 10 protections, the per-platform capability matrix
  (`AVAILABLE`, `GUIDED`, `VERIFY_ONLY`, `UNSUPPORTED`), guided-setup steps, config shapes and labels.
- When a device reports a config that no longer matches policy and no request explains it, eGuard raises
  "Protection setting changed", or "Location sharing turned off" for location.

### Device simulator (development only)

The seeded devices have `simulated = true`. With `DEVICE_SIMULATOR=true` (and never in production), polling
endpoints advance these devices through the **same** sync and report code a real phone uses, so the whole
workflow runs without the mobile apps. The Galaxy Tab A8 is seeded offline and never answers. That's how
"Waiting for the device to come online" and "Couldn't reach" states appear. Devices paired through the API are real
devices and are never simulated.

## Device API (`/api/device/v1`) — for the Android and iOS apps

All endpoints except `pair` need `Authorization: Bearer <device token>`. Only a SHA-256 hash of the token is stored.

| Endpoint | Body | Purpose |
|---|---|---|
| `POST /pair` | `{ code, platform: "ANDROID"\|"IOS", name, model, kind: "PHONE"\|"TABLET", osVersion, appVersion? }` | Exchange a one-time code from the Devices page for `{ deviceId, token }`. Enforces the plan's device limit. |
| `POST /sync` | `{ battery?, osVersion?, appVersion? }` | Heartbeat. Returns `policy` (all 10 protections), `requests` to apply, `apps` rules, `fullReportRequested`, `nextSyncSeconds`. |
| `POST /report` | `{ protections: [{ key, config }], full?: boolean }` | The config the device actually has. Send `full: true` with all protections when `fullReportRequested`. |
| `POST /usage` | `{ date: "YYYY-MM-DD", totalMinutes, apps: [{ name, minutes }], hourly?: number[24] }` | Daily totals, optionally per local hour (for the app's hourly chart). Idempotent: the latest total wins. |
| `POST /location` | `{ lat, lng, accuracyM?, placeLabel? }` | Current location, overwriting the last one. Visits are recorded only when the family turns on location history. |
| `POST /events` | `{ type: "APP_INSTALLED", app }` \| `{ type: "APP_REQUESTED", app }` \| `{ type: "LIMIT_REACHED", minutes }` \| `{ type: "APP_BLOCKED", app }` | Raise alerts or approval requests. `APP_BLOCKED` (the child tried to open a blocked app) alerts at most once per app per hour. |

Config objects match `ProtectionConfig` in `src/lib/protections.ts`, for example
`{ "key": "BEDTIME", "config": { "enabled": true, "start": "21:30", "end": "06:00", "days": "EVERY_DAY" } }`.

## Parent mobile API (`/api/mobile/v1`) — for the iOS/Android parent app

Everything the parent app's screens need (see `public/ios.png`). **Full reference for app developers:
[docs/mobile-api.md](docs/mobile-api.md)**. Sign in returns
`{ token, expiresAt, user }`; send `Authorization: Bearer <token>` on every other call and keep the token in
the Keychain. Tokens are ordinary 30-day sessions, so "sign out other sessions" and password changes cover the
web and phones alike. Send `X-eGuard-Client: ios` or `android` so history reads "Randy Cruz on iOS app".
Errors are `{ error, code? }` with a message you can show to the parent (`400` invalid, `401` sign in again,
`403` admin only or wrong password, `404` not in your family, `409` conflict or unsupported, `415`/`413` photo).
Dates are ISO strings; `…Label` fields are pre-formatted in the family's time zone.

The web server actions and this API share `src/lib/config-service.ts` and `src/lib/family-service.ts`, so both
follow the same rules. In particular, a change counts only once each device has verified it.

| Screen | Endpoints |
|---|---|
| Launch / About | `GET /app-info` (no auth): API version, minimum app version, which sign-in buttons to show |
| Create account, sign in | `POST /auth/register` `{ name, email, password, familyName? }` · `POST /auth/login` · `POST /auth/social` `{ provider: "apple"\|"google", idToken, name? }` · `POST /auth/logout[?pushToken=]` · `POST /auth/forgot-password` `{ email }` · `POST /auth/reset-password` `{ token, password }` |
| Add child | `POST /children` `{ name, age, profile? }` · `PUT /children/{id}/photo` (raw JPEG/PNG/WebP/HEIC body, ≤ 2 MB) · `GET`/`DELETE` the photo |
| Protection profile | `GET /profiles?age=12`: Balanced / Protected / Custom, with the recommended one flagged |
| Recommended setup | `GET /children/{id}/recommendations?profile=`: all 10 suggested configs, and how each device applies them |
| Setup progress | `POST /children/{id}/setup` `{ profile, overrides?: [config] }` → `batchId`; poll `GET /batches/{batchId}`; guided steps: `POST /batches/{id}/confirm`; `DELETE /batches/{id}` cancels |
| Add a device | `POST /children/{id}/pairing-code`: the child's app exchanges it at `/api/device/v1/pair` |
| Configuration health | `GET /health[?childId=]`: score, 10 checks, and `toFix` (child and device per failing check) |
| Dashboard | `GET /dashboard`: greeting, family score, children, recent alerts, unread count |
| Child profile | `GET`/`PATCH`/`DELETE /children/{id}` (delete: admin, `{ password }`) · `GET /children/{id}/history` |
| Protection & controls | `GET /children/{id}/protections` · `PUT /children/{id}/protections/{KEY}` with the config fields → batch to poll |
| Screen time | `GET /children/{id}/screen-time?period=today\|7d\|30d`: total vs limit, daily series, top apps, `hourly[24]` for today |
| App management | `GET /children/{id}/apps?filter=installed\|blocked\|pending` · `POST /children/{id}/apps` (add ahead of time) · `PATCH /apps/{id}` `{ approval?, dailyLimitMinutes? }` |
| Location | `GET /children/{id}/location`: current place and, with history on, today's and yesterday's visits · `GET /children/{id}/location/visits` ("View All", paged) · `GET /locations` (all children) |
| Alerts | `GET /alerts?filter=ALL\|PROTECTION\|APPS\|SCREEN_TIME\|DEVICES\|LOCATION\|SYSTEM&before=` · `GET /alerts/unread-count` · `POST /alerts/{id}/read` · `POST /alerts/read-all` · `POST /alerts/{id}/dismiss` (info only). Each alert has `day` for section headers and a typed `action` |
| Devices, checks | `GET /devices` · `GET`/`PATCH`/`DELETE /devices/{id}` · `POST /checks` `{ deviceId? }` → poll `GET /checks/{runId}` |
| Settings | `GET`/`PATCH /me` (email change needs `password`) · `DELETE /me` (delete account) · `GET /me/identities`, `DELETE /me/identities/{id}` · `POST /me/password` · `GET`/`PATCH /me/notifications` · `POST`/`DELETE /me/push-tokens` · `GET`/`DELETE /me/sessions` · `GET /family` · `POST /family/members`, `DELETE /family/members/{id}` · `GET`/`PATCH /family/privacy` (admin) |
| Subscription | `GET /subscription`: plan, renewal, features, devices used of the limit · `GET /subscription/plans` · `POST /subscription/google-play` `{ productId, purchaseToken }` (Android "Upgrade to Family") |
| Help & support | `GET /help?q=&category=` and `GET /help/{slug}` (no auth) · `GET`/`POST /support/tickets` |

Apple and Google ID tokens are verified against the providers' published keys (`src/lib/social-auth.ts`); set
`APPLE_CLIENT_IDS` / `GOOGLE_CLIENT_IDS` (see `.env.example`). A new social account creates a family. An
existing account with exactly the same email gets linked (`src/lib/social-signin.ts`). Aliases (`+tag`, Gmail
dots) are never linked. If that account never verified its email, whoever registered it is locked out first:
their password is replaced and their sessions end.

Plans are paid for on the web, in Settings › Subscription, through PayMongo (`src/lib/paymongo.ts`,
`src/lib/web-billing.ts`). There are two ways to pay:

- **Auto-renew**: card or Maya, charged every month or year.
- **Pass**: pay once with GCash, Maya, card or QR Ph. It doesn't renew, and eGuard sends a reminder before it ends.

Set `PAYMONGO_SECRET_KEY`, `PAYMONGO_PUBLIC_KEY` and `PAYMONGO_WEBHOOK_SECRET`, and register
`/api/billing/paymongo/webhook` in the PayMongo dashboard. Prices are `PRICE_FAMILY_MONTHLY` and
`PRICE_FAMILY_YEARLY`. The apps show the plan but don't sell it.

The Google Play billing path (`src/lib/google-play.ts`, `POST /subscription/google-play`,
`/api/billing/google-play/notifications`) is still there, and stays off while `GOOGLE_PLAY_*` is empty.

Full details: [docs/subscriptions.md](docs/subscriptions.md).

## Background jobs

`GET`/`POST /api/cron/maintenance` with `Authorization: Bearer $CRON_SECRET`. Run it every 5–15 minutes (Vercel
Cron sends the header itself when `CRON_SECRET` is set; elsewhere use any scheduler). Each run:

- raises "device hasn't synced" alerts
- emails parents (verified address, email alerts on) about protection changes, offline devices and anything that
  needs action
- re-checks subscriptions and passes, and emails a reminder 3 days before a pass ends
- deletes activity older than each family's retention period (screen time, app usage, location visits, history,
  closed alerts), audit entries older than a year, and expired sessions, links and pairing codes

Without `CRON_SECRET` it only runs in development.

## Deploying

- Put the app behind a proxy that sets `X-Forwarded-For` (Vercel, a load balancer, nginx). Per-address rate limits
  use the entry the nearest proxy added. Set `TRUSTED_PROXY_HOPS` if more than one proxy is in front. Without a
  proxy, only per-account limits apply.
- Set `SMTP_URL`, `APP_URL`, `SUPPORT_EMAIL` and `CRON_SECRET`, and schedule the maintenance job.
- For payments, set the live PayMongo keys and webhook secret, and ask PayMongo support to enable Subscriptions (auto-renew).
- `npm run build` runs `prisma migrate deploy`.

## Project layout

```
prisma/            schema, migrations, seed
src/app/(auth)/    sign in, register
src/app/(app)/     dashboard, children, devices, protection, notifications, reports, location, settings
src/app/actions/   server actions (auth, configuration workflow, family/devices/settings)
src/app/api/       device API v1, polling (flow status, checks), search, notifications, CSV/JSON export
src/components/    shell, cards, charts, configuration flow and check dialogs, forms, map, UI primitives
src/lib/           db, auth, engine, health, protections, queries, reports, simulator, formatting
scripts/           end-to-end smoke test
```

## Not built yet

- **Native Android/iOS apps.** Both API contracts above are ready for them. Until they exist, the simulator stands in.
- **Push delivery and the weekly summary.** Email alerts are sent (see Background jobs). The parent app's push tokens
  are stored, but no FCM/APNs provider is wired up yet.
- **"Gaming time"** on the app's Recommended Setup screen. eGuard has per-app limits but no app categories yet, so
  there's no per-category limit to recommend.
- **Setting a password while signed in.** Parents who signed up with Apple/Google set their first password through
  "Forgot password?". Until then, deleting a child or changing the email asks them to do that. Deleting the account
  takes typing DELETE instead.
- **Buying in the apps.** Plans are sold on the web only. Google Play billing is built but turned off, and App Store
  (StoreKit) purchases aren't built. Changing the card for auto-renew isn't built either.
- **Two-step verification.** Shown as "Coming soon".
- **Realtime.** The UI polls (bell every 30s, workflows every ~1s). WebSockets or SSE would replace this.
- **Family photography.** The hero has a CSS photo slot (`--hero-photo`, see `globals.css`) for licensed images.
- **Location history on the web.** Visits are recorded when the privacy toggle is on and shown in the mobile API.
  The web Location page still shows current locations only.
- **Choosing the retention period.** It's 90 days for every family; there's no setting to change it yet.
