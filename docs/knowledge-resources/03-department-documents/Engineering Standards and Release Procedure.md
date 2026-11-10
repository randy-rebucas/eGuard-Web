# Engineering Standards and Release Procedure

## Summary

"Engineering Standards and Release Procedure" is the standard operating procedure for how the eGuard engineering team at DevCom Digital Marketing Services writes, tests, releases and rolls back changes to the eGuard web application, its database, the eGuard app and eGuard for Windows. Every release that changes the database runs `npm run db:deploy` (Prisma migrations) and ships the code and its migration together, after a backup of the production database. Before a change is merged, the type check, the unit tests (`npm test`) and the API test suite (`npm run test:api`) are expected to pass. Product, pricing and engineering decisions are accepted or rejected by the owner. Code style rules, branch naming and who reviews pull requests are not set in the sources and are marked [TO CONFIRM].

## Code style rules for eGuard

eGuard code style rules: [TO CONFIRM: written code style guide, formatter and lint configuration]. The sources record these working conventions:

| Area | Convention |
|---|---|
| Checks | `tsc --noEmit` (type check) and `eslint` are expected to be clean |
| Web application | Next.js 16 App Router, server components and server actions; API route handlers under `/api/mobile/v1` use `authed()` (Bearer session), zod validation and `ServiceError` |
| Validation | Request bodies and stored configuration are checked with zod schemas (for example `ConfigSchema`) |
| Console privacy | Console database queries live in `src/lib/console-queries.ts`, so the rule that staff never see a child's activity can be checked in one file. New console pages must keep to it |
| Console links | Links to console detail pages use `prefetch={false}`, because opening one writes an audit entry |
| Cookies | Cookies are removed with `clearCookie()`, never `cookies().delete()`, which leaves out `Secure` and fails for `__Host-` cookies |
| Public pages | A new public page exports `metadata = pageMetadata({ title, description, path })` and its path is added to the sitemap |
| Tunable values | Values such as Parent care contact limits live in code and change only through reviewed changes |
| Database changes | New features use additive migrations where possible (Parent care: new tables only), with a rollback script when data can be removed |
| Secrets | Secrets never go in chat, a commit or a document; they go in the build system's secret store or environment variables. `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` stay out of the repository |

Coding standards for the Windows agent (Rust): [TO CONFIRM: lint and formatting rules for the agent repository].

Source: features/parent-care.md, features/authentication.md, console.md, launch-visibility.md §4, code-signing.md, subscriptions.md §11.

## Code review rules for eGuard

Code review rules for eGuard are not written down in the sources. [TO CONFIRM: who reviews a change, how many approvals are needed, and what a reviewer checks.]

The sources show these review-related practices:

- Feature documents record what was checked by tests and what was checked "by type and tests only" (not clicked in a browser), so a reviewer can see untested paths.
- Changes to tunable values in code are "reviewed changes".
- Filipino message templates for Parent care stay `PENDING_REVIEW` until a native speaker approves them.

Source: features/*.md, features/parent-care.md.

## Branches and pull requests for eGuard

Branch and pull request rules for eGuard: [TO CONFIRM: branch naming convention, default branch, and who reviews pull requests].

What must pass before a change is merged, as stated in the sources:

1. `npm run typecheck` (or `tsc --noEmit`) passes.
2. `npm test` (unit tests) passes.
3. `npm run test:api` (API suite) passes, apart from known, recorded failures (see "Testing expectations for eGuard").
4. Lint is clean.
5. For a database change: the migrations apply to an empty database and match `prisma/schema.prisma` exactly.

Code hosting: [TO CONFIRM: repository host and whether checks run automatically on each pull request].

Source: mobile-organizations.md §10, features/parent-care.md §8, plan-change-2026-10.md §1.

## Testing expectations for eGuard

eGuard has three layers of automated tests:

| Layer | Command | Notes |
|---|---|---|
| Unit | `npm test` (vitest) | Tests in `src/lib/test` and next to server actions (for example `src/app/actions/*.test.ts`) |
| API | `npm run test:api` | Runs against a running dev server and the real database. Needs the settings in the README's API tests section: the rate-limit allowlist, the cron secret on both sides and mail sent to Mailpit; without them the suite fails with `429`, `401` or "No verify-email email reached" |
| Content | `npx vitest run src/lib/learn` | Knowledge Center checks: broken internal links, nested lists, unmatched `**`, duplicate slugs or titles, descriptions over 170 characters, articles nothing links to. The test pins the article count at 100; change it when articles are added |

Billing tests run against a fake PayMongo API and the real database: `npx vitest run -c vitest.api.config.ts tests/api/web-billing.test.ts tests/api/billing.test.ts`.

Each feature document records its last test run (date, pass counts) and keeps a manual checklist. Page rendering is not covered by automated tests, and several pages were checked by type and tests only. As of 2026-10-21, 12 API tests failed on unchanged code because of stale expectations; these are recorded as pre-existing, not caused by later work. There is no automated test suite for the device API yet (`tests/api/device.test.ts` is to be added before the app's beta).

Source: features/*.md §12, subscriptions.md §12, knowledge-center.md, child-app-spec.md §14.

## Manual testing for eGuard payments and devices

Manual tests for eGuard use test modes and test hardware:

- **Payments:** PayMongo test mode with test keys. GCash and Maya open a PayMongo test page (Authorize or Fail). QR Ph test codes are real and must not be scanned and paid; the `test_url` is used instead. PayMongo's "Create a new test Subscription cycle" endpoint runs a renewal at once.
- **Data migrations:** a dry run inside a rolled-back transaction, then applied locally.
- **eGuard for Windows:** acceptance tests on a Windows 11 virtual machine with a standard child account, including blocking a game, the gaming-time limit, clock changes, killing the agent and every uninstall route (desktop-agent-spec.md §14).
- **Child devices:** real devices paired against a local server (`npm run dev`, with `APP_URL` reachable from the phone); the dev simulator goes through the same server paths.

Test card numbers are in subscriptions.md §12 and are not repeated here. Clock drift in the Docker test environment once made an invitation test fail; nothing in the code was involved.

Source: subscriptions.md §12, features/protection.md §12, desktop-agent-spec.md §14, child-app-spec.md §14.

## Release steps for an eGuard server release

An eGuard server release (web application and database) follows these steps, built from the plan-change and Parent care release procedures:

1. Back up the production database.
2. Merge the change.
3. Run `npm run db:deploy` against production (this runs `prisma migrate deploy`). Ship code and migration together: code without its migration can fail, and a migration without its code can apply wrong values.
4. Deploy the application on Vercel.
5. Run the release's checks straight away (for example, the SQL checks in plan-change-2026-10.md §1, or a few cron runs of console › Parent care › Delivery and the `[parent-care]` log lines).
6. Update any copy outside the repository that the change affects (for example Google Play Console listings, store and social copy).
7. Send customer notices, if any, from Console › Broadcasts, only after the checks pass. Account changes go as a service notice; news goes as a product update.

A new feature with outgoing messages is deployed switched off or paused where possible (for Parent care, see "Deploying, Pausing and Rolling Back Parent Care").

Plan-limit and price changes follow "Releasing a Plan-Limit or Price Change"; a price change for new purchases needs no code release.

Approval needed before step 2: [TO CONFIRM: role that approves a production release].

Source: plan-change-2026-10.md §1 and §2, features/parent-care.md §9, pricing-desktop.md §7.

## Production go-live checks for eGuard

The production go-live checks for eGuard (production variables, live payments, the end-to-end test, backups, test data, error alerts and the maintenance job) are set out step by step in "Production Go-Live Checks".

`npm run db:seed` must never run against production: it deletes every family. Refreshing the review demo family is covered in "Refreshing the Store-Review Demo Account".

Source: launch-visibility.md, app-listing.md §12.

## Switching on sign-in hardening in production

Switching on sign-in hardening (from 2026-10-15) in production, including the reCAPTCHA keys, the app builds with the code step and the removal of the legacy sign-in cookie after 2026-11-14, follows "Production Go-Live Checks" (section "Procedure: switching on sign-in protections").

Source: features/authentication.md.

## Release steps for eGuard for Android, eGuard for iPhone and iPad, and eGuard for Windows

Releases of eGuard for Android and eGuard for iPhone and iPad follow "Submitting the App to Google Play and the App Store" (built from the store checklists in docs/app-listing.md §15). Server-side, `MOBILE_MIN_APP_VERSION` and `CHILD_MIN_APP_VERSION` force an update after a protocol change, and server changes that older apps cannot handle ship with or after the new app builds.

eGuard for Windows releases are signed, started with a small beta group and, if Microsoft Defender flags the agent, reported as a false positive, following "Buying and Renewing the Code-Signing Certificate" (steps 5 to 8); that SOP also holds the certificate's lead time and yearly renewal. In addition, each Windows release is published on the server (`DESKTOP_RELEASE`); agents fetch a signed manifest and accept only files whose size, SHA-256 and Authenticode signer check out (desktop-agent-spec.md §10).

Rotating the browser policy signing key needs an extension update that trusts the new public key before the server switches.

Source: code-signing.md, desktop-agent-spec.md, browser-extension-api.md §5, child-app-spec.md §12.

## Rollback steps for eGuard

A general rollback procedure for eGuard server releases is not in the sources: [TO CONFIRM: general rollback steps, including use of Vercel's previous deployment and restoring the database backup]. The documented rollbacks are:

**Parent care engine:** see "Deploying, Pausing and Rolling Back Parent Care" (section "Procedure: rolling back Parent care").

**Plan-limit change (2026-10-28):** no rollback is described; see "Releasing a Plan-Limit or Price Change".

**eGuard for Windows updates:** if a new version does not report healthy (a sync and a saved state) within 10 minutes, the guard puts back the previous version automatically.

**Payments:** PayMongo errors keep the last known state and never downgrade anyone.

Source: features/parent-care.md §9, plan-change-2026-10.md, desktop-agent-spec.md §10, subscriptions.md §11.

## Change approvals for eGuard

The owner accepts or rejects product, pricing and engineering recommendations (examples: the Windows pricing decisions of 2026-10-23, the plan-limit change of 2026-10-28, and the Windows agent decisions of 2026-10-23 and 2026-10-24). The approvals named in the sources are:

| Change | Approval needed | From |
|---|---|---|
| Product, pricing or engineering decision | Accept or reject the recommendation | Owner |
| Code-signing certificate and a Windows test machine | Purchase and setup | Owner |
| Google Play base plans and price cohorts | Changes in Play Console | Owner |
| Legal pages (privacy policy, terms) | Legal review before relying on them | Lawyer [TO CONFIRM: named counsel] |
| Parent care pilot | Legal and Data Protection Officer review, privacy-policy wording | Data Protection Officer [TO CONFIRM: name] |
| Parent care Filipino templates | Approval of the translation | Native Filipino speaker [TO CONFIRM: who] |
| Knowledge Center facts (hotlines, laws, platform features) | Confirmed against official sources before announcing, then every six months | [TO CONFIRM: role] |
| Production release | Approval to deploy | [TO CONFIRM: role] |
| Database migration on production | Approval to run | [TO CONFIRM: role] |
| Emergency change | Approval | [TO CONFIRM: role] |

Source: pricing-desktop.md §8, desktop-agent-spec.md §15, launch-visibility.md §2, features/parent-care.md §10, knowledge-center.md.

## Incident hand-over for eGuard

An incident hand-over procedure for eGuard is not in the sources. [TO CONFIRM: who is on call, how an incident is handed over, and where incidents are recorded.]

Facts that apply to incidents:

- **Where to look:** see "Systems Overview" (Monitoring of eGuard systems) for log lines, the maintenance job response, the PayMongo dashboard and the console audit log.
- **Leaked PayMongo keys:** rotate them in the PayMongo dashboard.
- **Leaked organization API key:** revoke it on the organization page; revoking takes effect on the next request.
- **Message spike in Parent care:** pause the automations in the console (see "Deploying, Pausing and Rolling Back Parent Care").
- **Windows PC that cannot be removed normally:** support can issue a signed removal for one computer after checking the parent's identity (designed 2026-10-24, not yet built).
- **Local development database:** on 2026-10-21 a `prisma migrate diff --shadow-database-url` run pointed at the local development database reset it; no other environment was touched. A shadow database URL is never pointed at a database whose data is needed. `npx prisma migrate reset --force` restores the local schema and seeds the demo family.

Source: subscriptions.md §11, organization-api.md §8, features/parent-care.md, desktop-agent-spec.md §10.

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Systems Overview; Pricing and Discount Rules; Production Go-Live Checks; Deploying, Pausing and Rolling Back Parent Care; Releasing a Plan-Limit or Price Change; Buying and Renewing the Code-Signing Certificate; Submitting the App to Google Play and the App Store; Data Handling and Confidentiality; eguard: Decision Log; eguard: Risks, Assumptions and Constraints |

## Open questions

1. [TO CONFIRM: owner role] for this document, and [TO CONFIRM] effective and review dates.
2. [TO CONFIRM: written code style guide, formatter and lint configuration.]
3. [TO CONFIRM: lint and formatting rules for the Windows agent repository (Rust).]
4. [TO CONFIRM: who reviews a change, how many approvals are needed, and what a reviewer checks.]
5. [TO CONFIRM: branch naming convention, default branch, and who reviews pull requests.]
6. [TO CONFIRM: repository host and whether checks run automatically on each pull request.]
7. [TO CONFIRM: role that approves a production release], [TO CONFIRM: role that approves a production database migration], [TO CONFIRM: role that approves an emergency change].
8. [TO CONFIRM: general rollback steps], including use of Vercel's previous deployment and restoring the database backup.
9. [TO CONFIRM: named counsel] for legal review; [TO CONFIRM: name] of the Data Protection Officer; [TO CONFIRM: who] approves Filipino templates; [TO CONFIRM: role] who checks Knowledge Center facts.
10. [TO CONFIRM: who is on call, how an incident is handed over, and where incidents are recorded.]
11. The 12 pre-existing API test failures recorded on 2026-10-21 (stale expectations in `mobile-api`, `security`, `browser`, `browser-policy`, `browser-health`): confirm whether they are fixed, since the merge rule above expects the API suite to pass.
12. Contradiction, Windows agent build status. desktop-agent-spec.md status: "not built yet"; its section 10: updates "built 2026-10-24". desktop-agent-prompt.md (a build prompt) also disagrees with the spec on Firefox policy, UI toolkit and uninstall entry; the prompt itself says the spec wins. This document follows desktop-agent-spec.md.
13. Contradiction, code-signing option and cost. pricing-desktop.md: "About $10 a month (Azure Trusted Signing), or $200–400 a year (OV certificate)". code-signing.md: Azure Artifact Signing is "not available to us"; the decision is an OV certificate with cloud signing at about $200–500 a year. This document follows code-signing.md. Status in code-signing.md (2026-10-23): "not bought yet"; confirm the current status.
14. Contradiction, go-live checklist. launch-visibility.md section 1: latest copy "not deployed yet" and email records "Needs attention". The same file's section 9 checklist ticks both as done.
15. Possibly out of date: features/parent-care.md (2026-10-21) says "Nothing has been deployed". Confirm whether the Parent care engine is in production and whether its automations are running.
16. Deadline: the legacy sign-in cookie is read until 2026-11-14; confirm who removes `LEGACY_COOKIE` after that date.
17. Out of date, plan limits in technical sources used for testing. mobile-api.md `/subscription/plans` example shows Free `deviceLimit: 2`, Plus 5/10, Family 10/20; features/children.md §6 "Free 1, Plus 5, Pro 10"; features/devices.md §6 "Free 2, Plus 10, Pro 20" (and its browser test note "slots (Free 2)"). Current limits (subscriptions.md, plan-change-2026-10.md): Free 1/1, eGuard Plus 3/5, eGuard Family 6/12, with legacy limits for families paying before 2026-10-28.
