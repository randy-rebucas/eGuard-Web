# Claude Code prompts: one app for parents and children, with organizations

Prompts for building [mobile-organizations.md](mobile-organizations.md) with Claude Code: the server endpoints for
organizations, the app's two modes, parent mode, and the Organizations screens. Run them in order, one per session.
Each is self-contained: paste it as the first message.

These sit alongside [child-app-prompts.md](child-app-prompts.md), which builds child device mode. The two sets share
one app repo and one binary.

## How to use these

- **One prompt per session.** Start a fresh session for each. Each prompt says what to read first.
- **Review and commit between prompts.** Every prompt ends with "Done when". Check it, commit, then move on.
- **Two repositories.** Phase A runs in this repo (`eguard`, the server). Phases B to D run in the app repo
  (`eguard-app`), created by child-app-prompts 1.0.
- **Keep the app repo's docs current.** The app repo can't see this repo. Before each app prompt, copy the latest
  `docs/mobile-organizations.md`, `docs/mobile-api.md` and `docs/child-app-spec.md` into the app repo's `docs/`
  (prompt B.0 sets up a script for it).
- **Stack:** Kotlin + Jetpack Compose on Android, Swift + SwiftUI on iOS, as in child-app-prompts. If you change it,
  change the app repo's `CLAUDE.md`; the prompts still apply.
- **Replace placeholders** in `{braces}` before pasting.
- **Plan mode** (Shift+Tab twice) for prompts marked *(plan first)*.

## Order

| Phase | Prompt | Repo | Depends on |
|---|---|---|---|
| A | [A.1 Organization endpoints](#a1-organization-endpoints-s1-s3-m7) | eguard | — |
| A | [A.2 Sponsor on the subscription](#a2-sponsor-on-the-subscription-s2) | eguard | — |
| A | [A.3 Docs that change](#a3-docs-that-change) | eguard | A.1, A.2 |
| B | [B.0 Two-mode app layout](#b0-two-mode-app-layout) | app | child-app-prompts 1.0 |
| B | [B.1 Android launch and mode choice](#b1-android-launch-and-mode-choice) | app | B.0 |
| B | [B.2 Android parent API client and sign-in](#b2-android-parent-api-client-and-sign-in) | app | B.1 |
| B | [B.3 Android parent screens](#b3-android-parent-screens-one-group-per-session) (one group per session) | app | B.2 |
| B | [B.4 Android Organizations: families](#b4-android-organizations-families) | app | B.2, A.1 |
| B | [B.5 Android Organizations: admins](#b5-android-organizations-admins) | app | B.4 |
| B | [B.6 Android mode switching](#b6-android-mode-switching) | app | B.2, child-app-prompts 2.2 and 2.3 |
| C | [C.1](#c1-ios-launch-mode-choice-and-parent-client) to [C.4](#c4-ios-mode-switching) iOS | app | B equivalents, child-app-prompts 3.1 |
| D | [D.1 Audit and acceptance](#d1-audit-and-acceptance) | both | all |

**How this fits with child-app-prompts:** run its Phase 0 and 1.0 first. Then B.0 and B.1 here, **before** its 2.2
(setup flow), because B.1 builds the mode choice that 2.2 used to stub. After that the two tracks are independent
until B.6, which needs the child setup flow and sync engine (child 2.2, 2.3) to exist.

```
child 0.x ─► child 1.0 ─► B.0 ─► B.1 ─┬─► child 2.2 ─► child 2.3 ─► … child 2.9
                                      └─► B.2 ─► B.3 / B.4 ─► B.5
                                                    └──────────────► B.6 (needs child 2.2, 2.3)
A.1, A.2, A.3 any time before B.4
```

---

## Phase A: server (this repo)

Every prompt in this phase runs in `eguard` and follows its `AGENTS.md` (Next.js 16: read
`node_modules/next/dist/docs/` before writing framework code).

### A.1 Organization endpoints (S1, S3, M7)

```
Read docs/mobile-organizations.md sections 6, 7 and 9, docs/organizations.md sections 1, 6, 8 and 10, then
src/lib/organizations.ts, src/lib/mobile-api.ts and two existing routes for conventions
(src/app/api/mobile/v1/family/members/route.ts and src/app/api/mobile/v1/family/members/[id]/route.ts).

Add the parent API routes in docs/mobile-organizations.md section 7.1 under src/app/api/mobile/v1/organizations/.
Each route is thin: authed() + body() from lib/mobile-api, then the existing service function. Don't move checks
into the routes; lib/organizations already does access, limits and rate limits.

- Responses use the shapes in section 7.2 exactly, with `kind` (enum) and `kindLabel` (from ORG_KINDS) on every
  organization object (decision M7). Write small mapping functions in the routes or a lib helper; don't change what
  the web pages receive.
- S3: make joinOrganization return { id, name, kind, joinedAt } (keep `name` so the web action still works) and
  return the Joined shape from POST /organizations/join.
- DELETE /organizations/{id}/admins/{userId} with your own id is "stop managing".
- Do NOT add routes for buying codes, redeeming codes, API keys or the CSV. Section 8 explains why.

Add tests/api/mobile-organizations.test.ts following the existing suites' helpers. Cover:
- the family flow: preview, join, join again (alreadyJoined, no second membership), leave; a PARENT gets 403 on
  join and leave; a wrong code gets 400; the per-user rate limit gets 429 (skip if the IP is allowlisted in tests);
- the admin flow: create (403 email_unverified for an unverified parent), view, replace join code (old code then
  fails), cancel an available code, cancelling a redeemed code is 409, add admin, make owner, remove admin, the last
  owner can't be removed (409), a non-admin gets 404 on every /organizations/{id} route;
- privacy: walk every organization response body and assert it contains no family id, family name, child or device
  id from the test family. This test matters more than the others.

Then document the endpoints in docs/mobile-api.md: a new "4.16 Organizations" section in the same style as the
others, a row in the section 3 screen map ("Settings › Organizations"), and a contents entry.

Done when: `npm run typecheck`, `npm test` and `npm run test:api` pass, the web organization pages still work, and
no existing suite changed behavior. If a service function's behavior blocks a route, stop and tell me rather than
changing the rule.
```

### A.2 Sponsor on the subscription (S2)

```
Read docs/mobile-organizations.md sections 6.3 and 7.3 (S2), src/app/api/mobile/v1/subscription/route.ts and
sponsorOf() in src/lib/organizations.ts.

Add `sponsor` to the `store` object of GET /api/mobile/v1/subscription: the organization's name when store.name is
VOUCHER, otherwise null. Keep every other field unchanged.

Extend the existing subscription API test (or the A.1 suite) with a redeemed code: store.name is VOUCHER and
store.sponsor is the organization's name. Update docs/mobile-api.md section 4.14 where it describes `store`.

Done when: typecheck, unit and API tests pass.
```

### A.3 Docs that change

```
Read docs/mobile-organizations.md sections 4, 7.3 (S5) and 8, then docs/child-app-spec.md section 5 ("Removal"),
docs/app-listing.md (the reviewer notes and privacy sections) and docs/organizations.md section 13.

Bring the other docs in line with docs/mobile-organizations.md. Edit only text:
1. child-app-spec.md section 5 "Removal": the removed screen offers "Set up eGuard again" (back to "Who's using
   this device?") and "Close", instead of only telling the child to uninstall. Link to mobile-organizations.md
   section 4.
2. child-app-spec.md section 4 screen 1: link the mode choice to mobile-organizations.md section 3, and mention
   "Set up this device for a child" from parent mode as a second way in.
3. app-listing.md: add the organizations sentence from mobile-organizations.md section 8 to the reviewer notes,
   and the "no analytics SDKs in the whole app" rule where the listing talks about SDKs.
4. organizations.md section 13: the mobile bullet now says joining, leaving and managing organizations are in the
   app (link the spec); redeeming and buying stay web-only.
5. Mark S1, S2, S3 and S5 done in mobile-organizations.md section 7.3 (keep the row, add "Done:" to the fix), if
   A.1 and A.2 are merged.

Done when: every link resolves, and `git diff --stat` shows only docs/ files.
```

---

## Phase B: Android

Every prompt in this phase runs in the app repo and assumes the previous ones are committed.

### B.0 Two-mode app layout

```
Read docs/mobile-organizations.md sections 1, 3 and 5, and the repo's CLAUDE.md.

This app has two modes in one binary: parent mode (the parent API, docs/mobile-api.md) and child device mode (the
device API, docs/child-app-spec.md). Restructure the repo so each mode only pulls in what it needs, as section 5
describes, without building any features:

Android: Gradle modules :core-ui (theme, components, strings), :core-net (OkHttp client, JSON, error mapping,
retry), :parent (empty for now), :child (move the existing device API client and sync code here, from :core if
that's where it is), and :app (launch routing). :parent and :child must not depend on each other; add a Gradle
check or a test that fails if they do.

iOS: Swift packages CoreUI, CoreNet, ParentKit, ChildKit (rename EGuardCore to ChildKit if it exists, keeping its
tests). The DeviceActivityMonitor and ShieldConfiguration extensions depend on ChildKit and Core* only.

Also:
- Update CLAUDE.md: the two modes, the module rule, that docs/mobile-organizations.md is the spec for modes and
  organizations, and that the "no analytics, ads or tracking SDKs" rule now covers the whole app.
- Add scripts/sync-docs.sh (and .ps1) that copies docs/mobile-organizations.md, docs/mobile-api.md and
  docs/child-app-spec.md from a path given as an argument (the eguard repo) into docs/.

Done when: both platforms build and every existing test passes, and the dependency check fails if :parent imports
:child.
```

### B.1 Android launch and mode choice

```
Read CLAUDE.md, docs/mobile-organizations.md sections 3 and 4, and docs/child-app-spec.md section 4 (screens 1–2).

In :app, build launch routing and the first-launch choice:
- A ModeStore in EncryptedSharedPreferences with UNSET, PARENT, CHILD.
- Launch routing exactly as the diagram in section 3: PARENT without a parent token → sign in; CHILD without a
  device token → wipe child state, set UNSET; otherwise the mode's home. For now the parent home and sign-in are
  placeholders (B.2), and the child path goes to the existing child setup screens or a placeholder.
- "Who's using this device?" with the two choices in section 3. Choosing doesn't set the mode; only a successful
  sign-in or pairing does. Back returns to the choice.
- Rule 1 from section 3, enforced in one place: a function that sets the mode and deletes the other mode's
  credential and state first. Every later switch goes through it.

Done when: unit tests cover every routing branch and the "never both credentials" rule, and Compose UI tests cover
choosing each mode and backing out.
```

### B.2 Android parent API client and sign-in

```
Read CLAUDE.md and docs/mobile-api.md sections 1, 2, 4.1 to 4.3 and 5.1.

In :parent, build the parent API client and the sign-in screens:
- Kotlin data classes for the shapes in docs/mobile-api.md sections 1 and 2; errors mapped from { error, code } to a
  sealed type, keeping `error` to show to the parent as-is.
- Headers: Authorization Bearer, X-eGuard-Client: android, and a readable User-Agent (section 1 "Headers").
- Parent token in EncryptedSharedPreferences, never logged. Any 401 → clear it and go to sign-in.
- GET /app-info on launch with the force-update check, then Welcome, Sign in, Create account (guardian checkbox),
  Forgot password, and Continue with Google if /app-info enables it.
- Push: register the FCM token with POST /me/push-tokens after sign-in; sign-out calls
  POST /auth/logout?pushToken=… and then the mode function from B.1 (mode becomes UNSET).
- The email-verification banner from section 4.2, used later by pairing and creating organizations.

Done when: unit tests cover error mapping and 401 handling, and a parent can register, sign in and sign out against
a local server from an emulator.
```

### B.3 Android parent screens (one group per session)

Parent mode is large. Run this once per group, in this order, as separate sessions: **(a)** Dashboard and
Configuration Health, **(b)** Children, Add Child and onboarding (screens 4–9), **(c)** Protections and batches,
**(d)** Screen Time and Apps, **(e)** Location, **(f)** Alerts, **(g)** Devices, browsers and checks,
**(h)** Settings, Family, Subscription and Help.

```
Read CLAUDE.md, docs/mobile-api.md sections 1–3 and the endpoint sections for: {group, e.g. "Alerts (4.11)"}.

(plan first) Build the {group} screens in :parent from the screen map in docs/mobile-api.md section 3, using the
API client from B.2. Rules from the API doc that can't bend:
- never show a setting as saved until its batch item is VERIFIED;
- hide admin-only actions for role PARENT, and the upgrade button unless billingAvailable, upgrade and canManage
  all hold; never link to the website for payment;
- use the pre-formatted …Label fields, group lists by day.key, map Lucide icon names to Material icons;
- poll batches and checks as section 1 "Polling" says.

Done when: Compose previews for each screen's states (loading, empty, error, normal), UI tests for the main path,
and a run against a local server with seeded data.
```

### B.4 Android Organizations: families

```
Read CLAUDE.md and docs/mobile-organizations.md sections 6.1 to 6.3, 6.5, 7 and 9, and the Organizations section
of docs/mobile-api.md.

In :parent, add Settings › Organizations (between Family and Subscription) with the family part:
- the joined list, its empty state, and the PARENT (not family admin) variant, from section 6.2;
- Join with a code: field with XXXX-XXXX display, auto-uppercase, strip spaces and dashes, accept paste; preview;
  the confirm sheet with the exact "will see / never sees" text; alreadyJoined; every error in the 6.2 table;
- Leave with its confirm text;
- the limit state at 5;
- Settings › Subscription: "Sponsored plan · {store.sponsor}" when store.name is VOUCHER (just "Sponsored plan" if
  sponsor is null).

There must be no field, button or text for redeeming or buying sponsor codes, and no link to the website (section
8). Add a test that greps the :parent strings for "redeem" and "sponsor code" and fails if a redeem prompt appears.

Done when: unit tests for code normalization and error mapping, Compose previews for every state, UI tests for join
(new and already joined) and leave, and a run against a local server where joining changes the organization's count
on the web page.
```

### B.5 Android Organizations: admins

```
Read CLAUDE.md and docs/mobile-organizations.md sections 6.1, 6.4, 6.5, 8 and 9.

In :parent, add the organization admin part:
- "Organizations you manage" list and Create an organization (name, kind; 403 email_unverified shows the verify
  banner from B.2; the limit of 10);
- the organization screen: join code (copy, share sheet with the exact share text, replace with confirm), families
  count, code totals, batches, admins;
- the batch screen for PAID, PENDING and VOIDED, with code status chips, copy, share one, share all available, and
  cancel with confirm;
- admins: add by email, remove, make owner (owners only), stop managing (anyone, own row);
- a 404 on any organization call returns to the list and refreshes it.

Never show a family name, child or device on these screens; there's nothing in the API to show, and don't add it
from elsewhere. No buy button, API keys or CSV, and no text pointing to them.

Done when: Compose previews for every state (no batches, pending, paid, refunded; owner vs admin), UI tests for
replace code, cancel code and add admin, and a run against a local server with a paid batch (use the fake PayMongo
the server tests use, or a batch created in the web app).
```

### B.6 Android mode switching

```
Read CLAUDE.md, docs/mobile-organizations.md section 4, and docs/child-app-spec.md sections 4 and 5 ("Removal").

Build the two cross-mode flows, both through the mode function from B.1:

1. Parent → child: Settings › "Set up this device for a child", hidden with no children. Choose the child, show the
   confirm text from section 4, create a pairing code (parent API), ask for the device name, pair (device API),
   then sign out (POST /auth/logout?pushToken=…), delete the parent token, set CHILD, and continue the child setup
   flow at the permissions step. On any pairing error, stay signed in and show the error. If sign-out fails
   offline, delete the token locally anyway.
2. Child → parent: change the child removal screen to the text and two buttons in section 4 ("Set up eGuard
   again" → UNSET → "Who's using this device?"; "Close"), after the existing 401 cleanup.

Also make sure no parent screen is reachable in CHILD mode: deep links, notification taps and the back stack all
route through launch routing.

Done when: unit tests cover both flows' state changes (including pairing failure and offline sign-out), and on an
emulator: a signed-in parent turns the phone into a child device, the device appears on the web, a parent removes
it from the web, and the phone returns to "Who's using this device?" with no parent or child data left.
```

---

## Phase C: iOS

Run each after its Android equivalent is committed, so the behavior is settled. Copy the Android tests' cases.

### C.1 iOS launch, mode choice and parent client

```
Read CLAUDE.md, docs/mobile-organizations.md sections 3–5, and docs/mobile-api.md sections 1, 2, 4.1–4.3 and 5.1.

Build the iOS equivalents of B.1 and B.2: ModeStore in the Keychain (not in the App Group: the extensions never
need the parent token), launch routing, "Who's using this device?", the single mode-switch function, and in
ParentKit the parent API client, sign-in screens, Sign in with Apple (forward fullName on first authorization),
X-eGuard-Client: ios, APNs registration with /me/push-tokens, and sign-out.

Done when: unit tests match the Android ones for routing, the credential rule and error mapping, and a parent can
register, sign in and sign out on a simulator against a local server.
```

### C.2 iOS parent screens

```
Same as B.3, for iOS in ParentKit with SwiftUI. Run once per group in the same order: {group}. Map Lucide icon
names to SF Symbols. VoiceOver labels and Dynamic Type on every screen.

Done when: SwiftUI previews for each state and the main path works against a local server.
```

### C.3 iOS Organizations

```
Read CLAUDE.md and docs/mobile-organizations.md sections 6–9.

Build B.4 and B.5 for iOS in ParentKit: the family part, the sponsored plan on Subscription, and the admin part.
Same texts, same rules: no redeem or buy anywhere, no family data on organization screens, a 404 returns to the
list. Use the system share sheet (ShareLink) for codes.

Done when: SwiftUI previews for every state, unit tests for code normalization and error mapping, and joining and
managing work against a local server.
```

### C.4 iOS mode switching

```
Read CLAUDE.md, docs/mobile-organizations.md section 4, docs/child-app-spec.md sections 4 and 5, and
docs/ios-spike-results.md if present.

Build B.6 for iOS. Parent → child continues at the iOS child setup's FamilyControls authorization step. Child →
parent runs after the existing 401 cleanup (ManagedSettingsStore cleared, monitoring stopped, App Group state
deleted), then shows the removed screen with "Set up eGuard again".

Done when: the same checks as B.6 pass on a real iPhone or iPad (FamilyControls doesn't work in the simulator).
```

---

## Phase D: acceptance

### D.1 Audit and acceptance

```
Read docs/mobile-organizations.md sections 8–10, and the audits from child-app-prompts (docs/android-audit.md,
docs/ios-audit.md) if present.

1. Dependencies: list every dependency in the release builds of both platforms and confirm there are no analytics,
   ads or tracking SDKs anywhere in the app (section 5).
2. Store: confirm the app has no redeem or buy path for sponsor codes and no text pointing to the web for payment
   (search strings and screens). Confirm the reviewer notes in app-listing.md mention organizations.
3. Walk every acceptance item in docs/mobile-organizations.md section 10 on one Android and one iOS device against
   a staging server. Record pass, fail or not applicable (with why) in docs/acceptance-organizations-{date}.md,
   with evidence. Don't tick an item from reading code; each needs a run.

Then list, in priority order, what must be fixed before a store submission, and which decisions in section 11 are
still open.
```

---

## Writing your own prompts for this feature

The prompts that work best here have:

1. **What to read first**: spec sections by number, and the files that matter.
2. **One outcome**, stated as what the parent, admin or child sees.
3. **The rules that can't bend**: organizations see counts only; no redeeming or buying in the app and no pointing
   to the web for it; never both credentials at once; the child can't switch modes; no analytics SDKs.
4. **"Done when"** in terms you can check: tests pass, a device does X, the web shows Y.
5. **What to do if the spec is wrong**: stop and propose the spec change, don't work around it.
