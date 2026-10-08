# QA audit progress

Audit order for "next" / "continue": the first row not marked done. Update this file at the end of every audit.

| # | Area | Status | Notes |
|---|------|--------|-------|
| 1 | `src/app/(app)/settings` | Done 2026-10-07 | 10 fixed (stale weekly-summary copy, Subscription crash when PayMongo/Google Play unreachable, unverified-email copy, device sync/offline labels, shared `TimeZoneSchema`, switch re-sync, derived downgrade copy, Free+history copy, no-children step, app sessions label). Uncommitted. |
| 2 | `src/app/(app)/notifications` | Done 2026-10-07 | 5 fixed: account notices no longer all say "Manage plan" (shared `systemAction`, web + app); app gets `REVIEW_SITE_REQUEST`, `VIEW_BROWSERS`, `VIEW_ORGANIZATIONS`, `VIEW_FAMILY` actions (docs updated); 2000-cap message; header and child empty-state copy. Security checked live (cross-family read/dismiss 404, foreign `childId` ignored). Uncommitted. |
| 3 | `src/app/(app)/reports` | Done 2026-10-07 | 7 fixed: Free "N more apps not named" undercounted (query took 8 apps; `reportData.apps` is now every app, CSV lists all), weekly-summary link opened a locked custom range on Free/Plus (every plan now gets custom ranges up to 7 days), no-children empty state, "500+" at exactly 500 changes, no period tab current when locked, date inputs `max` today, browser health counted as on the dashboard. Export checked live (401/403/Pro contents). Uncommitted. |
| 4 | `src/app/(app)/organizations` | Done 2026-10-07 | 6 fixed: P1 "Add admin" had no rate limit (any verified user could look up accounts by email, learn names, and email anyone repeatedly; now invitations the person accepts, rate-limited by `LIMITS.orgAdminUser`); refunded codes counted as bought; per-person org limit raced on add (now the `org.manage` lock); buy form over 200; pending-checkout next step; web join code uses the mobile schema. Access checked live (outsider and same-family parent 404, no session 401). Uncommitted. |
| 5 | `src/app/(app)/location` | Done 2026-10-07 | 8 fixed: P1 place edit form undid another parent's change (now starts from current values, sends only changed fields); busy days lost their end in the day view, web and `?day=` API (`thinRoute` keeps every stay, thins passing fixes, `thinned` flag); app Today/Yesterday missed a stay begun earlier; saved places unremovable on Free (web lists them, remove only); place limit race (lock); "Show on map" left the viewed day; Recent places link/empty state; empty-places copy. Security checked live (cross-family 404 on visits/location/places/page, 400s, 401, Free 403). Decisions then done: `GET /places` on every plan, "Add a place" by map tap or coordinates. Uncommitted. |
| 6 | `src/app/(app)/children` | Done 2026-10-07 | 5 fixed: P1 app and category limit fields saved a stale value back on blur, undoing another parent's change (re-sync with the saved prop); P1 Profile form always saved name and year, undoing a rename elsewhere (sends only changed fields; one `family-service.updateChild` for web and mobile PATCH); removing a category limit twice at once was a 500 (`deleteMany`); paused category limit after a downgrade had no Remove on web; children list said "Available" for a days-old location. Security checked live (cross-family 404 on child GET/PATCH, category limits and page; non-admin delete 403; 401; bad input 400; Free 403 on setting a limit). Uncommitted. |
| 7 | `src/app/(app)/devices` | Done 2026-10-07 | Clean apart from 1 P3: the pairing form kept a removed child's id while its select showed the first child ("Child not found"). Services already scoped, locked (`withDeviceLock`/`withDeviceSlot`) and password-confirmed. Security checked live (cross-family 404 on device GET/PATCH/DELETE/move/pairing code and page, 400s, 403 without password, 401). Uncommitted. |
| 8 | `src/app/(app)/protection` | Done 2026-10-07 | 2 fixed: P1 a protection change made from an older view silently undid another parent's change or cancelled their queued one (now a `version` per protection, sent back as `baseVersion` by the web flow and optionally the app; `409 stale`; docs updated; check and write run under a per-child-and-protection lock, proven live: 5 concurrent saves from one view → one 202/200, four 409); "Run Configuration Check" enabled with every device offline (can only time out). Security checked live (cross-family 404, bad key/config/baseVersion 400). Uncommitted. |
| 9 | `src/app/(app)/dashboard` | Done 2026-10-07 | 4 fixed, no P1: "Run Configuration Check" quick action enabled with every device offline (now disabled with a reason, as on Protection); mobile `GET /dashboard` `recentAlerts` newest-first so newer info could hide a critical alert (now `bySeverity`, docs updated); "1 need attention"; browser-only child read "No device" in the hero and Today's activity. Checked live with fixtures (offline phone, browser-only child, old critical + 3 newer info alerts), no-token 401. Uncommitted. |
| 10 | Parent mobile API `src/app/api/mobile/v1` | Done 2026-10-07 | Sweep of routes no feature audit owned (health, checks, batches, browsers, browser policy and access requests, locations, screen time, support, help, profiles, app-info) and the `authed`/`open` wrapper; auth routes left for #12. 5 fixed: P1 Free `screen-time?period=7d` named the week's most used apps, which the Apps tab hides (now only apps the tab shows today, as reports do); P1 `GET /children/{id}/apps?filter=` capped each filtered list separately, so installed + blocked named up to twice the Free limit (cap on the whole list, then filter); P1 `visibleApps` broke ties by load order, so web and app Apps tabs (and the name lists) could pick different apps on Free (ties by name); overview `deviceProtection` said "Healthy" with offline devices and "10 issues" for a just-paired one (`deviceProtectionSummary`); support email Reply-To took the parent's name unquoted. Docs updated. Security checked live (cross-family 404 on screen-time, overview, health, browser policy and requests; 400s; 401). Uncommitted. |
| 11 | Device, browser and org APIs `src/app/api/{device,browser,org}/v1` | Done 2026-10-07 | 4 fixed: P1 `POST /device/v1/usage` had no rate limit and each call could add 200 new app names, so a looping or tampered device could grow `AppUsageDaily` without end (now `LIMITS.deviceUsage` 120/h and 300 apps per device-day); `POST /device/v1/report` unlimited (`LIMITS.deviceReport` 120/h); browser pairing failed with a 500 and burned the code when a store was unreachable (now as phone pairing: refresh errors logged, code released on failure); making a pairing code failed the same way. Docs updated. Org API clean (hashed keys, member and plan checked per request, counts only). Checked live: pair phone and browser, code reuse 400, 300-app cap, 120×200 then 429 on /report, bad device/browser/org tokens 401. Store-unreachable pairing not reproduced live. Uncommitted. |
| 12 | Auth, sign-up, invitations `src/app/(auth)`, `src/app/verify-email`, `src/app/actions/auth.ts` | Done 2026-10-08 | 2 fixed: Apple/Google sign-in fetched the provider's keys with no timeout (network error → 500) and kept them an hour without refetching for an unknown `kid`, so a key rotation refused valid sign-ins (timeout + 502 `provider_unavailable`, refetch for a new kid at most once a minute, cached keys if the provider is down; unit tests); a rate-limited `/verify-email` said the link "may have been used… you're all set" (now "Too many tries", button kept). Rest checked and sound: bcrypt 12 with 72-byte cap and timing decoy, login limits per account and IP, 2FA challenge (5 tries, single use, TOTP step CAS), reset link signs out every session and still requires 2FA, invitations (accept is conditional, decline deletes), social linking only on the exact verified email and locks out an unverified registrant, `safeNext`. Checked live: bad tokens 400, bad challenge 401, register 409/400, forgot 202, open-redirect `next` dropped, logout revokes the token (401). Uncommitted. |
| 13 | Staff console `src/app/console` | Done 2026-10-08 | No P1. 5 fixed: family page said "renews" for a pass, cancelled subscription or sponsor code (`renewalWord`, as Settings); device limit shown apart from what pairing counts, and browsers counted revoked ones (now "N of M used" via `usedDeviceSlots`, overview too); console errors showed the parent panel ("Go to dashboard") without the nav (own `error.tsx`, `ErrorPanel` takes `homeLabel`/`note`); ticket close raced (CAS, one audit row; unit test); ended staff sessions never removed (maintenance). Checked live: signed out / bogus cookie / parent cookie → 307 /login; site pages and APIs on the console host 404; `/console`, `/%63onsole`, `/console%2F…` on www 404; foreign Origin refused; 5 concurrent closes → 1 change; login 5 wrong → "Too many attempts". Not live: error panel, session cleanup. Uncommitted. |
| 14 | Public site and printing `src/app/(site)`, `src/app/(print)` | Done 2026-10-08 | 6 fixed, all copy: P1 /security promised "no third-party tracking" on a page that loads the Meta Pixel when it's on (now conditional, as /privacy); P1 privacy policy didn't name Firebase Cloud Messaging (push alerts carry children's names), nor the 2FA key and recovery codes, push token, `eg_2fa` cookie, weekly summary or YouTube embed (added; `LEGAL.updated` 2026-10-08); "never sees which websites" on /security, /how-it-works, /for-kids, /protections/web and help left out sites a child asks to unblock (and /for-kids left out location history); how-it-works drew the parent app on iPhone; pricing's discount tiers now from `BATCH_DISCOUNTS` (`discountSummary`, unit test); help profile and plan articles corrected. Store badges and "iPhone coming soon" wording consistent everywhere. Checked live: all 154 sitemap URLs 200 with no error panel; print page owner 3 coupons, other family and non-admin parent 404, signed out → /login. Uncommitted. |

## Open decisions from earlier audits

None open. API suite run 2026-10-08 on a production build (:3100, mail to Mailpit): 260/260 after updating the
sign-in lockout test to the per-address rule decided that day.

## Decided (don't re-raise)

- 2026-10-08 Console: staff sign-in keeps 5 failures per email from anywhere (15 minutes). A lockout by someone who
  knows the email is accepted; reset with scripts/create-staff.ts.
- 2026-10-08 Console: family searches are logged (`family.search`, the query as detail); the plain newest list isn't.
- 2026-10-08 Android: the child app uses on-device APIs, not Google Family Link (child-app-spec D1). The help article
  (slug kept: `android-family-link`) says Family Link isn't needed; "13 and older are asked to agree to supervision"
  is gone from /about, /privacy, the bedtime post, the 13–17 guide and docs, replaced by the active-notification
  fact. The learn article about Family Link itself is general advice and stays.

- 2026-10-08 Dashboard: mobile `GET /dashboard` keeps `deviceCount` (phones and tablets) and adds `browserCount`
  (connected browser extensions, as device slots count them); docs say to show the sum as the web does.
- 2026-10-08 Auth: sign-up keeps answering "An account with this email already exists" (clear for a parent who
  forgot they signed up; rate-limited per IP). Not an enumeration finding to re-raise.
- 2026-10-08 Auth: failed sign-ins count per account and address (10 per 15 minutes, `loginKeys().pair`), per
  account from everywhere (50, `LIMITS.loginAccountAll`) and per address (30). Success clears only that address's
  count; a password reset clears all of them. Docs updated.
- 2026-10-08 Push: the parent app with push is live. Pricing and the Plus feature list say "Push alerts" (no
  "coming soon"); Settings still words it by whether `FCM_SERVICE_ACCOUNT` is set. Press and Facebook notes updated.
- 2026-10-08 Site: "Free for one child" comes from `FREE_CHILDREN` / `childCount` (lib/plans) everywhere it's
  written (landing, pricing, auth, about, how-it-works, protections, guides, learn, help, blog, terms, share images).

- 2026-10-07 Settings: "Share anonymous product analytics" stays as a consent switch; the copy (web and docs) says
  nothing is collected yet.
- 2026-10-07 Settings: only the family admin renames the family, on web (Settings › Account) and `PATCH /family`.
- 2026-10-07 Settings: any parent can export the family's data (they already see the other parents in Settings ›
  Family); the Data row says what's included.
- 2026-10-07 Notifications: on a plan that limits apps, "New app installed" and "App blocked" alerts name an app
  only if the Apps tab shows it (`mayNameApp`); otherwise "An app was installed" plus the upgrade line. Alerts
  created before this keep their names.
- 2026-10-07 Reports: every plan can open a custom range of up to 7 days (`BASIC_RANGE_DAYS`); Family Pro adds 30
  days, ranges up to 366 days and CSV export. A longer range on other plans keeps its last 7 days. The weekly
  summary links to its exact week on every plan.
- 2026-10-07 Reports: on a plan that limits apps, reports and the weekly summary name only apps some child's Apps
  tab shows today, for every range (`familyNameableApps`), as alerts do.
- 2026-10-07 Dependencies: `npm audit fix` updated sharp and source-map-js; deepmerge-ts is pinned to ^8 with an npm
  `overrides` entry (only the Prisma CLI's config loader uses it). `npm audit --omit=dev` is clean.
- 2026-10-07 Organizations: owners invite admins (`OrgInvite`, migration `20261007121519_org_invites`); the person
  becomes an admin only by accepting in Settings › Organizations (verified email needed; declining tells no one).
  Inviting answers the same whether or not the email has an account, and only accounts are emailed. 10 invitations
  an hour per owner, 20 waiting per organization, 14 days to accept. The planned mobile endpoints in
  docs/mobile-organizations.md describe the same flow.
- 2026-10-07 Location: `GET /places` answers on every plan (as `DELETE` does), so places saved before a move to Free
  can be listed and removed in the app; web lists them under the upgrade note with Remove only. `POST`/`PATCH` stay
  403 on Free.
- 2026-10-07 Location: "Add a place" puts a place anywhere (map tap, or a "latitude, longitude" field for keyboard
  use and pasting). No address search (no third-party geocoder) and no browser geolocation (Permissions-Policy keeps
  `geolocation=()`).
