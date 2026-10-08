# eGuard project notes for QA audits

## Map

- Signed-in pages: `src/app/(app)/*` (dashboard, children, devices, location, notifications, protection, reports,
  settings, organizations). Shared shell in `src/app/(app)/layout.tsx`; the setup wizard and check dialogs in
  `src/components/flow.tsx`.
- Server actions: `src/app/actions/*.ts`. Services shared with the mobile API: `src/lib/*-service.ts`, `src/lib/*.ts`.
- APIs: parent app `src/app/api/mobile/v1` (wrapper `authed`/`open` in `src/lib/mobile-api.ts`), child devices
  `src/app/api/device/v1` (`authDevice`), browser extension `src/app/api/browser/v1`, organizations `src/app/api/org/v1`
  (`orgApi`), webhooks under `src/app/api/billing`, cron `src/app/api/cron/maintenance`.
- Docs for app teams: `docs/mobile-api.md` (parent and child device APIs), `docs/child-app-spec.md`, `docs/browser-extension-api.md`.
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

Run `vitest` and `next dev` from PowerShell. From Git Bash, vitest can report "no tests" and the dev server can 404
nested API routes (path casing). `tsc`, `eslint`, `curl` and the `qa.mts` script work from either.

## Dev server

- Next refuses to start a second dev server in the same folder. If the user's server is running, use it for page checks
  and don't stop it. Ask before running the API suite against it, since it needs special settings.
- `prisma generate` or `npm install` swaps the Prisma engine under a running dev server and can stop it (it exited
  during the 2026-10-07 organizations audit). Say so before running either, and tell the user if their server went
  down.
- If you start one yourself, run it in the background. Stopping the background task can leave the Next process tree
  running: find the PID listening on 3000, confirm its start time matches your log, then `taskkill /PID <cmd pid> /T /F`.

## Mail safety (read before registering accounts or running the API suite)

Since 2026-10-08 `src/lib/mail.ts` sends to Mailpit whenever `NODE_ENV` isn't `production` (`next dev`, vitest),
and ignores `SMTP_URL` and `RESEND_API_KEY` there; production sends with Resend. Mailpit down: the email is printed
to the server log ("Mailpit unreachable"). Start a server for the API suite with:

```bash
CRON_SECRET=test-cron-secret RATE_LIMIT_IP_ALLOWLIST="::1,127.0.0.1,::ffff:127.0.0.1" npx next dev
```

Still prove it before the suite: register one throwaway account (`@mobile-test.example`), check it arrived in Mailpit
(`http://localhost:8025/api/v1/search?query=to:"<address>"`). A server started with `next start` (production mode)
uses Resend. To test against one (needed when the user's `next dev` holds :3000: `npx next build`, then
`npx next start -p 3100` and `API_BASE_URL=http://localhost:3100`), override `SMTP_URL=smtp://127.0.0.1:1025` and
set `RESEND_API_KEY` to a single space. In Windows PowerShell `$env:RESEND_API_KEY=""` deletes the variable, so
Next loads the real key from `.env` (seen 2026-10-08; only Resend's reserved-domain guard kept that check's mail
from going out). Mailpit and Postgres run in Docker (`npm run db:up`, containers `eguard-mail`, `eguard-db`).
Never print `.env` lines; check whether a variable is set with `grep -qE "^NAME=.+"`.

## Sessions and fixtures

`scripts/qa.mts` (next to this skill) mints sessions and manages a throwaway family. Run from the repo root:

```bash
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts session randy@example.com   # TOKEN=… for the seed admin
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts fixture [Free|"eGuard Plus"|"Family Pro"] [childName]
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts parent <fixtureFamilyId>     # non-admin parent in a fixture family
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts alert <fixtureFamilyId> '<json>'   # ALERT=… with any Alert fields
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts usage <fixtureFamilyId> '{"apps":12,"changes":500}'  # report data for the first child
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts org <fixtureFamilyId>        # ORG=… owned by its admin, 3 paid + 2 refunded codes
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts invite <orgId> <email>       # INVITE=… waiting invitation, no email sent
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts email <fixtureFamilyId>      # a fixture user's email
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts visits <fixtureFamilyId> '{"passing":900}'  # history on, a sharing phone, a 3-day stay, then a drive today
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts place <fixtureFamilyId> [name]  # PLACE=… saved place on any plan (API refuses on Free)
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts plan <fixtureFamilyId> [plan]   # switch a fixture's plan, no billing (downgrade checks)
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts device <fixtureFamilyId> '{"offlineHours":48}'  # DEVICE=… phone for the first child; '{"browser":true}' adds a browser instead
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts staff                        # STAFF=… console session (QA staff account that can't sign in)
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts ticket <fixtureFamilyId>     # TICKET=… support ticket, no email
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts purchase <fixtureFamilyId> '{"autoRenewing":false}'  # a purchase + renewsAt
npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts cleanup                      # removes fixtures, their organizations, QA sessions and the QA staff account
```

Staff console: `curl --resolve console.localhost:3000:127.0.0.1 -b "eg_staff=$STAFF" http://console.localhost:3000/<path>`.
To call a console action, take its id from `.next/dev/server/server-reference-manifest.json` and post the page's
progressive-enhancement fields (the `$ACTION_REF_1` / `$ACTION_1:0` / `$ACTION_KEY` hidden inputs in the page HTML,
plus the form fields) with `Origin: http://console.localhost:3000`; a plain `<form action>` takes `$ACTION_ID_<id>=`.

- `npx tsx -e` prints nothing in this setup; add a command to `qa.mts` instead of inline scripts.
- For cross-family checks, make two fixtures and use family A's token on family B's IDs. Cleanup finds fixtures by
  the name "QA Audit Fixture", so rename a fixture back before cleanup if a test renamed it.

- Web pages: `curl -b "eg_session=$TOKEN" http://localhost:3000/<path>`. Mobile API: `-H "Authorization: Bearer $TOKEN"`.
- Rendered HTML has `<!-- -->` between text parts, so grep for short fragments. Error panels contain "couldn't load".
- A streamed page that calls `notFound()` returns 200 with a `noindex` meta tag; that's expected.
- Seed accounts (dev only): `randy@example.com` (admin) and `ana@example.com`, password shown on the dev login page.
- Device API: get a code from `POST /api/mobile/v1/children/<id>/pairing-code` (verified parent), pair with
  `POST /api/device/v1/pair`, then remove the device (and its alerts and usage rows) when done.
- Saving to the seed family changes real dev data (versions, history rows): say so in the report.
