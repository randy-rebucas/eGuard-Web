# Deploying, Pausing and Rolling Back Parent Care

## Summary

The Parent care deployment procedure explains how the engineering team deploys Parent care to production, how staff pause or resume its automations from the console, and how the team rolls it back if something goes wrong. Parent care sends optional tips, weekly plans, activity reminders, check-ins and monthly reports to parents; safety alerts are separate and are never delayed or limited by it. Parent care runs inside the existing eGuard web application, adds no new environment variables, and stores its data in 9 new database tables created by two additive migrations. Pausing an automation stops its sends at once without a deployment; a full rollback is pause, redeploy the previous build, and only if the data must go, run the rollback script. On 2026-10-21 the feature was built and tested but not deployed, and several pre-pilot items were still open.

## Purpose of the Parent care deployment procedure

The purpose of the Parent care deployment procedure is to put Parent care into production safely for a controlled pilot, to give staff a way to stop it quickly, and to make a rollback repeatable. Parent care touches parents' email, push and in-app inbox, so a mistake reaches real families; the procedure keeps every send behind explicit consent, the contact limits and a tested off switch.

## When the Parent care deployment procedure applies

The Parent care deployment procedure applies when:

- Parent care is deployed to production for the first time (the pilot).
- Staff need to pause or resume one or all of the five automations (briefing, follow-up, weekly plan, check-in, monthly report).
- Delivery problems, an opt-out spike or a legal concern require Parent care to be stopped or removed.

The procedure does not apply to safety alerts (they are sent before the Parent care step and are not affected), to console email broadcasts (see "Sending a Broadcast to Parents"), or to changes in Parent care's tunable settings such as contact limits or the holdout share, which are code changes reviewed under "Engineering Standards and Release Procedure".

## Roles involved in the Parent care procedure

| Role | Responsibility |
|---|---|
| Engineering (the person who merges and deploys) | Runs the migrations, deploys the build, watches logs, runs a rollback. [TO CONFIRM: which role or person deploys to production] |
| Staff (console users) | Watch console › Parent care, pause and resume automations, retry failed jobs. Staff have no roles in the console, so every staff member can see and use these pages |
| Owner | Decides when the pilot starts and whether data is deleted in a rollback. [TO CONFIRM: who approves the pilot start and data deletion] |
| Data Protection Officer | Reviews Parent care and the privacy-policy wording before the pilot. [TO CONFIRM: DPO name] |

## Inputs needed before deploying Parent care

The Parent care deployment needs these items in place before step 1:

| Input | Detail |
|---|---|
| The Parent care code merged and tested | Migrations `20261021121155_parent_care` and `20261021122044_parent_care_message_params` |
| Existing production configuration | `CRON_SECRET` (the maintenance cron), `RESEND_API_KEY` or `SMTP_URL` with `MAIL_FROM` or `RESEND_FROM` (email), `FCM_SERVICE_ACCOUNT` (push), `APP_URL` (links in emails). No new variables are needed |
| Before-the-pilot items closed | Local test suites re-run after restoring the development database's migration history; legal/DPO review and privacy-policy wording; a click-through of `/plan` and Settings › Notifications on a phone and a desktop |
| Console access | A staff account that can open console › Parent care |
| Log alerts | Log alerts pointed at the two Parent care warnings, `opt-out spike` and `jobs failed for good` |

Without `CRON_SECRET` nothing runs in production. Without working email settings or `APP_URL`, email jobs fail, retry and are given up; they are never reported as sent. Without `FCM_SERVICE_ACCOUNT`, push is never chosen and messages fall back to the next channel.

## Procedure: deploying Parent care

1. Engineering confirms that the "Before the pilot" items are closed (see "Inputs needed before deploying Parent care"). If any item is still open, then stop and go to "Approvals required for the Parent care procedure".
2. Engineering merges the Parent care work and runs `npm run db:deploy` against production. The command applies both migrations; they create new tables only and take no locks on existing tables beyond foreign-key creation.
3. Engineering deploys the app on Vercel.
4. Staff open console › Parent care › Automations and pause all five automations before the next cron run, so the pilot starts with nothing sending. The source recommends deploying with all automations paused. [TO CONFIRM: whether automations can be paused before the first cron run creates them in the console, or whether they start running on that run]
5. On the next maintenance cron run (every 10 minutes), the app syncs the automations, creates preferences for every parent (500 per run) and starts planning. Because no parent has yet given push or email consent, everything starts as in-app only.
6. Staff resume `follow_up` and `weekly_plan` first (console › Automations › the automation › Resume, with confirmation).
7. Engineering and staff watch console › Parent care › Delivery and Trust for a few cron runs, and the server logs for `[parent-care]` lines. If failures, overdue jobs or an opt-out spike appear, then go to "Procedure: pausing and resuming Parent care".
8. When Delivery and Trust stay clean, staff resume the remaining automations (`briefing`, `check_in`, `monthly_report`) one at a time, repeating step 7 after each. [TO CONFIRM: how many clean runs or days to wait before resuming the next automation]

## Procedure: pausing and resuming Parent care

Pausing Parent care needs no deployment and is the first response to any problem.

1. A staff member opens console › Parent care › Automations and selects the automation.
2. The staff member presses **Pause** and confirms. Pausing cancels that automation's pending jobs and is written to the staff audit log as a `care.*` entry.
3. To stop the whole engine, the staff member pauses all five automations.
4. To resume, the staff member opens the same page, presses **Resume** and confirms.
5. After resuming, engineering and staff watch console › Parent care › Delivery for a few runs (as in step 7 of the deployment procedure).

Failed or retrying jobs can be retried from console › Parent care › Delivery: one job, or all from the last 7 days, with confirmation; each retry is audited.

## Procedure: rolling back Parent care

1. A staff member pauses all five automations (see "Procedure: pausing and resuming Parent care"). Sends stop immediately.
2. Engineering deploys the previous build. The old code ignores the Parent care tables, so nothing else is needed for a code rollback.
3. Engineering decides with the owner whether the Parent care data must be removed. If the data can stay, then stop here.
4. If the data must go, engineering first exports the Parent care data. [TO CONFIRM: how and where the export is made and stored]
5. Engineering runs the rollback script: `psql "$DATABASE_URL" -f prisma/rollbacks/20261021121155_parent_care.down.sql`. The script drops only the 9 Parent care tables and the two migration rows. It deletes every parent's preferences and consent history for good.
6. Engineering records the rollback and the reason. [TO CONFIRM: where rollbacks are recorded]

## Monitoring Parent care after deployment

Parent care monitoring uses three places:

| Where | What to look for |
|---|---|
| Server logs, `[parent-care]` lines | `delivery failed` (with a code), `job failed`, `planning failed`; warnings `opt-out spike` (at least 5 opt-outs and more than 2% of push and email in 24 hours) and `jobs failed for good` (at least 10 in 24 hours) |
| Cron response | A `parentCare` entry (planned, processed, outcomes, health); "parent care" listed under `failed` if the step threw |
| Console › Parent care › Delivery | Overdue jobs growing means the cron is not running or cannot keep up (500 jobs or 90 seconds per run) |

Console › Parent care › Trust shows consent counts, opt-outs and suppressions, channel readiness, contact limits, template approval and a warning panel for opt-out or failure spikes.

## Approvals required for the Parent care procedure

| What | Who approves | Limit |
|---|---|---|
| Starting the pilot (first deployment to production) | [TO CONFIRM: approver] | Only after the legal/DPO review and privacy-policy wording are done |
| Resuming an automation in production | [TO CONFIRM: approver] | One automation at a time |
| Running the rollback script that deletes Parent care data | [TO CONFIRM: approver] | Only after an export |
| Approving Filipino templates (flipping `approval` in `templates.ts`) | A native speaker reviews first [TO CONFIRM: who approves] | Until approved, Filipino-preference parents receive English |

## Exceptions in the Parent care procedure and what to do

| Situation | What to do |
|---|---|
| A worker died mid-send | Nothing. The message is marked `UNCERTAIN` and never re-sent; at most one copy can have arrived |
| Email jobs failing with `email_not_configured` or an `appUrl()` error | Check the email settings and `APP_URL` in production; jobs retry 5 times, then are given up |
| Push never used | Check `FCM_SERVICE_ACCOUNT`; push also needs the parent's consent, a registered phone and the phone's push switch on |
| Opt-out spike warning | Pause the automation concerned and review its template and timing |
| Overdue jobs growing | Check that the maintenance cron is running |
| Need to limit the pilot to some parents | No "pilot only" switch exists; start with automations paused and resume them one at a time. An allow-list is a follow-up |

## Outputs of the Parent care procedure and where they are recorded

| Output | Where it is recorded |
|---|---|
| New tables and migration rows | Production database (`_prisma_migrations`) |
| Pause, resume and retry actions | Staff audit log, `care.*` entries |
| Automation state and version | `ParentCareAutomation` table, shown in console › Parent care › Automations |
| Delivery outcomes | `ParentCareMessage` and `ParentCareJob` tables, console › Parent care › Delivery |
| Deployment and rollback record | [TO CONFIRM: release log or record location] |

## Time targets for the Parent care procedure

| Step | Target |
|---|---|
| Pause takes effect | Immediately; pending jobs are cancelled |
| First planning after deployment | The next maintenance cron run (every 10 minutes) |
| Preferences created for every parent | 500 parents per cron run |
| Watching after deploy or resume | "A few runs" in the source [TO CONFIRM: number of runs] |
| Message retries | 5 attempts, backoff 5 minutes doubling each time (±20%), capped at 6 hours |
| Quiet hours | Default 21:00–07:00 in the parent's local time (the family's time zone, default Philippine time (Asia/Manila)); push and email are deferred, not dropped |

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Engineering Standards and Release Procedure; Systems Overview; Data Handling and Confidentiality; Sending a Broadcast to Parents; Production Go-Live Checks |

## Open questions

1. Owner role, effective date and review date of this procedure are not stated in the sources.
2. Which role or person deploys to production, and who approves the pilot start, resuming an automation in production, running the data-deleting rollback script and Filipino template approval.
3. Deployment status may be out of date: features/parent-care.md says on 2026-10-21 "Nothing has been deployed". Confirm whether Parent care is in production now.
4. Whether automations can be paused before the first cron run after deployment. features/parent-care.md says "Deploy with all automations paused", while its deployment steps say "The next cron run syncs the automations … and starts planning", which suggests they start running on that run.
5. How many cron runs or days to watch before resuming the next automation ("a few runs" in the source).
6. How the Parent care data export before a rollback is made and where it is kept, and where deployments and rollbacks are recorded.
7. Pre-pilot items open on 2026-10-21: restoring the local development database's migration history and re-running the suites; legal/DPO review; browser click-through and accessibility check; Filipino copy review; mobile app support for care pushes and screens; 12 pre-existing API test failures (not caused by this feature).
8. The privacy policy: features/parent-care.md §10 says "The privacy policy should mention these messages and their data before the pilot", while §11 says "Policy updated 2026-10-28" but "the holdout cohort isn't described yet" and "DPO review open". Confirm whether the policy now covers the holdout cohort.
9. The Data Protection Officer is not yet named (launch-visibility.md: "DPO designated by name with the National Privacy Commission" is unticked).
10. Push delivery: Parent care uses push through FCM, but sources disagree on whether push works in production (source inventory contradiction 5: launch-visibility.md and app-listing.md say push is "coming soon" or "aren't wired up"; faq.md and mobile-api.md describe push alerts). features/parent-care.md also notes real FCM and Resend delivery were not exercised in tests.
11. Whether log alerts on `opt-out spike` and `jobs failed for good` have been set up in production.
12. The maintenance cron interval: features/parent-care.md and launch-visibility.md say every 10 minutes; subscriptions.md §7.4 says "every 5–15 minutes".
