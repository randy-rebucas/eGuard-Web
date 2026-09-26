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
| `npm test` | Vitest unit tests (health scoring, verification rules) |
| `node scripts/e2e-smoke.mjs` | End-to-end smoke test against a running dev server (needs Chrome and the seeded DB). Set `BASE_URL`, `SHOTS` |
| `npm run db:seed` / `db:reset` | Reseed / reset the database |

## What's built

- **Auth:** registration creates a family and its admin; sign-in with DB-backed sessions in an httpOnly cookie
  (bcrypt, 30-day expiry, login rate limiting). Roles: `FAMILY_ADMIN` and `PARENT`.
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
| `POST /usage` | `{ date: "YYYY-MM-DD", totalMinutes, apps: [{ name, minutes }] }` | Daily totals. Idempotent: the latest total wins. |
| `POST /location` | `{ lat, lng, accuracyM?, placeLabel? }` | Current location. Overwrites the last one, no trail. |
| `POST /events` | `{ type: "APP_INSTALLED", app }` \| `{ type: "APP_REQUESTED", app }` \| `{ type: "LIMIT_REACHED", minutes }` | Raise alerts or approval requests. |

Config objects match `ProtectionConfig` in `src/lib/protections.ts`, for example
`{ "key": "BEDTIME", "config": { "enabled": true, "start": "21:30", "end": "06:00", "days": "EVERY_DAY" } }`.

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

- **Native Android/iOS apps.** The API contract above is ready for them. Until they exist, the simulator stands in.
- **Push/email delivery.** Preferences are stored, but no provider (FCM/APNs/SMTP) is wired up.
- **Billing.** Plan and device limit are enforced, but "Change plan" needs a payment provider.
- **Two-step verification.** Shown as "Coming soon".
- **Realtime.** The UI polls (bell every 30s, workflows every ~1s). WebSockets or SSE would replace this.
- **Family photography.** The hero has a CSS photo slot (`--hero-photo`, see `globals.css`) for licensed images.
- **Location history** when the privacy toggle is on. Only the current location is stored today.
- **Data retention job.** The 90-day retention is displayed, but no scheduled deletion job runs yet.
