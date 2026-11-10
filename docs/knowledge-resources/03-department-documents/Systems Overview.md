# Systems Overview

## Summary

"Systems Overview" describes the systems behind eGuard for the engineering team at DevCom Digital Marketing Services: what each system does, what data it holds, which other systems it talks to and where its documentation lives. eGuard runs as one Next.js 16 application on Vercel with a PostgreSQL database (through Prisma), serving the public website, the parent web dashboard, the console (staff back office) and four APIs: parent mobile, child device, browser extension and organization. Outside services are PayMongo (payments), Resend or SMTP (email), Firebase Cloud Messaging (push), MapTiler (map tiles), Google reCAPTCHA v3 and Have I Been Pwned (sign-in protection), and Anthropic Claude or OpenAI (broadcast drafts). One scheduled maintenance job, called by Vercel cron every 10 minutes, drives billing re-checks, reminders, broadcasts, Parent care and data retention. Owners of the individual systems are not named in the sources.

## eGuard web application

The eGuard web application is a single Next.js 16 App Router application (server components and server actions) hosted on Vercel. It serves:

- the public website at www.eguard.family (landing page, pricing, blog, Help Center at `/help`, Knowledge Center at `/learn`, legal pages)
- the parent web dashboard (dashboard, children, devices, protection, location, Parent care at `/plan`, reports, notifications, organizations, settings)
- the console on its own host (see "Console (staff back office)")
- the APIs: `/api/mobile/v1` (parents), `/api/device/v1` (child devices and Windows PCs), `/api/browser/v1` (browser extension), `/api/org/v1` (organizations), plus the PayMongo webhook and the maintenance job endpoint

`eguard.family` redirects permanently (308) to `www.eguard.family`, except `/api/` paths, so webhooks and apps still pointed at an old host keep working. Security headers (HSTS, CSP `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `strict-origin-when-cross-origin`) are live. Key settings: `APP_URL`, `TWO_FACTOR_KEY`, `SUPPORT_EMAIL`.

| Item | Detail |
|---|---|
| Owner | [TO CONFIRM: system owner] |
| Data held | None itself; all state is in the PostgreSQL database |
| Talks to | Every system in this document |
| Documentation | docs/features/README.md and docs/features/*.md (one file per parent web app feature), docs/launch-visibility.md, docs/knowledge-center.md |

## eGuard database (PostgreSQL and Prisma)

The eGuard database is PostgreSQL, accessed through Prisma 6, with the schema in `prisma/schema.prisma` and migrations in `prisma/migrations`. Production migrations are applied with `npm run db:deploy`. There is no plans table: plans are defined in code (`src/lib/plans.ts`).

Main data held:

| Area | Examples |
|---|---|
| Families and accounts | `Family` (plan, child and device limits, legacy limits flag, time zone, default Asia/Manila), `User` (role `FAMILY_ADMIN` or `PARENT`), sessions (only token hashes) |
| Children and devices | Children, devices, browser installations, device tokens (only SHA-256 hashes), protection policies and reports, configuration history, alerts |
| Location | One current position per device; visits only when location history is on; saved places |
| Billing | `StorePurchase` (one row per purchase: PayMongo, sponsor code, promotion, Google Play) |
| Organizations | Organizations, admins, memberships, sponsor-code batches and codes, API key hashes |
| Staff and audit | `StaffUser`, `StaffSession`, `StaffAuditLog`, family `AuditLog` |
| Parent care | 9 tables (preferences, automations, jobs, messages, events and others) |
| Broadcasts | Broadcasts, deliveries, mailing-list subscribers |

Rate-limit counters are also stored in the database (`lib/rate-limit`). Activity is deleted after 90 days; location history retention defaults to 90 days.

| Item | Detail |
|---|---|
| Owner | [TO CONFIRM: system owner] |
| Talks to | The web application only |
| Documentation | docs/subscriptions.md §3, docs/organizations.md §5, docs/features/parent-care.md §4, docs/console.md §3 |

## eGuard maintenance job (Vercel cron)

The eGuard maintenance job is the endpoint `/api/cron/maintenance`, called by Vercel cron every 10 minutes (configured in `vercel.json`) with `Bearer $CRON_SECRET`; without the secret it answers 401. The job runs these steps, among others:

- re-reading open purchases from PayMongo and downgrading families whose paid time ended
- pass and sponsored-plan reminders 3 days before the end
- sending alert emails and push
- sending console broadcasts (up to 100 emails a run)
- Parent care planning and delivery
- removing ended staff sessions, data retention purges, closing stale configuration changes
- finishing quiet removals of Windows PCs after 7 days

Its response reports each step's result (for example `purchases`, `passReminders`, `parentCare`) and lists failed steps in `failed`.

| Item | Detail |
|---|---|
| Owner | [TO CONFIRM: system owner] |
| Data held | None; works on the database |
| Talks to | Database, PayMongo, email, Firebase Cloud Messaging |
| Documentation | docs/subscriptions.md §7.4, docs/console.md §8, docs/features/parent-care.md |

## PayMongo (payments)

PayMongo takes every eGuard payment. Passes use PayMongo Hosted Checkout (GCash, Maya, card, QR Ph by default, set in `PAYMONGO_PASS_METHODS`); auto-renew uses the PayMongo Subscriptions API (card or Maya). Sponsor-code batches use Hosted Checkout. Card details go from the browser straight to PayMongo with the public key, so card data never reaches eGuard's servers.

The server never trusts the browser or a webhook body: it re-reads every checkout session or subscription from the PayMongo API before changing a plan. Webhooks arrive at `/api/billing/paymongo/webhook`, signed with an HMAC that is checked against the key's mode (test or live). Settings: `PAYMONGO_SECRET_KEY`, `PAYMONGO_PUBLIC_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `PAYMONGO_PASS_METHODS`, and the price settings `PRICE_PLUS_MONTHLY`, `PRICE_PRO_MONTHLY`, `PRICE_PLUS_YEARLY`, `PRICE_PRO_YEARLY`. Prices themselves are in "Pricing and Discount Rules".

| Item | Detail |
|---|---|
| Owner | [TO CONFIRM: system owner and PayMongo account holder] |
| Data held | Payments, customers, subscriptions, refunds, receipts |
| Talks to | Web application (API calls, webhooks), maintenance job |
| Documentation | docs/subscriptions.md, docs/organizations.md |

## Email delivery (Resend, SMTP and Mailpit)

eGuard email (sign-up codes, verification, alerts, reminders, new-sign-in notices, organization emails, broadcasts, Parent care) goes out over SMTP (`SMTP_URL`) or Resend (`RESEND_API_KEY`), from the address in `MAIL_FROM` or `RESEND_FROM`. In development, mail goes to Mailpit, which the API tests also read. Resend DKIM is published for `eguard.family`; DMARC and SPF settings are in docs/launch-visibility.md §3. The domain has no MX record, so nothing at `@eguard.family` can receive mail; replies go to the support inbox support@devcomdigital.com (`SUPPORT_EMAIL`).

Broadcasts are throttled to about 600 emails an hour to stay under Resend's default rate limit. Resend only confirms acceptance; no delivery webhooks are wired, so bounces do not create suppressions.

| Item | Detail |
|---|---|
| Owner | [TO CONFIRM: system owner] |
| Data held | Sent messages and delivery logs at the provider |
| Talks to | Web application, maintenance job |
| Documentation | docs/launch-visibility.md §3, docs/console.md §8 |

## Firebase Cloud Messaging (push)

Firebase Cloud Messaging (FCM) delivers push notifications to the eGuard app. It needs `FCM_SERVICE_ACCOUNT` on the server. Push is used for:

- parent alerts (on Free, security alerts only; on eGuard Plus and eGuard Family, every alert), sent with the maintenance job rather than instantly
- silent "sync now" messages to child devices when a parent changes a setting, runs a check, changes app rules or extra time, or moves the device (iOS through APNs background push)
- Parent care messages, for parents who consented

Without `FCM_SERVICE_ACCOUNT`, nothing is pushed and devices rely on polling. FCM only confirms acceptance; real FCM delivery was not exercised in the Parent care tests. Whether push alerts work today is an open question (see Open questions).

| Item | Detail |
|---|---|
| Owner | [TO CONFIRM: system owner] |
| Data held | Push tokens (also stored on the server per account and per device) |
| Talks to | Web application, the eGuard app (eGuard for Android and eGuard for iPhone and iPad) |
| Documentation | docs/mobile-api.md §A5 and §P7, docs/child-app-spec.md §8 |

## Map tiles (MapTiler through the tile proxy)

Map tiles for the family map come through eGuard's own proxy at `/api/tiles/{z}/{x}/{y}`. The server fetches each tile, so the tile provider never sees the parent's IP address or the area being viewed. The proxy is for signed-in parents only, covers zoom 0–18, and keeps a 1,500-tile in-memory cache for 24 hours. `MAP_TILE_URL` points to a commercial provider (MapTiler today) whose key never reaches the browser; `MAP_TILE_REFERER` supports a key limited to allowed websites. A refused key is logged as "[tiles] The tile provider answered 403".

| Item | Detail |
|---|---|
| Owner | [TO CONFIRM: system owner] |
| Data held | None at eGuard beyond the short cache |
| Talks to | Web application, MapTiler |
| Documentation | docs/features/location.md |

## Sign-in protection (reCAPTCHA v3 and Have I Been Pwned)

Sign-in protection uses two outside services:

- **Google reCAPTCHA v3** on the website's sign-in, create-account, forgot-password and mailing-list forms. It is off until `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` are set; scores under `RECAPTCHA_MIN_SCORE` (default 0.5) are refused and logged as `[bot-check] turned down`. If Google is unreachable, forms go through. The apps do not use it.
- **Have I Been Pwned** range API turns down breached passwords at sign-up, reset, change and accepting an invitation. Only the first 5 characters of the password's SHA-1 leave the server. If the service is down, the password is allowed. `PWNED_PASSWORDS=off` skips the check.

Passwords are hashed with argon2id; sessions last 30 days, and a browser session also ends after 14 days unused.

| Item | Detail |
|---|---|
| Owner | [TO CONFIRM: system owner] |
| Talks to | Web application |
| Documentation | docs/features/authentication.md |

## Console (staff back office)

The console is the staff back office at console.eguard.family. It runs in the same Next.js application on its own host, with its own sign-in (email, password and authenticator code, always). Staff accounts live in separate tables, so a parent account can never open the console. Accounts are created and reset with `scripts/create-staff.ts`; there is no sign-up page and no staff roles in v1.

The console shows families (accounts, plans, purchases, counts of children and devices), support tickets, organizations, broadcasts (service notice and product update), Parent care dashboards and the staff audit log. By rule, it never shows a child's location, browsing, app use, screen time, alerts or photos. Every view of a family, ticket or organization is written to `StaffAuditLog`. "Write with AI" drafts broadcasts with Anthropic Claude (Claude Opus 5.5) or OpenAI (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, optional `AI_PROVIDER`, `OPENAI_MODEL`); only what staff type is sent to the provider.

Console sessions end 12 hours after sign-in or after 30 minutes idle. Changing a family's plan, refunds and replying to tickets are not in the console.

| Item | Detail |
|---|---|
| Owner | [TO CONFIRM: system owner] |
| Data held | Staff accounts, staff sessions, staff audit log, broadcasts |
| Talks to | Database, email, AI provider |
| Documentation | docs/console.md |

## Parent care engine

The Parent care engine sends optional tips, weekly plans, activity reminders, check-ins and monthly reports to parents. It is built into the web application, with no new service or dependency: the maintenance job runs it, PostgreSQL holds its job queue, and it delivers through the app's own email, push and an in-app inbox on the `/plan` page. Safety alerts are sent before it and are never delayed by its limits.

Five automations run (briefing, follow-up, weekly plan, check-in, monthly report), with contact limits of 1 push or email a day and 3 a rolling week, quiet hours (default 21:00–07:00 in the parent's own time zone; the family default is Asia/Manila), and a 10% holdout group. No message text is stored. Staff pause, resume and retry it from the console. As of 2026-10-21 it was implemented and tested but not deployed.

| Item | Detail |
|---|---|
| Owner | [TO CONFIRM: system owner] |
| Data held | 9 Parent care tables (events kept 400 days, messages 365, finished jobs 90) |
| Talks to | Database, email, Firebase Cloud Messaging, console |
| Documentation | docs/features/parent-care.md |

## eGuard for Android and eGuard for iPhone and iPad (parent and child device modes)

eGuard for Android and eGuard for iPhone and iPad are one app (the eGuard app) that runs either in parent mode or in child device mode, never both. Parent mode calls the parent API (`/api/mobile/v1`) with a 30-day session token; child device mode calls the child device API (`/api/device/v1`) with a device token from pairing that does not expire. Neither API accepts the other's token.

- A child device syncs every `nextSyncSeconds` (300 seconds today) and on a silent push; it applies settings, reads them back from the operating system and reports, so a setting is only Verified when the device confirms it.
- Android applies protections with on-device APIs (no Google Family Link); iOS uses Apple's Screen Time APIs and needs the Family Controls distribution entitlement.
- `CHILD_MIN_APP_VERSION` and `MOBILE_MIN_APP_VERSION` force updates.
- The apps show the plan but do not sell it; Google Play billing code exists but is turned off (`GOOGLE_PLAY_PACKAGE_NAME` and `GOOGLE_PLAY_SERVICE_ACCOUNT` left empty).
- There are no analytics, ads or tracking SDKs in the apps.

Customer-facing sources (faq.md, profile.md) say eGuard for Android is available on Google Play and eGuard for iPhone and iPad is coming soon. Other sources disagree: [TO CONFIRM: whether eGuard for Android is live on Google Play] (see Open questions).

| Item | Detail |
|---|---|
| Owner | [TO CONFIRM: system owner] |
| Talks to | Web application APIs, Firebase Cloud Messaging |
| Documentation | docs/mobile-api.md, docs/child-app-spec.md, docs/mobile-organizations.md, docs/app-listing.md |

## eGuard browser extension and its API

The eGuard browser extension (Chrome, Edge, Firefox) applies a child's browser rules: Safe Browsing, SafeSearch, blocked categories, blocked and allowed sites, focus hours and site-access requests. It calls `/api/browser/v1`. No parent credential reaches the browser: pairing creates an installation with a 15-minute access token and a refresh token that rotates on every use. A replayed refresh token disconnects the browser for security.

Every policy is signed with `BROWSER_POLICY_SIGNING_KEY` (private key, server only); the extension build holds the matching public key. Without the key, `GET /policy` returns 503. The extension syncs every 5 minutes and on browser start, keeps enforcing the last policy offline, and reports only counts of blocked pages, never sites. The wire contract is the Zod schemas in the separate extension repository (`eguard-browser`).

| Item | Detail |
|---|---|
| Owner | [TO CONFIRM: system owner] |
| Data held | Browser installations, policies, access requests, health reports, daily block counts (server side) |
| Talks to | Web application |
| Documentation | docs/browser-extension-api.md |

## Organization API

The Organization API (`/api/org/v1`) lets an organization's own systems read its sponsor codes, batches and counts, and cancel codes. Keys start with `egk_`, are shown once and stored only as a hash; each organization has up to 5 working keys, either read-only or read-and-cancel. Keys are created only by an admin whose family is on eGuard Family, and a key pauses (403) while that family is not on it. Limits: 600 requests per key per 10 minutes; 20 wrong-key requests per address per 15 minutes. The API never returns anything about a family.

| Item | Detail |
|---|---|
| Owner | [TO CONFIRM: system owner] |
| Talks to | Web application, organizations' own systems |
| Documentation | docs/organization-api.md, docs/organizations.md |

## eGuard for Windows (desktop agent)

eGuard for Windows is a child agent for Windows PCs, written in Rust, in a separate repository. It has three parts: a Windows service (`eguard-service.exe`) that syncs and enforces, a per-session agent (`eguard-agent.exe`) that shows block screens with plain Win32 windows, and a guard task (`eguard-guard.exe`) that restarts the service and restores files. It uses the child device API as `platform: WINDOWS`, `kind: COMPUTER`, syncs every 60 seconds, and gets a signed app catalog (`GET /catalog`) and signed update manifests (`GET /update`, release set in `DESKTOP_RELEASE`). Uninstalling needs a signed command from the server or a parent's removal code. Web filtering on the PC is done by the browser extension, which the agent forces into Chrome, Edge and Firefox.

The agent never touches a game's process from the inside and uses no kernel driver. The server side was built 2026-10-23 and 2026-10-24; the agent, installer, code signing and a download page were not built at that time. eGuard for Windows is in testing with no release date.

| Item | Detail |
|---|---|
| Owner | [TO CONFIRM: system owner] |
| Talks to | Web application (device API) |
| Documentation | docs/desktop-agent-spec.md, docs/desktop-agent-open-questions.md, docs/code-signing.md |

## Search, measurement and store consoles

eGuard uses the following outside consoles, none of which receive family data:

| System | Use | Status in sources |
|---|---|---|
| Google Search Console | Indexing, queries, sitemap | Verified; sitemap submitted |
| Bing Webmaster Tools | Indexing, IndexNow | Imported from Search Console |
| Vercel Web Analytics | Cookieless analytics on public pages only | Not yet on (checklist open) |
| Meta Pixel | Only if Facebook ads run; marketing pages only | Code done, off until `NEXT_PUBLIC_META_PIXEL_ID` is set |
| Funnel script (`npm run funnel`) | Sign-up to paired device to upgrade, from eGuard's own database, excluding the demo family | Built |
| Google Play Console | eGuard for Android listing; subscription products `eguard_plus` and `eguard_pro` | Billing turned off |
| Meta Business Suite | Facebook Page | See docs/facebook-page.md |

Owner: [TO CONFIRM: owner of each outside account]. Documentation: docs/launch-visibility.md §4 and §6, docs/app-listing.md.

## How data flows between eGuard systems: settings, device data, alerts and payments

The main data flows between eGuard systems for settings, device data, alerts and payments are:

1. **Setting change.** A parent changes a protection on the web or in the app. The web application stores a pending change and sends a silent push through Firebase Cloud Messaging. The child's device syncs, applies the setting, reads it back and reports. The server marks it Verified or Failed, and the parent's screen (polling every 1–2 seconds) shows the result.
2. **Device data.** Child devices send usage, location fixes and events to the device API. These appear for parents as screen time, the map, alerts and app requests, and feed Configuration Health. Location is stored only on plans with location sharing.
3. **Alerts.** Device reports and events create alerts in the database. The maintenance job sends them by email and push, within the plan's rules; whether push alerts work is [TO CONFIRM: whether push alerts work].
4. **Payment.** The family admin starts a pass or auto-renew on Settings › Subscription. The web application creates the checkout or subscription at PayMongo. The parent pays on PayMongo. The web application re-reads the payment from PayMongo on return, on the webhook and in the maintenance job, then sets the family's plan.

## How data flows between eGuard systems: sponsor codes, browser policy, broadcasts and the Organization API

The data flows between eGuard systems for sponsor codes, browser policy, broadcasts and the Organization API are:

5. **Sponsor codes.** An organization admin pays for a batch at PayMongo; once the payment is re-read as paid, codes are created. A family admin redeems a code on the web, which creates a purchase row and changes the plan.
6. **Browser policy.** The server signs the child's browser policy; the extension fetches, verifies and applies it, and reports health and block counts.
7. **Broadcasts and Parent care.** Staff write a broadcast in the console; the maintenance job sends it in batches through email. Parent care jobs are planned and delivered by the same job.
8. **Organization API.** An organization's system reads codes and counts with its key; no family data leaves.

## eGuard environments: development, test and production

| Environment | What it is |
|---|---|
| Development | Local Next.js dev server (`npm run dev`), local PostgreSQL in Docker (`npm run db:up`, `npm run db:migrate`), Mailpit for email, console at `console.localhost`, PayMongo test keys (a tunnel such as `cloudflared` or `ngrok` for webhooks), development cookies without the `__Host-` prefix. `npx prisma migrate reset --force` rebuilds the local database and seeds the demo family |
| Test | Unit tests (`npm test`), API tests against a running dev server and the real database (`npm run test:api`, with a fake PayMongo API), type check and lint. PayMongo test mode for manual payment tests. A preview deployment can have its own console host (`CONSOLE_HOST`) |
| Production | Vercel Production at www.eguard.family and console.eguard.family, live PayMongo keys, production database with automated backups |

A separate staging environment: [TO CONFIRM: whether one exists]. Changes move from development to production by merging, running `npm run db:deploy` against production and deploying on Vercel; the full procedure is in "Engineering Standards and Release Procedure". `npm run db:seed` must never run against production, because it deletes every family.

## Monitoring of eGuard systems and who is alerted

eGuard monitoring in the sources consists of:

| Signal | Where |
|---|---|
| Errors in production | Vercel log alerts or a log drain (marked set up in the go-live checklist) |
| Billing problems | Log lines `[paymongo]`, `[billing] PayMongo webhook failed`, `[billing] pass reminder failed`; cron response `purchases` and `passReminders`; PayMongo dashboard webhook delivery attempts; audit log entries such as `purchase.paid`, `plan.changed` |
| Parent care | Log lines `[parent-care]`, with warnings for an opt-out spike (5 or more opt-outs and over 2% of 24 hours of push and email) and for 10 or more jobs failed for good in 24 hours; console › Parent care › Delivery (overdue jobs mean the job is not running or cannot keep up) |
| Bot check and map tiles | `[bot-check] turned down`, "[tiles] The tile provider answered 403" |
| Maintenance job | Its response lists failed steps in `failed` |
| Staff actions | Console audit log |

Who receives the alerts: [TO CONFIRM: role or person alerted, and any on-call arrangement]. Uptime monitoring: [TO CONFIRM: whether any exists].

## Known limitations of eGuard systems

Known limitations stated in the sources:

- No realtime channel (no WebSocket or server-sent events); apps poll. "Offline" is shown only after 24 hours without contact.
- Apps are keyed by display name only on phones; two apps with the same name share one rule.
- iOS may not be able to read back settings made in the Settings app (gap G3).
- Refunds of auto-renew invoices are not matched automatically; the card for auto-renew cannot be changed; monthly and yearly auto-renew cannot be switched; there are no receipts in eGuard; `priority_support` is not enforced.
- There is no staff tool to grant a plan, issue refunds or delete accounts, and staff have no roles (see "Console (staff back office)").
- Email and push delivery is not confirmed beyond acceptance, and broadcasts are throttled (see "Email delivery (Resend, SMTP and Mailpit)" and "Firebase Cloud Messaging (push)").
- Parent care planning is fine for thousands of parents; revisit beyond about 50,000.
- 12 API tests failed before the Parent care work, on unchanged code (as of 2026-10-21).
- There is no `tests/api/device.test.ts` suite for the device API.
- A child with a Windows administrator account, or who reinstalls Windows, can defeat the Windows agent in the end.

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Engineering Standards and Release Procedure; Pricing and Discount Rules; Products and Services Catalogue; Data Handling and Confidentiality; Company Glossary |

## Open questions

1. [TO CONFIRM: owner role] for this document, and [TO CONFIRM] effective and review dates.
2. [TO CONFIRM: system owner] for each system: web application, database, maintenance job, PayMongo (and account holder), email, Firebase Cloud Messaging, map tiles, sign-in protection, console, Parent care engine, eGuard app, browser extension, Organization API, eGuard for Windows, and the outside consoles.
3. [TO CONFIRM: whether a separate staging environment exists.]
4. [TO CONFIRM: role or person alerted by production monitoring, any on-call arrangement, and whether uptime monitoring exists.]
5. [TO CONFIRM] code hosting (repository host) for the web application, the extension (`eguard-browser`) and the Windows agent.
6. Contradiction, are the native apps live. app-listing.md and child-app-spec.md: "The native apps aren't built yet". faq.md, profile.md, press-release.md and facebook-page.md: Android works now "through the eGuard app on Google Play". child-app-spec.md also refers to "Android 1.0.9". This document repeats the customer-facing statement.
7. Contradiction, push alerts. launch-visibility.md: Plus lists "Push alerts (coming soon)". app-listing.md blocker 6: "Push notifications aren't wired up". organizations.md: "push isn't wired up for any alert yet". faq.md, profile.md, press-release.md: every plan gets push for security alerts; Plus and eGuard Family push every alert. mobile-api.md: alerts are pushed through FCM.
8. Contradiction, how often a Windows PC syncs. pricing-desktop.md: "A PC syncs every 5 minutes, like a phone". desktop-agent-spec.md and mobile-api.md: computers sync every 60 seconds. This document uses 60 seconds.
9. Contradiction, Windows agent build status. desktop-agent-spec.md status: "not built yet"; its section 10: updates "built 2026-10-24". Confirm the current build state of the agent and installer.
10. Contradiction, protection capabilities per platform. child-app-spec.md section 3: Android App Restrictions and Content "Available"; iOS Downloads "Verify only". mobile-api.md: Android App Restrictions and Content are "PARENT_SET"; iOS Downloads "AVAILABLE". Age-rating tiers: mobile-api.md "4, 9, 13, 16, 18"; child-app-spec.md "4, 9, 12, 13 or 17"; features/protection.md "4, 9, 12, 13, 16, 17, 18".
11. Contradiction, after a device is removed. mobile-api.md and mobile-organizations.md: the app offers to set eGuard up again. child-app-spec.md: "You can now uninstall eGuard".
12. Contradiction, organizations in the apps. organizations.md section 13: joining in the mobile apps is "Not in Phase 1". mobile-organizations.md: "The family side is built" in both apps; mobile-api.md P7: joining an organization works in the app.
13. Contradiction, go-live checklist. launch-visibility.md section 1: latest copy "not deployed yet" and email records "Needs attention". The same file's section 9 checklist ticks both as done.
14. [TO CONFIRM] whether a browser on a paired Windows PC takes a device slot. faq.md: "Chrome and Edge on one laptop count as two devices". pricing-desktop.md: browsers on a paired PC take no slot since 2026-10-23. browser-extension-api.md §4: "Connected browsers count toward the plan's device limit, the same as phones".
15. [TO CONFIRM] Google Play package name. app-listing.md and mobile-api.md: `app.eguard.android`. facebook-page.md: `com.devcom.eguard`.
16. Possibly out of date: features/parent-care.md (2026-10-21) says "Nothing has been deployed". Confirm whether the Parent care engine is now in production.
17. Minor difference, maintenance job schedule. subscriptions.md §7.4: "every 5–15 minutes"; launch-visibility.md and console.md: every 10 minutes (`vercel.json`). mobile-api.md P7: "every few minutes".
18. Out of date, plan limits in technical sources. mobile-api.md `/subscription/plans` example shows Free `deviceLimit: 2`, Plus 5/10, Family 10/20; features/children.md §6 "Free 1, Plus 5, Pro 10"; features/devices.md §6 "Free 2, Plus 10, Pro 20". Current limits (subscriptions.md, plan-change-2026-10.md): Free 1/1, eGuard Plus 3/5, eGuard Family 6/12, with legacy limits for families paying before 2026-10-28.
19. Out of date: child-app-prompts.md marks server gaps G1 (waking the device) and G5 (app approval values) as open; child-app-spec.md section 13 marks G1 done 2026-10-14 and G5 done 2026-10-13. This document follows child-app-spec.md.
