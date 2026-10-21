# Parent care automation engine

Optional tips, weekly plans, activity reminders, check-ins and monthly summaries that help parents keep using
eGuard for things that matter. Built into the existing app: the maintenance cron runs it, Postgres holds its
queue, and it delivers through the app's own email (lib/mail), push (lib/push, FCM) and a new in-app inbox on the
Safety plan page. Safety alerts are untouched: they're sent by `notifyNewAlerts` before this step and are never
counted against, or delayed by, its limits.

Status (2026-10-21): implemented and tested, ready for a **controlled pilot** once the items in
[Before the pilot](#before-the-pilot) are done. Nothing has been deployed.

## 1. Existing architecture it builds on

| Area | What the app already had | How parent care uses it |
|---|---|---|
| Frontend | Next 16 App Router, server components + server actions, `src/components/*`, global CSS tokens | New `/plan` pages, a section in Settings › Notifications, `components/care.tsx` |
| Backend | Route handlers under `/api/mobile/v1` with `authed()` (Bearer session), zod, `ServiceError` | New `/care/*` and `/me/care` routes, same conventions |
| Database | Postgres + Prisma 6, `prisma/migrations` | 9 new tables, additive migrations only |
| Auth | Parent sessions (`requireUser`, `userForToken`); separate staff console sessions (`requireStaff`, TOTP) | Parent routes use the session's user only; admin pages use `requireStaff` and `logStaff` |
| Data model | `Family` (time zone, default Asia/Manila) → `User` (role, notification switches) → `Child` (birth year) | Parent = `User`; ages from `Child.birthYear` (only ages leave the query) |
| Notifications | `Alert` + `notifyNewAlerts` (email via Resend/Mailpit, push via FCM), weekly digest, broadcasts with unsubscribe tokens | Adapters reuse `sendMail`, `sendPush`, `PushToken`; the `/unsubscribe` page and one-click endpoint now also accept parent-care tokens |
| Scheduler | One cron, `/api/cron/maintenance` every 10 min (`vercel.json`), `runMaintenance` steps; claim-by-`updateMany` idempotency | New step "parent care" (after alert emails); DB job queue with `FOR UPDATE SKIP LOCKED` |
| Content | Knowledge center (`lib/learn`, 100 reviewed articles with takeaways) | Tips are article takeaways; 16 curated activities link to articles |
| Admin | Staff console (console host), `StaffAuditLog` | New "Parent care" section with 4 pages |
| Rate limits, audit, tests | `lib/rate-limit` (DB counters), `AuditLog`, vitest unit (`src/lib/test`) + API (`tests/api`) | `careUser` limit; staff changes as `care.*`; 7 new test files |

No queue, broker or new dependency was added.

## 2. How it works

```
parent action ──► noteActivity (events.ts) ──► lastQualifyingAt, PARENT_REACTIVATED, cancel check-ins
activity start ──► follow-up job (+24 h)        activity complete ──► cancel follow-up
cron (10 min) ──► runParentCare (runner.ts)
                    syncAutomations → backfillPreferences → releaseStale → planDue (next 48 h, per parent)
                    → claimDue (SKIP LOCKED) → processJob:
                        dedupe check → prepare (recheck relevance, pick content) → checkEligibility("deliver")
                        → message row (SENDING) → adapter.send → ACCEPTED/DELIVERED | FAILED → retry/DEAD
```

- **Definitions** (`definitions.ts`): each automation is data: trigger, steps, the parent's switch, channel
  preference order, cooldown, version. Synced into `ParentCareAutomation` so staff see and pause what's live.
- **Eligibility** (`eligibility.ts`, pure): one function, run when scheduling and again just before delivery:
  automation running → account active (not a pending invitation) → care on → automation switch on → not holdout →
  no opt-out/suppression → still relevant → a permitted, available, unsuppressed channel → not already sent →
  cooldown → contact limits → quiet hours (push/email are deferred, not dropped).
- **Exactly-once sends**: one `ParentCareMessage` per job (`dedupeKey` = job's `idempotencyKey`, unique). A retry
  that finds `ACCEPTED`/`DELIVERED` stops; one that finds `SENDING` (worker died mid-send) marks it `UNCERTAIN` and
  never re-sends (at most one copy can have arrived). Both count as `DUPLICATE_BLOCKED`.
- **Retries**: 5 attempts, backoff 5 min × 2ⁿ ±20% jitter, capped at 6 h. Provider 4xx (not 429) is permanent;
  timeouts, 5xx, 429 and unknown errors retry. Jobs a worker held >10 min are released (`worker_lost`).
- **Channels**: one channel per message, the first in the automation's order that the parent allows (push/email
  need recorded consent), can receive (push: FCM configured + a registered phone + the device-wide "Push
  notifications" switch; email: verified address) and is under the limits. Never several.
- **No message text is stored**: messages keep template key/version, ids (`params`: tip key, activity keys,
  month) and the link; in-app messages are rendered when shown.

### Contact limits (all automations together)

| | Per day | Per rolling 7 days |
|---|---|---|
| Push + email | 1 | 3 |
| In-app | 2 | 6 |

Plus per-automation cooldowns and each parent's quiet hours (default 21:00–07:00, local).

## 3. The five automations

| Key | Trigger | Rule | Channels | Stops / skipped when |
|---|---|---|---|---|
| `briefing` | Schedule | Parent's days (default Mon/Wed/Fri) at delivery time (default 19:30). One takeaway from an article reviewed in the last 18 months that fits the children's ages, never one sent before, plus one suggested activity; links to the activity | Push → in-app | Every fitting tip sent (`no_fresh_content`), more than 12 h late |
| `follow_up` | Event: activity started | ~24 h later (then out of quiet hours); one per start | Push → in-app | Activity completed/dismissed/restarted (cancelled at once, rechecked at send) |
| `weekly_plan` | Schedule | Mondays: 1–2 activities fitting the ages, in-progress first, skipping done/dismissed, ≤ ~30 min together. The plan is also made when the parent opens `/plan` | Email → push → in-app | Everything in the plan already done |
| `check_in` | Schedule (inactivity) | Enrolled at 7 days without a qualifying action; steps at day 7, 14, 21: a resource, a small idea, a final check-in that says they stop | Email → push (no in-app: they're not in the app) | Any qualifying action (cancels the rest immediately, records `PARENT_REACTIVATED`), opt-out, care off; inactivity rechecked before each |
| `monthly_report` | Schedule | 1st of the month: last month's activities done/started, family protection changes (`ConfigChange`), weekly plans, a next step | Email → in-app | Parent joined after that month |

**Qualifying activity** (never app opens or syncs): protection changes, app decisions, web-request decisions,
screen-time rules, extra time, child added/updated, pairing code, browser policy, place saved, activity
started/completed, registration. Hooked in `family-service`, `config-service`, `browser-access`,
`browser-policy`, `places`, `invitations` via `parent-care/hooks.ts` (failures are logged, never fail the action).
At rollout every parent's clock starts then, so nobody is "inactive" on day one.

**Content rules**: no generated text. Tips are article takeaways; grooming/exploitation topics are never sent
unasked; templates never name a child; no claims that a family is safe or that something reduced risk; check-ins
avoid guilt and fear (tested).

## 4. Database (migrations `20261021121155_parent_care`, `20261021122044_parent_care_message_params`)

Additive only (tested): 9 new tables, FKs to `User` with `ON DELETE CASCADE` (deleting an account deletes it all).

| Table | Purpose |
|---|---|
| `ParentCarePreference` | Per parent: master switch, channels + consent timestamps, per-automation switches, briefing days, delivery time, quiet hours, language, time-zone override, cohort (TREATMENT/HOLDOUT, fixed at creation, 10%), `lastQualifyingAt`, `plannedAt` |
| `ParentCareAutomation` | Live state of each definition: enabled, version, config snapshot, who changed it |
| `ParentCareEnrollment` | Check-in sequences per inactivity period (ACTIVE/COMPLETED/EXITED/HOLDOUT) |
| `ParentCareJob` | The queue: runAt, status, attempts, unique idempotency key, lock, last error code |
| `ParentCareMessage` | One per job: channel, template/version, language, content key, params (ids), link, status, provider ref, sent/delivered/opened/clicked/dismissed, token (tracking + opt-out) |
| `ParentCareEvent` | Lifecycle events with unique `eventId`, minimal meta |
| `ParentCareActivity` | Parent's progress per catalog activity |
| `ParentCarePlan` | Weekly plan (week = local Monday) |
| `ParentCareSuppression` | Opt-outs, cooldowns, bounces, admin holds by scope (ALL, automation, `CHANNEL:X`) |

Retention (`retention.ts`, run in `purgeExpiredData`): events 400 days, messages 365, finished jobs 90, plans 400,
expired suppressions at once. Preferences and activity progress live as long as the account.

## 5. APIs and routes

- Mobile API (documented in [mobile-api.md](../mobile-api.md) › Parent care): `GET/PATCH /me/care`,
  `GET /care/activities`, `GET/POST /care/activities/{key}`, `GET /care/messages`, `POST /care/messages/{id}`,
  `POST /care/events`, `GET /care/report`.
- `GET /api/care/open/{token}`: email button; records the click, redirects to an app path only.
- `/unsubscribe?t=` and `POST /api/email/unsubscribe?t=` (existing) now also turn parent-care email off.
- Web: `/plan` (this week, in progress, messages from eGuard, more ideas, done), `/plan/[key]`, `/plan/report`,
  Settings › Notifications › Tips and reminders, "Safety plan" in the nav. Server actions in `actions/care.ts`.
- Admin endpoints are console pages + server actions (the console's convention): metrics, pause/resume,
  failed-job inspection and retry.

## 6. Admin dashboard (console › Parent care)

- **Engagement**: weekly active families, 7/30-day retention and 7-day reactivation rate split treatment vs
  holdout (with definitions on the page), inactive parents, reactivations, activity completion, per-channel sent /
  opened / clicked / opt-out rate.
- **Automations**: status, version, channels, pending, sent, click and conversion rates; detail page with the
  definition, skip/fail reasons, rendered template samples and approval state, pause/resume with confirmation
  (pausing cancels pending jobs; audited).
- **Delivery**: queue by status, reliability, failure rate, duplicate-send rate, interrupted sends, overdue jobs,
  provider error codes, failed and retrying jobs (ids and codes only; "Open" goes through the logged family view),
  retry one or all from the last 7 days (confirmation, audited).
- **Trust and compliance**: consent counts, opt-outs/suppressions, channel readiness, limits, template approval,
  `care.*` staff audit history, and a warning panel for opt-out or failure spikes.

Every view is aggregated. Staff accounts have no roles in this app, so every staff member sees these pages.

### Metric definitions

| Metric | Numerator / denominator |
|---|---|
| 7-day retention | Parents signed up 8–37 days ago with a qualifying action on days 1–7 / those parents |
| 30-day retention | Signed up 31–60 days ago, qualifying action on days 23–30 / those parents |
| Reactivation within 7 days | Check-in enrollments started 7–60 days ago whose parent came back within 7 days / those enrollments (holdout enrollments are tracked without messages) |
| Activity completion | Activities started 7–37 days ago completed within 7 days / those starts |
| Campaign conversion | Messages followed by any completed activity within 7 days / messages sent (30 days) |
| Channel opt-out rate | Opt-outs of a channel / messages sent on it (30 days) |
| Delivery reliability | Messages accepted or shown / attempted (30 days) |
| Duplicate-send rate | Retries stopped by the duplicate guard / jobs processed |
| Automation failure rate | Jobs given up / jobs processed |

The pilot goals (+10% relative 7-day retention, +5% 30-day, 15–25% reactivation) are hypotheses: read them from
the treatment-vs-holdout difference with a few hundred parents per column, never from before-and-after.

## 7. Configuration

No new environment variables. It uses what the app already reads:

| Variable | Needed for | Without it |
|---|---|---|
| `CRON_SECRET` | The maintenance cron (existing) | Nothing runs in production |
| `RESEND_API_KEY` (or `SMTP_URL`), `MAIL_FROM` / `RESEND_FROM` | Email in production (existing) | Email jobs fail, retry, then are given up (`email_not_configured`); never reported as sent |
| `FCM_SERVICE_ACCOUNT` | Push (existing) | Push is never chosen; messages fall back to the next channel |
| `APP_URL` (existing) | Links in emails | Production email jobs fail (`appUrl()` throws) and are retried, then given up |

Tunables live in code (reviewed changes): `CONTACT_LIMITS`, `HOLDOUT_PCT` (10), `RETRY`, `INACTIVE_DAYS`,
`TIP_FRESH_DAYS`, `CARE_RETENTION_DAYS`. The mobile apps need to: register for push (existing), handle
`data.type === "care"` pushes (open `link`, report `NOTIFICATION_CLICKED`), and optionally show `/care/*`.

## 8. Tests (run 2026-10-21, local, Windows, Postgres 15433, Mailpit)

| Suite | Result |
|---|---|
| Unit, all (`npm test`) | **569/569 passed** (64 files; 45 new in 5 parent-care files: schedule/DST/quiet hours, eligibility/consent/caps/cooldown, content selection, templates, retries/backoff/classification, holdout, email rendering, migration compatibility) |
| Integration, `tests/api/parent-care.test.ts` (real DB, mail captured) | **16/16 passed**: start→job, completion cancels, in-app delivery, email with consent + tracked link, email opt-out link, provider failure → retry → exactly one email, interrupted send never repeated, care off cancels, opt-out skips queued job, paused automation, quiet-hours deferral, day-7 check-in + return cancels the rest + reactivation event, inactivity recheck, holdout measured not messaged, event dedupe, monthly report, ownership, every console metric query |
| HTTP end-to-end, `tests/api/parent-care-http.test.ts` (dev server) | **10/10 passed**: auth required, defaults + registration event, preferences + consent + validation, plan, start/complete cancels reminder, cron delivers in-app + click recorded once + other parent blocked, app events dedupe + server-only types refused, report, tracked link redirect, console behind staff sign-in |
| Full API suite (`npm run test:api`) | 292/305 passed. **The 12 failures are pre-existing**: the same 12 fail on the untouched code (checked by stashing this work and re-running): stale expectations in `mobile-api` (health score, request statuses, categories, alerts), `security` (usage, device events), `browser` (`installation_revoked` vs `unauthorized`), `browser-policy`, `browser-health`. The 13th (`invitations`, a 60 s mail wait) passed on re-run |
| `tsc --noEmit`, `eslint` | Clean (2 pre-existing warnings) |
| Page smoke test | `/plan`, `/plan/[key]`, `/plan/report`, Settings › Notifications and all 4 console pages render 200 with a real session; this caught and fixed a SQL cast bug in the retention query |

Not verified: clicking through the UI in a browser (layout, keyboard and screen-reader behaviour were reviewed in
code only), real FCM push delivery, real Resend delivery, the mobile apps, behaviour at production scale.

## 9. Deployment and rollback

Deploy:
1. Merge; `npm run db:deploy` (runs both migrations: new tables only, no locks on existing tables beyond FK creation).
2. Deploy the app. The next cron run syncs the automations, creates preferences for every parent (500 per run)
   and starts planning. With no parent having given push/email consent, everything starts **in-app only**.
3. Watch console › Parent care › Delivery and Trust for a few runs, and the logs for `[parent-care]`.

Pause without deploying: console › Automations › each automation › Pause (cancels pending jobs). To stop the
whole engine, pause all five.

Rollback:
1. Pause all automations (stops sends immediately).
2. Deploy the previous build. The new tables are ignored by old code.
3. Only if the data must go: `psql "$DATABASE_URL" -f prisma/rollbacks/20261021121155_parent_care.down.sql`
   (drops only the 9 parent-care tables and the two migration rows; deletes preferences and consent history for
   good, so export first).

### Monitoring

- `[parent-care]` log lines: `delivery failed` (with code), `job failed`, `planning failed`, and warnings
  `opt-out spike` (≥5 opt-outs and >2% of 24 h push/email) and `jobs failed for good` (≥10 in 24 h). Point log
  alerts at the two warnings.
- The cron response includes `parentCare` (planned, processed, outcomes, health) and lists "parent care" in
  `failed` if the step threw.
- Console › Delivery: overdue jobs growing means the cron isn't running or can't keep up (500 jobs / 90 s per run).

## 10. Known limitations and follow-ups

- **Push and email reach only parents who opt in** in Settings (consent is explicit and recorded). Reactivation by
  email therefore only works for those parents. Asking for consent at sign-up or with a prompt needs a product and
  legal decision.
- **Filipino**: templates are drafted but `PENDING_REVIEW`, so Filipino-preference parents get English. Tips and
  activities are English only. A native speaker should review and approve (flip `approval` in `templates.ts`).
- **Legal review**: designed for the Data Privacy Act of 2012 principles (consent per channel and purpose,
  data minimisation, immediate opt-out, retention limits, no child details in messages), but **not reviewed by
  counsel or a DPO**. The privacy policy should mention these messages and their data before the pilot.
- **Delivery confirmation**: Resend and FCM only confirm acceptance here; no webhooks are wired, so bounces don't
  create suppressions yet. Email opens aren't tracked (no pixels, by choice).
- Pilot cohort selection: there's no "pilot only" switch. Options: start with automations paused and resume them
  one at a time, or (follow-up) add an allow-list. Holdout gives the comparison group.
- Activity completion is self-reported ("Mark as done"); auto-detection (e.g. bedtime actually set) is a follow-up.
- Staff have no roles, so every staff member sees the care pages (aggregates only).
- Scale: planning is per parent every 6 h, 300 per run; fine for thousands of parents, revisit beyond ~50k.
- The mobile apps don't yet use the `/care` endpoints or handle `type: "care"` pushes.

## 11. Production-readiness checklist

| Item | State |
|---|---|
| Integrated into the existing app (no new service, broker or dependency) | Done |
| Additive, reversible migrations, rollback script | Done (tested statically) |
| Preferences and explicit consent enforced at schedule and send time | Done, tested |
| Idempotent, recoverable jobs (SKIP LOCKED, stale-lock release, bounded retries, dead letters) | Done, tested |
| Activity completion cancels reminders; return cancels check-ins | Done, tested |
| Contact limits, cooldowns, quiet hours, time zones (DST-safe) | Done, tested |
| Real channel integrations (Resend/Mailpit, FCM, in-app); no fabricated delivery | Done; FCM and Resend not exercised for real |
| Admin monitoring and control, audited | Done, smoke-tested |
| Retention and reactivation measurable with a holdout | Done |
| Rate limits and ownership checks on parent endpoints | Done, tested |
| Retention policy for new data | Done |
| Pre-existing API test failures (12) | **Open, not caused by this feature** |
| Legal/DPO review, privacy policy update | **Open** |
| Filipino copy review | **Open** |
| Browser click-through and accessibility check | **Open** |
| Mobile app support for care pushes and screens | **Open** |

### Before the pilot

1. Restore the local dev database's migration history (see the note below) and run the suites again.
2. Legal/DPO review and privacy-policy wording.
3. Click through `/plan` and the settings section on a phone and a desktop.
4. Deploy with all automations paused; resume `follow_up` and `weekly_plan` first, then the rest.

## Local development note (2026-10-21)

While building this, the local dev database (Docker `eguard-db`, port 15433) was reset by a
`prisma migrate diff --shadow-database-url` run that pointed at it. All rows were lost and the
`_prisma_migrations` table is gone; the schema itself is intact. No other environment was touched. To restore it:
`npx prisma migrate reset --force` (recreates the schema from migrations and runs `prisma/seed.ts`, the demo family).
