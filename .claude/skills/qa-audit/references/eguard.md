# eGuard project notes for QA audits

## Map

- Signed-in pages: `src/app/(app)/*` (dashboard, children, devices, location, notifications, protection, reports,
  settings, organizations). Shared shell in `src/app/(app)/layout.tsx`; the setup wizard and check dialogs in
  `src/components/flow.tsx`.
- Server actions: `src/app/actions/*.ts`. Services shared with the mobile API: `src/lib/*-service.ts`, `src/lib/*.ts`.
- APIs: parent app `src/app/api/mobile/v1` (wrapper `authed`/`open` in `src/lib/mobile-api.ts`), child devices
  `src/app/api/device/v1` (`authDevice`), browser extension `src/app/api/browser/v1`, organizations `src/app/api/org/v1`
  (`orgApi`), webhooks under `src/app/api/billing`, cron `src/app/api/cron/maintenance`.
- Docs for app teams: `docs/mobile-api.md`, `docs/child-app-spec.md`, `docs/browser-extension-api.md`.
- `src/proxy.ts` records the requested path so sign-in can return there (`src/lib/return-to.ts`).

## Helpers worth reusing

`childLocation` (location.ts), `limitOn` and `dayKey`/`dateFromKey` (queries.ts), `computeHealth`/`isOffline`
(health.ts), `entitlementsFor`/`nextPlan` (plans.ts), `planWith`/`visibleApps` (plan-access.ts), `toResult` and
`ServiceError` (errors.ts), `ConfigSchema`/`ReportedConfigSchema` (config-service.ts), `safeNext` (return-to.ts).

## Checks

```bash
npx tsc --noEmit            # note: `| tail` hides the exit code; use ${PIPESTATUS[0]}
npx eslint <paths>
npx vitest run              # unit tests, src/**/*.test.ts
npx vitest run --config vitest.api.config.ts   # API suite (needs the server setup below)
```

## Dev server

- Next refuses to start a second dev server in the same folder. If the user's server is running, use it for page checks
  and don't stop it. Ask before running the API suite against it, since it needs special settings.
- If you start one yourself, run it in the background. Stopping the background task can leave the Next process tree
  running: find the PID listening on 3000, confirm its start time matches your log, then `taskkill /PID <cmd pid> /T /F`.

## Mail safety (read before registering accounts or running the API suite)

`.env` may point `SMTP_URL` at a real provider with a Resend fallback (`RESEND_API_KEY`). Test runs must not use them.
Start the server with process env overrides (they take precedence over `.env`, which you shouldn't edit):

```bash
SMTP_URL="smtp://localhost:1025" RESEND_API_KEY="" CRON_SECRET=test-cron-secret \
RATE_LIMIT_IP_ALLOWLIST="::1,127.0.0.1,::ffff:127.0.0.1" npx next dev
```

Then prove it before the suite: register one throwaway account (`@mobile-test.example`), check it arrived in Mailpit
(`http://localhost:8025/api/v1/search?query=to:"<address>"`), and confirm the server log has no "SMTP failed" or
"Resend" lines. Mailpit and Postgres run in Docker (`npm run db:up`, containers `eguard-mail`, `eguard-db`).
Never print `.env` lines; check whether a variable is set with `grep -qE "^NAME=.+"`.

## Sessions and fixtures

`scripts/qa.mts` (next to this skill) mints sessions and manages a throwaway family. Run from the repo root:

```bash
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts session randy@example.com   # TOKEN=… for the seed admin
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts fixture [Free|"eGuard Plus"|"Family Pro"] [childName]
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts cleanup                      # removes fixtures and QA sessions
```

- Web pages: `curl -b "eg_session=$TOKEN" http://localhost:3000/<path>`. Mobile API: `-H "Authorization: Bearer $TOKEN"`.
- Rendered HTML has `<!-- -->` between text parts, so grep for short fragments. Error panels contain "couldn't load".
- A streamed page that calls `notFound()` returns 200 with a `noindex` meta tag; that's expected.
- Seed accounts (dev only): `randy@example.com` (admin) and `ana@example.com`, password shown on the dev login page.
- Device API: get a code from `POST /api/mobile/v1/children/<id>/pairing-code` (verified parent), pair with
  `POST /api/device/v1/pair`, then remove the device (and its alerts and usage rows) when done.
- Saving to the seed family changes real dev data (versions, history rows): say so in the report.
