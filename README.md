# eGuard — Parent Web App

eGuard is a family digital-safety platform for Android and iOS phones and tablets, and for Chrome, Edge and Firefox
through the eGuard browser extension. This repository is the **parent web app and the backend** that every eGuard
client talks to.

Parents use it to manage children and devices, change protections, and see **Configuration Health**: whether each
protection is set up and *verified* on each device. Configuration Health measures how devices are configured. It
never scores a child's behavior.

**Stack:** Next.js 16 (App Router, React 19, TypeScript), Tailwind CSS v4, PostgreSQL 16, Prisma 6.19.3, Zod,
Leaflet, Vitest.

> **Next.js 16 note:** this version has breaking changes from older Next.js releases. Read the guides in
> `node_modules/next/dist/docs/` before writing framework code (see [AGENTS.md](AGENTS.md)).

---

## Contents

1. [How it fits together](#how-it-fits-together)
2. [Getting started](#getting-started)
3. [Environment variables](#environment-variables)
4. [Scripts](#scripts)
5. [Testing](#testing)
6. [Features](#features)
7. [Protections and verification](#protections-and-verification)
8. [APIs](#apis)
9. [Subscriptions and billing](#subscriptions-and-billing)
10. [Background jobs](#background-jobs)
11. [Deploying](#deploying)
12. [Project layout](#project-layout)
13. [Further documentation](#further-documentation)
14. [Not built yet](#not-built-yet)
15. [Troubleshooting](#troubleshooting)

---

## How it fits together

```
 ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
 │ Parent web app       │   │ Parent mobile app    │   │ Child's phone/tablet │   │ Child's browser      │
 │ (this repo, pages +  │   │ (iOS / Android)      │   │ eGuard app           │   │ eGuard extension     │
 │  server actions)     │   │                      │   │ (Android / iOS)      │   │ (Chrome/Edge/Firefox)│
 └──────────┬───────────┘   └──────────┬───────────┘   └──────────┬───────────┘   └──────────┬───────────┘
            │ session cookie           │ /api/mobile/v1           │ /api/device/v1           │ /api/browser/v1
            │                          │ Bearer session token     │ Bearer device token      │ Bearer access token
            ▼                          ▼                          ▼                          ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ Shared services in src/lib: config-service, family-service, engine, health, browser-*, billing, mail   │
 └───────────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                                     ▼
                                              PostgreSQL (Prisma)
```

- The web app and the parent mobile API call the **same service layer**, so both follow the same rules.
- The child's device and browser never get parent credentials. Each has its own token, and the server works out the
  child and family from that token alone.
- Nothing is reported as done until the device confirms it (see [Protections and verification](#protections-and-verification)).

---

## Getting started

### Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | 20.9 or newer (npm 11 recommended) | Runs Next.js, Prisma and the tests |
| Docker Desktop | any recent | Runs PostgreSQL 16 and Mailpit locally |
| Chrome | optional | Only for the end-to-end smoke test |

### 1. Install and start the local services

```bash
npm install
cp .env.example .env      # skip if .env already exists
npm run db:up             # PostgreSQL 16 on localhost:55433, Mailpit on :1025 (SMTP) and :8025 (inbox)
```

> npm 11 blocks install scripts by default. If Prisma or esbuild complain after `npm install`, run
> `npm approve-scripts @prisma/client @prisma/engines prisma esbuild unrs-resolver && npm rebuild`.

### 2. Create the database and load demo data

```bash
npx prisma migrate dev    # create the tables
npm run db:seed           # demo family: parents Randy and Ana, children Mia, Lucas and Sophie, 5 devices
```

### 3. Run the app

```bash
npm run dev               # http://localhost:3000
```

Sign in with either demo account:

| Email | Password | Role |
|---|---|---|
| `randy@example.com` | `ChangeMe123!` | Family Admin |
| `ana@example.com` | `ChangeMe123!` | Parent |
| `school@example.com` | `ChangeMe123!` | Owner of the demo organization, San Isidro Elementary School |

The demo organization ([prisma/demo-organization.ts](prisma/demo-organization.ts)) has join code `SCHL-7K2P`, Randy
as a second admin, and two paid batches of sponsor codes: eGuard Plus for 3 months (10 codes: 3 redeemed, 1
cancelled) and Family Pro for 1 month (5 codes). It also has a read-only API key,
`egk_local-demo-key-san-isidro-elementary-school`, for trying the [organization API](docs/organization-api.md). The Cruz family and the three sponsored families
(`reyes@`, `garcia@`, `bautista@example.com`, same password) joined it, so it shows 4 families. The seed prints an
unused code of each kind to try redeeming.

Every email the app sends in development (verification, password reset, alerts) lands in Mailpit at
<http://localhost:8025>.

**Why port 55433?** A native PostgreSQL service owns 5432 on the original dev machine. To use another port, change
it in both `docker-compose.yml` and `DATABASE_URL`.

---

## Environment variables

All variables are listed, with comments, in [.env.example](.env.example). The defaults there work for local
development.

| Variable | Required | Purpose |
|---|---|---|
| **Core** | | |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `APP_URL` | yes | Public URL of the server. Used in emailed links, canonical URLs, the sitemap, share tags and structured data. Production: `https://www.eguard.family` |
| `DEVICE_SIMULATOR` | dev only | `true` lets the seeded simulated devices answer requests (never active in production) |
| `SUPPORT_EMAIL` | production | Where support requests go, and the address the apps show |
| **Email** | | |
| `SMTP_URL` | production | `smtp://user:pass@host:587` or `smtps://…:465`. Empty prints emails to the server log (not allowed in production) |
| `MAIL_FROM` | | Sender address |
| `RESEND_API_KEY`, `RESEND_FROM` | optional | Fallback sender when SMTP is empty or fails |
| **Maps** | | |
| `MAP_TILE_URL` | production | Tile template fetched by the server (`/api/tiles`) so the provider never sees parents' IPs. Default is OpenStreetMap |
| **Sign-in** | | |
| `APPLE_CLIENT_IDS`, `GOOGLE_CLIENT_IDS` | optional | Comma-separated client IDs for "Continue with Apple / Google". Empty hides the buttons |
| `MOBILE_MIN_APP_VERSION` | | Oldest parent-app version the server supports |
| `CHILD_MIN_APP_VERSION` | optional | Oldest child-device app version: `1.2.0`, or per platform `android:1.2.0,ios:1.1.0`. Sent to devices as `minAppVersion`; empty means none |
| **Payments** | | |
| `PAYMONGO_SECRET_KEY`, `PAYMONGO_PUBLIC_KEY`, `PAYMONGO_WEBHOOK_SECRET` | to sell plans | PayMongo keys. Empty hides buying |
| `PAYMONGO_PASS_METHODS` | | Methods for one-time passes (default `gcash,paymaya,card,qrph`) |
| `PRICE_PLUS_MONTHLY`, `PRICE_PRO_MONTHLY` | | Monthly prices in pesos (default 149 and 249) |
| `GOOGLE_PLAY_*` | optional | Google Play billing and notifications. Leave empty (web-only payments) |
| **Browser extension** | | |
| `BROWSER_POLICY_SIGNING_KEY` | for browsers | ECDSA P-256 private key that signs browser policies. Generate with `node scripts/browser-policy-keys.mjs`. Without it, `GET /api/browser/v1/policy` returns `503` |
| **Operations and security** | | |
| `CRON_SECRET` | production | Bearer secret for `/api/cron/maintenance`. Generate with `openssl rand -base64 32` |
| `TRUSTED_PROXY_HOPS` | | Proxies in front of the app that append to `X-Forwarded-For` (default 1) |
| `RATE_LIMIT_IP_ALLOWLIST` | tests | Addresses exempt from per-address rate limits, e.g. `::1,127.0.0.1` |
| `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION` | optional | HTML-tag site verification (not needed with DNS verification) |

---

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` | `prisma generate`, then `next build`. Doesn't touch the database |
| `npm run db:deploy` | `prisma migrate deploy`: apply pending migrations. Run once per release, before the new code goes live |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit`. Run `npx next typegen` first after adding routes |
| `npm test` | Unit tests (Vitest, `src/**/*.test.ts`) |
| `npm run test:api` | HTTP and service tests against a running server (see [Testing](#testing)) |
| `npm run db:up` / `db:down` | Start / stop PostgreSQL and Mailpit in Docker |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | Load the demo family |
| `npm run db:reset` | Drop, re-migrate and reseed the database |
| `npm run seed:demo` | Create or refresh the app-store **review** account in any database. Dry run by default; add `--apply` (see [scripts/seed-demo.ts](scripts/seed-demo.ts)) |
| `node scripts/e2e-smoke.mjs` | End-to-end smoke test in Chrome against a running dev server with the seeded DB. Set `BASE_URL` and `SHOTS` |
| `node scripts/browser-policy-keys.mjs` | Generate the browser-policy signing key pair |
| `node scripts/generate-brand.mjs` | Regenerate the brand images in `public/brand` |

---

## Testing

### Unit tests

```bash
npm test
```

Covers health scoring, verification rules, protection profiles, social sign-in tokens, mail, and day boundaries.
No server or database needed.

### API tests

These run over HTTP against a live server whose `SMTP_URL` points at Mailpit. They create and delete their own
families, so they are safe to run against your dev database.

```bash
# terminal 1: start the server with the test settings
CRON_SECRET=test-cron-secret RATE_LIMIT_IP_ALLOWLIST=::1,127.0.0.1 npm run dev

# terminal 2
npm run test:api          # API_BASE_URL defaults to http://localhost:3000
```

- `CRON_SECRET=test-cron-secret` lets the maintenance-job tests run.
- `RATE_LIMIT_IP_ALLOWLIST` lets one machine register many test families.
- The browser-policy tests need `BROWSER_POLICY_SIGNING_KEY` on the server, and read the same key from the
  environment, `.env.local` or `.env` to check signatures.

On PowerShell, set the variables with `$env:CRON_SECRET="test-cron-secret"; $env:RATE_LIMIT_IP_ALLOWLIST="::1,127.0.0.1"; npm run dev`.

Suites in [tests/api/](tests/api/): mobile API, verification, security, social sign-in, billing, web billing,
browser pairing and tokens, browser policy, browser access requests, and browser health.

---

## Features

### Accounts and security

- **Registration** creates a family and its admin. Roles are `FAMILY_ADMIN` and `PARENT`.
- **Sign-in** uses DB-backed sessions in an httpOnly cookie (bcrypt, 30-day expiry). Parents verify their email by
  an emailed link.
- **Forgot / reset password** by emailed link. A reset signs out every session. Changing the email needs the password.
- **Rate limits** are kept in Postgres ([src/lib/rate-limit.ts](src/lib/rate-limit.ts)). Failed sign-ins lock an
  account after 10 tries in 15 minutes from anywhere. Per-address limits cover sign-in, sign-up, social sign-in,
  pairing, links and password resets.
- **Account deletion** from Settings › Export or delete data, or `DELETE /api/mobile/v1/me`. The admin's account
  takes the whole family with it; another parent's removes only them.

### Parent dashboard

| Area | What parents can do |
|---|---|
| **Dashboard** | Hero summary, Family Protection score, children, devices, today's activity (screen time, apps, location, device status), device protection status, weekly screen-time trend, recent alerts, quick actions |
| **Children** | List, add, edit, delete (password-confirmed). Each child has 9 tabs: Overview, Activity, Apps (approve/decline requests, per-app limits), Screen Time, Protection, **Browser**, Location, Devices, History |
| **Browser tab** | Set the child's browser policy (Safe Browsing, SafeSearch, blocked categories, blocked/allowed sites, unknown-site rule, focus hours), answer website access requests, and see connected browsers |
| **Devices** | Grouped by child. Pairing codes for new phones and browsers. A detail page shows every protection, its platform capability and verification time. Rename, remove, or run a configuration check on one device |
| **Protection** | The Configuration Health ring (10 checks), a breakdown by status, all protections with their Android/iOS capability, and a guide to what each capability means |
| **Notifications** | Filter by category, severity labels, unread state, mark all read, dismiss info items, show resolved. Each alert has an action (fix the setting, view the device, review the app…) |
| **Reports** | Today, 7 days, 30 days or a custom range: health, average screen time vs the previous period, protection changes, device health, top apps, a change timeline, and CSV export |
| **Location** | A Leaflet/OpenStreetMap map of current locations. Children who don't share location get a "Turn on" link into the guided flow |
| **Settings** | Account and family time zone, family members (admin adds/removes parents), notification preferences, privacy controls, security (sessions, password), subscription (including redeeming a sponsor code), organizations (join with a code, or create one), connected devices, platform integrations, data export (JSON), support |
| **Organizations** | For schools, community groups and businesses (`/organizations/{id}`): a join code families enter, sponsor codes bought in batches through PayMongo that each give one family a paid plan, and admins. The organization sees counts only, never a family's data. See [docs/organizations.md](docs/organizations.md) |
| **Search** | Press `/` to search children, devices, protection policies, alerts and settings |

The UI has light, dark and system themes (stored in a cookie, so there's no flash on load) and responsive layouts:
sidebar on desktop, icon rail on tablet, bottom nav and drawer on phones.

### Public site and SEO

- **Pages:** landing page, About, Privacy Policy, Terms of Use, Delete account, a blog ([src/lib/blog.ts](src/lib/blog.ts))
  and a public Help Center (the same articles as `GET /help`, [src/lib/help.ts](src/lib/help.ts)). They share one
  header and footer ([src/components/site-chrome.tsx](src/components/site-chrome.tsx)).
- **Legal details** (operator DevCom Digital Marketing Services, address, privacy email) come from
  [src/lib/legal.ts](src/lib/legal.ts).
- **SEO:** titles, descriptions, canonical URLs and share tags come from `pageMetadata()` ([src/lib/site.ts](src/lib/site.ts)).
  Share images are drawn in code ([src/lib/og.tsx](src/lib/og.tsx)). The app serves `robots.txt`, `sitemap.xml`
  (built from the blog and help articles), a web manifest and JSON-LD (organization, app with peso prices, articles).
  Signed-in pages are `noindex`. Every absolute URL uses `APP_URL`. See [docs/launch-visibility.md](docs/launch-visibility.md).

---

## Protections and verification

### The 10 protections

Defined in [src/lib/protections.ts](src/lib/protections.ts), together with the per-platform capability matrix,
guided-setup steps, config shapes and labels.

| Key | Check name | Config |
|---|---|---|
| `SCREEN_TIME` | Screen Time | `dailyMinutes`, `weekendMinutes` |
| `BEDTIME` | Bedtime | `enabled`, `start`, `end`, `days` (`EVERY_DAY` \| `SCHOOL_NIGHTS`) |
| `APP_RESTRICTIONS` | App Restrictions | `maxAgeRating` |
| `APP_APPROVAL` | App Approval | `enabled` |
| `CONTENT` | Content Restrictions | `maxAgeRating` |
| `WEB` | Web Filtering | `mode` (`OFF` \| `FILTER` \| `ALLOWLIST`), `blockedSites` |
| `DOWNLOADS` | Downloads | `requireApproval` |
| `LOCATION` | Location | `sharing` |
| `NOTIFICATIONS` | Notification Controls | `quietDuringBedtime` |
| `UNINSTALL_PROTECTION` | Uninstall Protection | `enabled` |

Each protection has a capability per platform:

| Capability | Meaning |
|---|---|
| `AVAILABLE` | eGuard applies the setting directly and verifies it |
| `GUIDED` | eGuard walks the parent through the steps on the device, then verifies |
| `VERIFY_ONLY` | The parent sets it on the device; eGuard confirms it's on |
| `UNSUPPORTED` | The platform doesn't allow it. Never counted against health |

### How verification works

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

- [src/lib/engine.ts](src/lib/engine.ts) holds `deviceSync()`, `processReport()` and check runs. The device API and
  the simulator both go through it.
- [src/lib/health.ts](src/lib/health.ts) computes the score. Each check takes the worst status across the child's
  devices, and `UNSUPPORTED` never counts against the score.
- When a device reports a config that no longer matches policy and no request explains it, eGuard raises
  "Protection setting changed" (or "Location sharing turned off" for location).

### Device simulator (development only)

The seeded devices have `simulated = true`. With `DEVICE_SIMULATOR=true` (never in production), the polling
endpoints advance these devices through the **same** sync and report code a real phone uses, so the whole workflow
runs without the mobile apps.

- The Galaxy Tab A8 is seeded offline and never answers. That's how the "Waiting for the device to come online" and
  "Couldn't reach" states appear.
- Devices paired through the API are real devices and are never simulated.

---

## APIs

The server exposes four versioned APIs, one per kind of client. All are JSON, and errors have the shape
`{ error, code? }` where `error` is a message safe to show to a person.

| API | Base path | Client | Auth | Reference |
|---|---|---|---|---|
| Device API | `/api/device/v1` | eGuard app on the child's phone/tablet | Device token | Below |
| Parent mobile API | `/api/mobile/v1` | Parent app (iOS/Android) | Session token | [docs/mobile-api.md](docs/mobile-api.md) |
| Browser extension API | `/api/browser/v1` | eGuard extension in the child's browser | 15-minute access token + rotating refresh token | [docs/browser-extension-api.md](docs/browser-extension-api.md) |
| Organization API | `/api/org/v1` | A school's or company's own systems | Organization API key (Family Pro) | [docs/organization-api.md](docs/organization-api.md) |

### Device API (`/api/device/v1`)

Every endpoint except `pair` needs `Authorization: Bearer <device token>`. Only a SHA-256 hash of the token is stored.

| Endpoint | Body | Purpose |
|---|---|---|
| `POST /pair` | `{ code, platform: "ANDROID"\|"IOS", name, model, kind: "PHONE"\|"TABLET", osVersion, appVersion? }` | Exchange a one-time code from the Devices page for `{ deviceId, token }`. Enforces the plan's device limit |
| `POST /sync` | `{ battery?, osVersion?, appVersion? }` | Heartbeat. Returns `policy` (all 10 protections), `requests` to apply (re-sent until the device reports on that protection), `apps` rules, `fullReportRequested`, `nextSyncSeconds`, the family's `timezone`, `features: { locationSharing }` (false: don't collect or send location) and `minAppVersion` (or null) |
| `POST /report` | `{ protections: [{ key, config }], full?: boolean }` | The config the device actually has. Send `full: true` with all protections when `fullReportRequested` |
| `POST /usage` | `{ date: "YYYY-MM-DD", totalMinutes, apps: [{ name, minutes }], hourly?: number[24] }` | Daily totals, optionally per local hour. Idempotent: the latest total wins |
| `POST /location` | `{ lat, lng, accuracyM?, placeLabel? }` | Current location, overwriting the last one. Visits are recorded only when the family turns on location history |
| `POST /events` | `{ type: "APP_INSTALLED", app }` \| `{ type: "APP_REQUESTED", app }` \| `{ type: "LIMIT_REACHED", minutes }` \| `{ type: "APP_BLOCKED", app }` | Raise alerts or approval requests. `APP_BLOCKED` alerts at most once per app per hour. Optional `eventId` (8–64 chars, e.g. a UUID) on any event: a repeat from the same device within 7 days returns `{ ok: true, duplicate: true }` and does nothing |

Config objects match `ProtectionConfig` in [src/lib/protections.ts](src/lib/protections.ts), for example:

```json
{ "key": "BEDTIME", "config": { "enabled": true, "start": "21:30", "end": "06:00", "days": "EVERY_DAY" } }
```

### Parent mobile API (`/api/mobile/v1`)

Everything the parent app's screens need. **Full reference for app developers: [docs/mobile-api.md](docs/mobile-api.md).**

- **Auth:** `POST /auth/login` returns `{ token, expiresAt, user }`. Send `Authorization: Bearer <token>` on every
  other call and keep the token in the Keychain / Keystore. Tokens are ordinary 30-day sessions, so "sign out other
  sessions" and password changes cover the web and phones alike.
- **Client header:** send `X-eGuard-Client: ios` or `android` so history reads "Randy Cruz on iOS app".
- **Status codes:** `400` invalid, `401` sign in again, `403` admin only or wrong password, `404` not in your family,
  `409` conflict or unsupported, `413`/`415` photo too large or wrong type.
- **Dates** are ISO strings; `…Label` fields are pre-formatted in the family's time zone.
- The web server actions and this API share [src/lib/config-service.ts](src/lib/config-service.ts) and
  [src/lib/family-service.ts](src/lib/family-service.ts). A change counts only once each device has verified it.

| Screen | Endpoints |
|---|---|
| Launch / About | `GET /app-info` (no auth): API version, minimum app version, which sign-in buttons to show |
| Create account, sign in | `POST /auth/register` `{ name, email, password, familyName? }` · `POST /auth/login` · `POST /auth/social` `{ provider: "apple"\|"google", idToken, name? }` · `POST /auth/logout[?pushToken=]` · `POST /auth/forgot-password` `{ email }` · `POST /auth/reset-password` `{ token, password }` · `POST /auth/two-factor` `{ challenge, code }` (after a sign-in answers `twoFactorRequired`) |
| Add child | `POST /children` `{ name, age, profile? }` · `PUT /children/{id}/photo` (raw JPEG/PNG/WebP/HEIC body, ≤ 2 MB) · `GET`/`DELETE` the photo |
| Protection profile | `GET /profiles?age=12`: Balanced / Protected / Custom, with the recommended one flagged |
| Recommended setup | `GET /children/{id}/recommendations?profile=`: all 10 suggested configs, and how each device applies them |
| Setup progress | `POST /children/{id}/setup` `{ profile, overrides?: [config] }` → `batchId`; poll `GET /batches/{batchId}`; guided steps: `POST /batches/{id}/confirm`; `DELETE /batches/{id}` cancels |
| Add a device or browser | `POST /children/{id}/pairing-code`: phone code by default; `{ kind: "BROWSER", deviceLabel }` for the browser extension |
| Configuration health | `GET /health[?childId=]`: score, 10 checks, and `toFix` (child and device per failing check) |
| Dashboard | `GET /dashboard`: greeting, family score, children, recent alerts, unread count |
| Child profile | `GET`/`PATCH`/`DELETE /children/{id}` (delete: admin, `{ password }`) · `GET /children/{id}/history` |
| Protection & controls | `GET /children/{id}/protections` · `PUT /children/{id}/protections/{KEY}` with the config fields → batch to poll |
| Screen time | `GET /children/{id}/screen-time?period=today\|7d\|30d`: total vs limit, daily series, top apps, `hourly[24]` for today |
| App management | `GET /children/{id}/apps?filter=installed\|blocked\|pending` · `POST /children/{id}/apps` (add ahead of time) · `PATCH /apps/{id}` `{ approval?, dailyLimitMinutes? }` |
| Browser protection | `GET /browsers` · `DELETE /browsers/{id}` `{ password }` · `GET`/`PUT /children/{id}/browser-policy` · `GET /children/{id}/browser-access-requests` · `POST /browser-access-requests/{id}` `{ decision, duration? }` |
| Location | `GET /children/{id}/location`: current place and, with history on, today's and yesterday's visits · `GET /children/{id}/location/visits` (paged) · `GET /locations` (all children) |
| Alerts | `GET /alerts?filter=ALL\|PROTECTION\|APPS\|SCREEN_TIME\|DEVICES\|LOCATION\|SYSTEM&before=` · `GET /alerts/unread-count` · `POST /alerts/{id}/read` · `POST /alerts/read-all` · `POST /alerts/{id}/dismiss` (info only) |
| Devices, checks | `GET /devices` · `GET`/`PATCH`/`DELETE /devices/{id}` · `POST /checks` `{ deviceId? }` → poll `GET /checks/{runId}` |
| Settings | `GET`/`PATCH /me` (email change needs `password`) · `DELETE /me` · `GET /me/identities`, `DELETE /me/identities/{id}` · `POST /me/password` · `GET`/`PATCH /me/notifications` · `POST`/`DELETE /me/push-tokens` · `GET`/`DELETE /me/sessions` · `GET`/`DELETE /me/two-factor`, `POST /me/two-factor/setup`, `/confirm`, `/recovery-codes` · `GET /family` · `POST /family/members`, `DELETE /family/members/{id}` · `GET`/`PATCH /family/privacy` (admin) |
| Subscription | `GET /subscription`: plan, renewal, features, entitlements, usage vs limits · `GET /subscription/plans` · `POST /subscription/google-play` `{ productId, purchaseToken }` |
| Help & support | `GET /help?q=&category=` and `GET /help/{slug}` (no auth) · `GET`/`POST /support/tickets` |

**Social sign-in.** Apple and Google ID tokens are verified against the providers' published keys
([src/lib/social-auth.ts](src/lib/social-auth.ts)); set `APPLE_CLIENT_IDS` / `GOOGLE_CLIENT_IDS`. A new social
account creates a family. An existing account with exactly the same email is linked
([src/lib/social-signin.ts](src/lib/social-signin.ts)); aliases (`+tag`, Gmail dots) are never linked. If that
account never verified its email, whoever registered it is locked out first: their password is replaced and their
sessions end.

### Browser extension API (`/api/browser/v1`)

Called by the eGuard extension on the child's computer. **Full reference: [docs/browser-extension-api.md](docs/browser-extension-api.md).**
The extension itself lives in a separate repository (`eguard-browser`).

| Endpoint | Purpose |
|---|---|
| `POST /pair` | No auth. Exchange a browser pairing code ("Add a browser") for an installation, a 15-minute access token and a refresh token |
| `POST /token` | No auth. Rotate the refresh token. Reusing an old refresh token after 2 minutes disconnects the browser and alerts the family |
| `GET /policy` | The child's browser policy, **signed** with ECDSA P-256. The extension verifies the signature before enforcing it |
| `POST /access-requests`, `GET /access-requests` | The child asks a parent to open a blocked site; the block page shows the answer |
| `POST /health` | The extension's self-checks and the policy version it enforces. Drives alerts such as "Browser protection changed" |
| `POST /events` | Daily counts of blocked pages per reason. Counts only, never sites or URLs |

How it works:

- A parent creates a **browser pairing code** on the Devices page (or with `{ kind: "BROWSER" }` in the mobile API).
  Connected browsers count toward the plan's device limit.
- There is **one policy per child**, shared by all of that child's browsers. Every change (a parent's edit, an
  approved access request) adds a version. Browsers poll every 5 minutes.
- An approved access request only takes effect through a new signed policy: timed approvals (`15M`, `1H`, `TODAY`)
  appear as temporary allows, `ALWAYS` moves the site to the allowed list.
- Policy logic lives in [src/lib/browser-policy.ts](src/lib/browser-policy.ts), access requests in
  [src/lib/browser-access.ts](src/lib/browser-access.ts), health reports in
  [src/lib/browser-health.ts](src/lib/browser-health.ts), and pairing/tokens in
  [src/lib/browser-service.ts](src/lib/browser-service.ts). Category starter lists are in
  [src/lib/category-lists.ts](src/lib/category-lists.ts).

**Setting up signing:** run `node scripts/browser-policy-keys.mjs`. Put the private key in the server's
`BROWSER_POLICY_SIGNING_KEY`, and the public key in the extension build's `VITE_POLICY_PUBLIC_KEY`. To rotate keys,
ship an extension that trusts the new public key **before** switching the server.

---

## Subscriptions and billing

| Plan | Price | Children | Devices | Highlights |
|---|---|---|---|---|
| Free | ₱0 | 1 | 2 | Basic protection setup, screen time, limited app monitoring |
| eGuard Plus | ₱149/month | 5 | 10 | Full protections, configuration verification, location sharing |
| Family Pro | ₱249/month | 10 | 20 | Everything in Plus, advanced reports, API access |

Plans are defined in [src/lib/plans.ts](src/lib/plans.ts). Prices come from `PRICE_PLUS_MONTHLY` and
`PRICE_PRO_MONTHLY`. Phones, tablets and browsers all count as devices.

Plans are **paid for on the web only**, in Settings › Subscription, through PayMongo
([src/lib/paymongo.ts](src/lib/paymongo.ts), [src/lib/web-billing.ts](src/lib/web-billing.ts)):

- **Auto-renew:** card or Maya, charged every month or year.
- **Pass:** pay once with GCash, Maya, card or QR Ph. It doesn't renew, and eGuard emails a reminder 3 days before
  it ends.

To enable payments, set `PAYMONGO_SECRET_KEY`, `PAYMONGO_PUBLIC_KEY` and `PAYMONGO_WEBHOOK_SECRET`, and register
`/api/billing/paymongo/webhook` in the PayMongo dashboard. The apps show the plan but don't sell it.

The Google Play billing path ([src/lib/google-play.ts](src/lib/google-play.ts), `POST /subscription/google-play`,
`/api/billing/google-play/notifications`) is still in the code, and stays off while `GOOGLE_PLAY_*` is empty.

Full details, including flows, entitlement rules and troubleshooting: [docs/subscriptions.md](docs/subscriptions.md).

---

## Background jobs

One endpoint does all scheduled work:

```
GET or POST /api/cron/maintenance
Authorization: Bearer $CRON_SECRET
```

Run it every 5–15 minutes. Vercel Cron sends the header itself when `CRON_SECRET` is set; elsewhere, use any
scheduler (cron, GitHub Actions, a cloud scheduler). Without `CRON_SECRET` it only runs in development.

Each run:

- raises "device hasn't synced" alerts
- emails parents (verified address, email alerts on) about protection changes, offline devices and anything that
  needs action
- re-checks subscriptions and passes, and emails a reminder 3 days before a pass ends
- deletes activity older than each family's retention period (screen time, app usage, location visits, history,
  closed alerts), audit entries older than a year, and expired sessions, links and pairing codes

The logic is in [src/lib/maintenance.ts](src/lib/maintenance.ts).

---

## Deploying

Production checklist:

1. **Database:** provision PostgreSQL 16 and set `DATABASE_URL`. Run `npm run db:deploy` against it once per release,
   before switching traffic. The build doesn't migrate, so preview builds can't touch production.
2. **URL:** set `APP_URL=https://www.eguard.family`. Canonical URLs, the sitemap and link previews are built from it.
3. **Email:** set `SMTP_URL` (and optionally Resend as a fallback) and `MAIL_FROM`. Set `SUPPORT_EMAIL` to an inbox
   someone reads (the legal pages use `support@devcomdigital.com` from [src/lib/legal.ts](src/lib/legal.ts)).
4. **Proxy:** put the app behind a proxy that sets `X-Forwarded-For` (Vercel, a load balancer, nginx). Per-address
   rate limits use the entry the nearest proxy added. Set `TRUSTED_PROXY_HOPS` if more than one proxy is in front.
   Without a proxy, only per-account limits apply.
5. **Scheduled jobs:** set `CRON_SECRET` and schedule `/api/cron/maintenance`.
6. **Maps:** set `MAP_TILE_URL` to a tile provider you have terms with, and update the attribution in
   [src/components/family-map.tsx](src/components/family-map.tsx).
7. **Payments:** set the live PayMongo keys and webhook secret, and ask PayMongo support to enable Subscriptions
   (auto-renew).
8. **Browser extension:** set `BROWSER_POLICY_SIGNING_KEY` and make sure the extension build trusts the matching
   public key.
9. **Sign-in:** set `APPLE_CLIENT_IDS` / `GOOGLE_CLIENT_IDS` if the apps offer social sign-in.
10. **Make sure** `DEVICE_SIMULATOR` is not `true`.
11. **Optional:** `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` for HTML-tag verification (DNS
    verification needs neither).

For store review, create the demo account with `DATABASE_URL=… npm run seed:demo -- --apply` (see
[docs/app-listing.md](docs/app-listing.md)).

---

## Project layout

```
prisma/
  schema.prisma        data model
  migrations/          SQL migrations (applied by `prisma migrate`)
  seed.ts              local demo family (npm run db:seed)
  demo-family.ts       shared demo data, also used by scripts/seed-demo.ts
src/app/
  (site)/              public pages: about, privacy, terms, delete-account, blog, help
  (auth)/              sign in, register, forgot/reset password
  (app)/               signed-in pages: dashboard, children, devices, protection, notifications,
                       reports, location, settings
  actions/             server actions: auth, billing, configuration workflow, family/devices/settings
  api/device/v1/       API for the child's phone/tablet app
  api/mobile/v1/       API for the parent mobile app
  api/browser/v1/      API for the browser extension
  api/org/v1/          API for organizations' own systems (API keys)
  api/billing/         PayMongo webhook, Google Play notifications
  api/cron/            maintenance job
  api/…                polling (flow status, checks), search, notifications, CSV/JSON export, map tiles
src/components/        shell, cards, charts, configuration flow, browser policy form, forms, map, UI primitives
src/lib/               services and domain logic:
  engine.ts            device sync, report processing, check runs
  health.ts            Configuration Health scoring
  protections.ts       the 10 protections and platform capabilities
  config-service.ts    configuration changes (shared by web and mobile API)
  family-service.ts    children, devices, members (shared by web and mobile API)
  browser-*.ts         browser pairing, policy, access requests, health
  plans.ts, billing.ts, web-billing.ts, paymongo.ts, entitlement.ts   plans and payments
  auth.ts, rate-limit.ts, social-auth.ts, social-signin.ts            sign-in and security
  maintenance.ts       background job
  simulator.ts         development device simulator
tests/api/             HTTP/service test suites (npm run test:api)
scripts/               smoke test, demo account, key generation, brand assets
docs/                  developer and launch documentation
```

---

## Further documentation

| Document | For |
|---|---|
| [docs/mobile-api.md](docs/mobile-api.md) | Parent app developers: every endpoint, object, flow and enum |
| [docs/child-app-spec.md](docs/child-app-spec.md) | Child device app: pairing, what the child sees, enforcing each protection, sync and reporting, server gaps |
| [docs/browser-extension-api.md](docs/browser-extension-api.md) | Browser extension developers: pairing, tokens, signed policies, health, events |
| [docs/subscriptions.md](docs/subscriptions.md) | Plans, PayMongo flows, entitlements, operations |
| [docs/organizations.md](docs/organizations.md) | Organizations (schools, communities, businesses), join codes and sponsor codes: roadmap and Phase 1 spec |
| [docs/app-listing.md](docs/app-listing.md) | App Store and Google Play listing copy, privacy forms, reviewer notes |
| [docs/launch-visibility.md](docs/launch-visibility.md) | Domain, SEO, search engine registration and launch plan |

---

## Not built yet

- **Native Android/iOS apps.** The device and parent APIs are ready for them. Until they exist, the simulator stands in.
- **The weekly summary.** The setting is saved but nothing is sent yet; a design (the weekly family digest) is in
  review. Push delivery is built ([src/lib/push.ts](src/lib/push.ts),
  Firebase Cloud Messaging) and switches on with `FCM_SERVICE_ACCOUNT`; pushes go out with the maintenance job, so
  they're as quick as its schedule. The Plus plan still lists "Push alerts (coming soon)" until the apps register FCM
  tokens in production.
- **"Gaming time"** on the app's Recommended Setup screen. eGuard has per-app limits but no app categories yet, so
  there's no per-category limit to recommend.
- **Setting a password while signed in.** Parents who signed up with Apple/Google set their first password through
  "Forgot password?". Until then, deleting a child or changing the email asks them to do that. Deleting the account
  takes typing DELETE instead.
- **Buying in the apps.** Plans are sold on the web only. Google Play billing is built but turned off, and App Store
  (StoreKit) purchases aren't built. Changing the card for auto-renew isn't built either.
- **Realtime.** The UI polls (bell every 30 s, workflows every ~1 s). WebSockets or SSE would replace this.
- **Browser policy caching.** `GET /api/browser/v1/policy` has no `If-None-Match` / `304` yet.
- **Family photography.** The hero has a CSS photo slot (`--hero-photo`, see `globals.css`) for licensed images.
- **Newsletter, social accounts and store badges.** Removed from the landing page until they exist. Add social links
  and a sign-up back to [src/components/site-chrome.tsx](src/components/site-chrome.tsx), and the store badges to
  `Stores()` in [src/app/page.tsx](src/app/page.tsx).
- **Location history on the web.** Visits are recorded when the privacy toggle is on and shown in the mobile API.
  The web Location page still shows current locations only.
- **Choosing the retention period.** It's 90 days for every family; there's no setting to change it yet.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Prisma or esbuild errors after `npm install` | npm 11 blocked install scripts. Run `npm approve-scripts @prisma/client @prisma/engines prisma esbuild unrs-resolver && npm rebuild` |
| `Can't reach database server at 127.0.0.1:55433` | Start Docker Desktop, then `npm run db:up`. Check with `docker ps` that `eguard-db` is healthy |
| Port 55433 or 1025/8025 already in use | Change the host port in `docker-compose.yml` (and `DATABASE_URL` / `SMTP_URL` to match) |
| No emails arrive | Open Mailpit at <http://localhost:8025>. If `SMTP_URL` is empty, emails are printed to the server log instead |
| `npm run typecheck` fails on route types after adding a route | Run `npx next typegen` first |
| Configuration changes stay "Waiting" forever in development | Set `DEVICE_SIMULATOR=true` and restart. The seeded Galaxy Tab A8 is offline on purpose |
| `GET /api/browser/v1/policy` returns `503` | Set `BROWSER_POLICY_SIGNING_KEY` (generate with `node scripts/browser-policy-keys.mjs`) |
| API tests fail with `429` | Start the server with `RATE_LIMIT_IP_ALLOWLIST=::1,127.0.0.1` |
| Maintenance-job tests fail with `401` | Start the server with `CRON_SECRET=test-cron-secret` |
| Demo data looks wrong or stale | `npm run db:reset` drops, re-migrates and reseeds the database |
