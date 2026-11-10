# Production Go-Live Checks

## Summary

The production go-live procedure lists the checks the engineering team runs before eGuard's production site at www.eguard.family is announced to the public, and the steps that switch on the sign-in protections in production. Each check stops a failure that would keep parents from signing up, paying or receiving emails, or would leave the team unaware when production breaks. The checks cover production environment variables, payments, an end-to-end test, the database and backups, test data, error alerts, the cron job, security headers, domain and email records, and the authentication switch-on. The source's own checklist marks every production go-live item as done, while its status table still lists two items as "Needs attention", so the current state must be confirmed before relying on it.

## Purpose of the production go-live checks

The purpose of the production go-live checks is to make sure the public site works end to end and is safe before any announcement sends parents to it. Parents are deciding whether to trust eGuard with their children's devices; a failed verification email or a test payment key would cost that trust.

## When the production go-live checks apply

The production go-live checks apply before eGuard is announced publicly, and again before any later announcement or launch campaign if production settings have changed since the last run. The authentication switch-on steps apply whenever the authentication hardening is first deployed to production. The checks do not cover the app store submission (see "Submitting the App to Google Play and the App Store") or a PayMongo account set-up from scratch (see "Setting Up PayMongo"). [TO CONFIRM: whether the checks are re-run on a schedule or only before announcements]

## Roles involved in the production go-live checks

| Role | Responsibility |
|---|---|
| Engineering | Runs every check, sets production variables in Vercel, runs migrations, sets up backups and alerts. [TO CONFIRM: which role or person] |
| Owner | Approves the real-money test purchase and decides when the site is announced. [TO CONFIRM: who approves] |
| Support inbox owner | Confirms support@devcomdigital.com is read. [TO CONFIRM: who] |

## Inputs needed before the production go-live checks

| Input | Detail |
|---|---|
| Vercel production access | To read and set Production environment variables and domains |
| Production database access | To run `npm run db:deploy`, set up backups and practise a restore |
| PayMongo live account | Activated, with live keys and a live webhook (see "Setting Up PayMongo") |
| Resend account | With the sending domain verified |
| DNS access for eguard.family | For SPF, DKIM, DMARC and MX checks |
| A Gmail inbox | For the end-to-end email test |
| A test phone | To pair a device in the end-to-end test |
| A Google account for reCAPTCHA | To create the reCAPTCHA v3 key |

## Procedure: production variables and payments

1. Engineering deploys the latest copy changes (the title, description and keyword changes in `src/app/layout.tsx` and the seven site pages) and confirms the live title is the new one.
2. Engineering confirms in Vercel › Production that these variables are set: `APP_URL` (the public HTTPS address `https://www.eguard.family`), `CRON_SECRET`, `TWO_FACTOR_KEY`, `SUPPORT_EMAIL` (support@devcomdigital.com), `RESEND_API_KEY`, `MAIL_FROM` or `RESEND_FROM` on a domain verified in Resend, `MAP_TILE_URL` (a keyed map provider, not plain OpenStreetMap) and `BROWSER_POLICY_SIGNING_KEY`.
3. Engineering confirms `TWO_FACTOR_KEY` is backed up somewhere safe; it can never change. [TO CONFIRM: where it is backed up]
4. Engineering confirms PayMongo uses live keys, not test keys, and that the webhook points at `https://www.eguard.family/api/billing/paymongo/webhook` with its secret in `PAYMONGO_WEBHOOK_SECRET`.
5. Engineering makes one real purchase in Philippine pesos (₱), then refunds it following "Refunding a Purchase". If the purchase or refund fails, then stop and use the common problems table in "Setting Up PayMongo".

## Procedure: end-to-end test, database and monitoring

1. Engineering runs the end-to-end test on production: register a new account → the email reaches the Gmail inbox (not spam) → add a child → pair a device → a setting shows as Verified → reset the password → sign in with two-step verification. If any step fails, then fix it and repeat the whole test.
2. Engineering runs `npm run db:deploy` against production.
3. Engineering turns on automated database backups and practises one restore. [TO CONFIRM: backup provider, schedule and where the restore test is recorded]
4. Engineering removes test families from production. The review demo family stays only if app store review needs it (see "Refreshing the Store-Review Demo Account").
5. Engineering turns on Vercel log alerts or a log drain at minimum, so someone is told when production throws an error. [TO CONFIRM: who receives the alerts]
6. Engineering confirms the cron endpoint `/api/cron/maintenance` refuses unauthenticated calls with 401 and that Vercel runs it every 10 minutes.
7. Engineering confirms the security headers are live: HSTS (2 years, subdomains), CSP `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff` and `strict-origin-when-cross-origin`.

## Procedure: domain and email

1. Engineering confirms `www.eguard.family` is the primary domain and that `eguard.family` and the old `vercel.app` address redirect to it with a permanent 308.
2. Engineering confirms canonical and `og:url` tags read `https://www.eguard.family`, which shows `APP_URL` resolves correctly.
3. Engineering confirms Resend's DKIM record is published at `resend._domainkey.eguard.family`.
4. Engineering adds a report address (`rua`) to the DMARC record. After about two clean weeks of reports, DMARC moves from `p=none` to `p=quarantine`.
5. If mail is sent over SMTP as `@eguard.family`, then engineering adds that provider to an SPF record on the root domain.
6. Engineering sends a test email, confirms it lands in the Gmail inbox, and switches `MAIL_FROM` to the eGuard no-reply address once the domain passes SPF and DKIM.
7. Engineering keeps `SUPPORT_EMAIL` on the DevCom inbox, because eguard.family has no MX record and cannot receive mail.

## Procedure: switching on sign-in protections

The authentication hardening (2026-10-15) needs three production steps (1 to 3), followed by three follow-up checks (4 to 6):

1. Engineering runs the `auth_hardening` migration with `npm run db:deploy`.
2. Engineering creates a reCAPTCHA v3 key for `www.eguard.family` and sets `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY`. The bot check is off until both are set.
3. Engineering ships the Android and iOS builds with the emailed-code sign-up step before or together with the server. Older app builds cannot finish creating an account; signing in still works on them.
4. In the first days, engineering watches the logs for `[bot-check] turned down`. If real parents are being refused, then lower `RECAPTCHA_MIN_SCORE` (default 0.5).
5. Engineering confirms `PWNED_PASSWORDS` is not set to `off`, which would skip the breached-password check. [TO CONFIRM: whether the check should be on in production]
6. After 2026-11-14, engineering removes the legacy sign-in cookie code (`LEGACY_COOKIE` in `src/lib/auth.ts`); the old cookie stops being read on that date.

## Approvals required for the production go-live checks

| What | Who approves | Limit |
|---|---|---|
| Real-money test purchase and refund | [TO CONFIRM: approver] | One purchase, refunded |
| Announcing the site | [TO CONFIRM: approver] | Only after every production go-live check passes |
| Lowering `RECAPTCHA_MIN_SCORE` | [TO CONFIRM: approver] | Only when real parents are being refused |

## Exceptions in the production go-live checks and what to do

| Situation | What to do |
|---|---|
| Verification email lands in spam | Check SPF, DKIM and DMARC; do not announce until it reaches the inbox |
| A production variable is missing | Set it in Vercel › Production and redeploy |
| PayMongo still on test keys | Switch to live keys; see "Setting Up PayMongo" |
| Older app builds in use when the code step ships | Signing in still works; creating an account needs an updated build |
| Mobile apps ship later | Remove "coming soon" notes, add store badges, and set `MOBILE_MIN_APP_VERSION`, `FCM_SERVICE_ACCOUNT` and the Apple and Google sign-in client IDs |

## Outputs of the production go-live checks and where they are recorded

| Output | Where it is recorded |
|---|---|
| Ticked checklist | launch-visibility.md §9 [TO CONFIRM: whether a separate go-live record is kept] |
| Production variables | Vercel › Production |
| Test purchase and refund | PayMongo dashboard; eGuard audit log (`purchase.paid`, `purchase.voided`) |
| Backup and restore test | [TO CONFIRM: location] |

## Time targets for the production go-live checks

| Step | Target |
|---|---|
| DMARC moves to `p=quarantine` | After about two clean weeks of reports |
| Bot-check log watch | The first days after reCAPTCHA is switched on |
| Legacy cookie code removal | After 2026-11-14 |
| Whole checklist | [TO CONFIRM: target date or lead time before announcing] |

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Setting Up PayMongo; Refunding a Purchase; Refreshing the Store-Review Demo Account; Submitting the App to Google Play and the App Store; Engineering Standards and Release Procedure; Systems Overview |

## Open questions

1. Owner role, effective date and review date of this procedure are not stated in the sources.
2. Who runs the checks, who approves the real-money test purchase, announcing the site and lowering the bot-check score, who reads the support inbox, and who receives error alerts.
3. Contradiction inside launch-visibility.md (source inventory contradiction 14): section 1 lists "Email records … Needs attention" and "Latest copy … not deployed yet; the live title is still the old one", with totals "2 needs attention"; the section 9 checklist ticks "Latest copy changes … committed and deployed", "DMARC gets a `rua` report address", "SPF added" and "Test email reaches the Gmail inbox; `MAIL_FROM` switched". Section 1 is from the 4 October 2026 audit; confirm the current state.
4. The whole "Production go-live" block in launch-visibility.md §9 is ticked, but the same file's §2 says "don't announce it until these are done" as if they were open. Confirm the ticks were verified on production.
5. Where `TWO_FACTOR_KEY` is backed up; backup provider, schedule and restore record; whether a separate go-live record exists; target date for the checklist; whether the checks are re-run on a schedule.
6. Whether `PWNED_PASSWORDS` should stay on in production (features/authentication.md only says "off" skips the check).
7. Whether the authentication switch-on (migration, reCAPTCHA keys, app builds with the code step) has been done. Step 3 depends on the apps, which app-listing.md says "aren't built yet" while faq.md says Android is on Google Play (source inventory contradiction 4).
8. launch-visibility.md's "When the mobile apps ship" list says to set "Google Play billing and RTDN variables", while subscriptions.md §10 says to leave `GOOGLE_PLAY_PACKAGE_NAME` and `GOOGLE_PLAY_SERVICE_ACCOUNT` empty "so the apps don't sell". Confirm whether Play Billing is meant to be turned on.
9. The end-to-end test in launch-visibility.md says "verification email"; features/authentication.md says sign-up now sends a 6-digit code by email. The test should check that the code email arrives.
10. Open legal items in the same checklist: both legal pages reviewed by a lawyer; DPO designated by name with the National Privacy Commission. Confirm whether these must be done before the announcement.
11. Push alerts: launch-visibility.md says alerts copy describes email and in-app alerts "until push ships"; faq.md says Plus and eGuard Family get push (source inventory contradiction 5).
