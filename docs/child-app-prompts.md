# Claude Code prompts: child device app

Prompts for building the child device app described in [child-app-spec.md](child-app-spec.md) with Claude Code.
Run them in order, one per session. Each is self-contained: paste it as the first message.

## How to use these

- **One prompt per session.** Start a fresh session for each, so earlier work doesn't crowd the context. Each
  prompt says what to read first.
- **Review and commit between prompts.** Every prompt ends with "Done when". Check it yourself, commit, then move on.
- **Two repositories.** Phase 0 runs in this repo (`eguard`, the server). Phases 1 to 4 run in the app repo.
  Prompt 1.0 creates it and copies the spec across.
- **Stack assumption:** native apps, Kotlin + Jetpack Compose on Android and Swift + SwiftUI on iOS. The Screen Time
  extensions on iOS must be Swift, and the Android enforcement pieces (VPN, device admin, foreground service) are
  easiest natively. If you choose a cross-platform framework instead, change the stack lines in prompt 1.0 and the
  app repo's `CLAUDE.md`. The rest still applies.
- **Replace placeholders** in `{braces}` before pasting.
- **Plan mode** (Shift+Tab twice) is worth using for the larger prompts marked *(plan first)*: Claude proposes a
  plan, you approve, then it builds.

## Order

| Phase | Prompt | Repo | Depends on |
|---|---|---|---|
| 0 | [0.1 Device API test suite](#01-device-api-test-suite) | eguard | — |
| 0 | [0.2 Define the undefined values](#02-define-the-undefined-values) (G2, G5) | eguard | 0.1 |
| 0 | [0.3 Sync additions](#03-sync-additions-g2-g10) (G2, G10) | eguard | 0.1 |
| 0 | [0.4 Event idempotency](#04-event-idempotency-g8) (G8) | eguard | 0.1 |
| 0 | [0.5 App identifiers](#05-app-identifiers-g4) (G4) | eguard | 0.1 |
| 0 | [0.6 Device self-service](#06-device-rename-and-unpair-g6) (G6) | eguard | 0.1 |
| 0 | [0.7 Wake the device](#07-wake-the-device-g1) (G1) | eguard | 0.3 |
| 1 | [1.0 Create the app repo](#10-create-the-app-repo) | app | — |
| 1 | [1.1 iOS Screen Time test app](#11-ios-screen-time-test-app-g3-d4) (G3, D4) | app | 1.0 |
| 2 | [2.1](#21-android-api-client-and-token-store) to [2.9](#29-android-privacy-and-store-audit) Android | app | 1.0, phase 0 |
| 3 | [3.1](#31-ios-api-client-token-store-and-app-group) to [3.6](#36-ios-privacy-and-store-audit) iOS | app | 1.1 results |
| 4 | [4.1 Acceptance pass](#41-acceptance-pass) | both | all |

Phase 0 and prompt 1.1 can run in parallel: they don't touch each other.

---

## Phase 0: server gaps (this repo)

Every prompt in this phase runs in `eguard` and follows its `AGENTS.md` (Next.js 16: read
`node_modules/next/dist/docs/` before writing framework code).

### 0.1 Device API test suite

```
Read docs/child-app-spec.md (sections 8, 9 and 14) and the README's "Device API" and "Testing" sections, then the
routes in src/app/api/device/v1/ and src/lib/engine.ts.

There's no API test suite for the device API yet. Add tests/api/device.test.ts, following the style and helpers of
the existing suites in tests/api/ (look at how they register a family, get a session and clean up).

Cover:
- pair: valid code → 201 { deviceId, token, childName }; expired, used and replaced codes → 400; a BROWSER code →
  400 with the extension message; plan device limit → 409, and the code works again after a device is removed;
  rate limit → 429 (skip if the IP is allowlisted).
- 401 on every endpoint with no token and with a wrong token.
- sync: returns policy, requests, apps, fullReportRequested, nextSyncSeconds, timezone, features.locationSharing
  (false on Free) and minAppVersion; re-sends an APPLY request on every sync until the device reports that
  protection (then it's gone), so a lost response doesn't strand it; never returns GUIDED requests.
- report: a matching config verifies the request and updates policy; a mismatch fails a DELIVERED request; a config
  with an extra field or a string instead of a number does NOT verify (this is the exact-match rule in the spec);
  turning a passing protection off raises "Protection setting changed" (or "Location sharing turned off").
- full report clears the check request.
- usage: idempotent per day (the latest total wins); hourly must be 24 values.
- location: dropped while sharing is off and on the Free plan; stored otherwise.
- events: each type raises its alert once inside its throttle window; APP_REQUESTED for an allowed app returns its
  approval and raises nothing; a repeated eventId returns `duplicate: true` and raises nothing, a missing one works
  as before.

Use the parent mobile API to set up state (children, pairing codes, protection changes) rather than writing to the
database, unless an existing suite already does that for the same thing.

Done when: `npm run test:api` passes with the new suite against a dev server started as the README describes, and
no existing suite changed behavior. Don't change any route to make a test pass; if you find a bug, stop and tell me.
```

### 0.2 Define the undefined values

> **Partly done (2026-10-02):** step 1 is in (`bedtimeActive` / `isSchoolNight` in `protections.ts`, tested in
> `device-rules.test.ts`). Steps 2 and 3 (the AppApproval meanings, G5) are still open.

```
Read docs/child-app-spec.md section 6 (the "Time zone and days" rule), section 7 and section 13 (G2, G5).

Three values have no written meaning on the server: BEDTIME days "SCHOOL_NIGHTS", and AppApproval "ALWAYS_ALLOWED"
and "FILTERED". Make them explicit, without changing behavior anywhere yet:

1. In src/lib/protections.ts, export a function that says whether a bedtime applies on a given local night, with
   SCHOOL_NIGHTS = the nights starting Sunday to Thursday. Unit-test it (src/lib/*.test.ts style), including a
   window that crosses midnight.
2. In prisma/schema.prisma, add a /// comment on each AppApproval value with its meaning:
   ALLOWED usable within limits; ALWAYS_ALLOWED usable during bedtime and after the daily limit;
   BLOCKED never usable; PENDING blocked until a parent decides.
   For FILTERED, grep every use first. If nothing gives it a meaning, ask me before writing one; don't invent it.
3. Update the parent-facing labels only if one is now misleading, and the spec's section 7 table to match.

Done when: `npm test` and `npm run typecheck` pass, no migration is generated (comments only), and you've shown me
what FILTERED means or asked.
```

### 0.3 Sync additions (G2, G10)

> **Done (2026-10-02)**, except the API tests, which wait for 0.1: `timezone`, `minAppVersion` from
> `CHILD_MIN_APP_VERSION` (`1.2.0` or `android:1.2.0,ios:1.1.0`, null when unset; `src/lib/child-app.ts`), plus
> `features.locationSharing`. Docs and G2/G10 in the spec are updated.

```
Read docs/child-app-spec.md sections 8 and 13 (G2, G10) and src/app/api/device/v1/sync/route.ts.

Add two fields to the POST /api/device/v1/sync response, keeping every existing field unchanged:
- `timezone`: the family's IANA time zone (Family.timezone).
- `minAppVersion`: the oldest child-app version the server supports, from a new env var
  CHILD_MIN_APP_VERSION per platform. Choose the shape (one var with "android:1.0.0,ios:1.0.0", or two vars) to
  match how MOBILE_MIN_APP_VERSION is handled, and null when unset.

Add the variable to .env.example with a comment and to the README's environment table. Document both fields in the
README's Device API table and in docs/child-app-spec.md section 8, and mark G2 and G10 as done in section 13
(keep the row, add "Done:" to the fix).

Extend tests/api/device.test.ts for both fields.

Done when: typecheck, unit and API tests pass.
```

### 0.4 Event idempotency (G8)

> **Done differently (2026-10-02):** no new table. A seen `eventId` is recorded in the existing `RateLimit` table
> (key `deviceevent:<device>:<eventId>`, 7-day window), which the maintenance job already purges, and is released if
> handling the event fails so the retry gets through. A repeat returns `{ ok: true, duplicate: true }`. Only the API
> tests remain, with 0.1. Use this prompt only if you want a dedicated table instead.

```
Read docs/child-app-spec.md sections 9 ("Events") and 13 (G8), and src/app/api/device/v1/events/route.ts.

Accept an optional `eventId` (a client-generated UUID) on every event type. When the same device sends the same
eventId again within 7 days, return the same success response and do nothing else. Store what's needed with a
Prisma migration; keep it small (device, eventId, createdAt, unique on device + eventId) and have the maintenance job
in src/lib/maintenance.ts delete rows older than 7 days.

Events without eventId keep working exactly as today.

Done when: `npx prisma migrate dev` creates one migration, API tests cover a repeated eventId and a missing one,
and the spec and README describe the field. Mark G8 done in the spec.
```

### 0.5 App identifiers (G4)

```
Read docs/child-app-spec.md sections 7 and 13 (G4). Apps are keyed only by display name today (ChildApp is unique
on childId + name). Phones need a stable ID: the Android package name, or an iOS bundle ID where one exists.

(plan first) Propose a design before changing anything:
- an optional `appId` on /events, /usage apps[] and the /sync apps[] list;
- how ChildApp and AppUsageDaily store it, and how an existing name-only row is matched and upgraded when the same
  app later reports with an appId;
- what happens when two apps share a name;
- which parent screens (web and mobile API) change, if any.

After I approve: implement it with one migration, keep name-only clients working, add API tests, and update the
spec, README, docs/mobile-api-child.md and docs/mobile-api-parent.md where the shapes change. Mark G4 done in the spec.
```

### 0.6 Device rename and unpair (G6)

```
Read docs/child-app-spec.md sections 4, 5 ("Removal") and 13 (G6), and src/app/api/device/v1/pair/route.ts for
conventions.

Add, with device-token auth (src/lib/device-auth.ts):
- PATCH /api/device/v1/me { name }: rename, 1–60 chars, trimmed. Adds a history entry the parent can see.
- DELETE /api/device/v1/me: the device leaves the family. This must not let a child remove protection by themselves.
  Propose the approval mechanism to me first (for example: the device shows a one-time code the parent confirms in
  their app, or the parent must have started removal in their app). Don't build it until I choose.

After removal the token must stop working (401 everywhere) and the family gets an alert saying the device was
removed, and by whom.

Done when: routes, API tests and docs (README Device API table, spec section 5) are updated, and G6 is marked done.
```

### 0.7 Wake the device (G1)

```
Read docs/child-app-spec.md sections 8 ("Background execution") and 13 (G1), README "Not built yet" (push isn't
wired up), and src/lib/engine.ts (deviceSync, startCheckRun, CHECK_TIMEOUT_MS).

(plan first) Design silent push to child devices:
- the device sends its FCM token (Android) or APNs token (iOS) on /sync; store it per device;
- a silent push goes out when a parent change creates requests for a device and when a check run starts;
- the provider layer (FCM HTTP v1, APNs token auth) is shared with the future parent-app push, lives in src/lib, and
  is a no-op when its env vars are empty, like the other optional integrations;
- the check-run timeout: 12 s is too short for iOS even with push. Propose per-platform timeouts and what the parent
  UI shows while waiting.

After I approve: build it with tests that don't call real providers (inject a fake sender), add the env vars to
.env.example and the README, and update the spec. Mark G1 done.
```

---

## Phase 1: app repo and the iOS risk

### 1.0 Create the app repo

Run this in an empty folder, for example `C:\Users\corew\eguard-app`. Copy `docs/child-app-spec.md` from this repo
into it first, as `docs/child-app-spec.md`.

```
This is a new repo for the eGuard phone app. docs/child-app-spec.md is the spec for its child device mode; read it
fully first. The server lives in a separate repo; its device API is described in the spec's section 8 and nowhere
else you can see, so treat the spec as the contract.

Set up the repo:
- android/: Kotlin, Jetpack Compose, min SDK {29}, target the latest stable SDK, one app module plus a :core module
  for the API client and sync logic so it can be unit-tested without Android. Gradle version catalog.
- ios/: an Xcode project with the SwiftUI app target, a DeviceActivityMonitor extension target and a
  ShieldConfiguration extension target, sharing an App Group ({group.app.eguard}). Bundle ID {app.eguard.ios},
  deployment target iOS 16. Leave signing team empty.
- A CLAUDE.md at the root with: the stack; that the spec is the source of truth and must be updated in the same
  change when behavior changes; the principles from spec section 2, word for word; how to build and test each
  platform from the command line; and "no analytics, ads or tracking SDKs, ever, in child device mode".
- .gitignore for both platforms, a README with build steps, and an .editorconfig.
- An app-level config for the API base URL: https://www.eguard.family in release, and a local override for debug
  builds (a Gradle property / an xcconfig) so a phone can talk to a dev server on the LAN.

Build nothing else yet: an empty screen per platform that builds.

Done when: `./gradlew assembleDebug test` passes in android/ and `xcodebuild -scheme {eGuard} build` passes in ios/
(or tell me exactly what needs a Mac or signing that you couldn't do), and git has one commit.
```

### 1.1 iOS Screen Time test app (G3, D4)

Needs a Mac, two iPhones or iPads, and an Apple ID family with a child account. Do this before building the iOS
app for real: the answers change what iOS can promise.

```
Read docs/child-app-spec.md sections 3, 6, 7, 9 and 13, focusing on G3 and decision D4.

Before we build the iOS child app, we need facts. Build a throwaway spike in ios/Spike/ (a separate target, deleted
later) that answers these questions on a real device signed in with a child Apple ID in a Family Sharing group:

1. After AuthorizationCenter.requestAuthorization(for: .child), which settings can the app READ back:
   a) ManagedSettings values the app itself set (shield, denyAppRemoval, media ratings, app store rating)?
   b) settings a parent set by hand in Settings › Screen Time (Limit Adult Websites, Installing Apps: Don't Allow)?
2. Can any usage number leave the device: total minutes, per-app minutes, or only DeviceActivityMonitor threshold
   events (eventDidReachThreshold) that the monitor extension can write to the App Group and the app can send?
   Confirm whether a DeviceActivityReport extension can write anything the main app can read.
3. Given apps chosen with FamilyActivityPicker on the PARENT's device, is there any way to use those tokens on the
   CHILD's device? If not, what can the child device do with its own picker?
4. How often does BGAppRefreshTask actually run on a device left alone for a day? Log timestamps to the App Group.
5. Does denyAppRemoval survive a reboot and an app update?

Don't guess from documentation where a device test is possible; say which answers came from docs and which from
the device. Write the results to docs/ios-spike-results.md: each question, the answer, the evidence (logs or
screenshots), and what it means for the spec's iOS column in sections 3 and 6.

Then propose exact changes to docs/child-app-spec.md (capability matrix, section 9 iOS usage, G3, D4) as a diff for
me to approve. Don't apply them yet.
```

---

## Phase 2: Android

Every Android prompt runs in the app repo and assumes the previous ones are committed.

### 2.1 Android API client and token store

```
Read CLAUDE.md and docs/child-app-spec.md sections 4 ("Pair request"), 8 and 10.

In the :core module, build the device API client:
- One function per endpoint: pair, sync, report, usage, location, events. Kotlin data classes matching the request
  and response shapes in the spec exactly, including optional fields. kotlinx.serialization; OkHttp.
- ProtectionConfig as a sealed class with one subclass per key, serialized with EXACTLY the spec's fields and
  types and no `key` field inside config. Add a unit test per key that serializes and compares against a JSON
  string, because the server verifies by exact equality.
- Errors as a sealed result: Unauthorized (401), BadRequest(message), Conflict(message), RateLimited, Server, Network.
- Headers: Authorization: Bearer, and appVersion in bodies where the spec lists it.

In the app module:
- TokenStore backed by EncryptedSharedPreferences (Keystore). The token is never logged; add a test or lint check
  that OkHttp logging redacts the Authorization header.
- An offline queue on disk (Room or a file) for report, usage, events and location with the retention rules in
  spec section 8 ("Retries and offline"), and exponential backoff with jitter from 30 s to 15 min.

Done when: unit tests cover serialization, error mapping, the queue's retention rules and backoff, and pass.
```

### 2.2 Android setup flow

```
Read CLAUDE.md and docs/child-app-spec.md sections 1, 4 and 5 (tone), and app-listing.md sections 9–10 if present.

Build the first-launch flow in Compose, screens 1 to 7 of spec section 4:
- mode choice (parent mode is a placeholder screen for now), the "What eGuard does here" disclosure, code entry
  (8 chars, alphabet A–Z without I and O plus 2–9, auto-uppercase, strips spaces/dashes, accepts paste), device
  name prefilled from Settings.Global.DEVICE_NAME or the model, then pair.
- the error messages exactly as in the spec's pair response table; the typed code survives a network retry.
- after pairing, one permission screen per permission in the Android table, each with its disclosure BEFORE the
  system prompt, and "Skip for now". Background location on its own screen after foreground location.
- the "Finishing setup" screen runs the first sync and full report (use a stub SyncEngine interface; 2.3 builds it)
  and the "You're all set" screen.

Mode choice is one-way: once paired, launch goes straight to the child home screen (a placeholder for 2.5).

Done when: Compose UI tests cover code normalization and each pair error, it runs on an emulator against a local
server, and pairing creates the device on the parent's Devices page. Include screenshots of each screen in the PR
description.
```

### 2.3 Android sync engine and foreground service

```
Read CLAUDE.md and docs/child-app-spec.md sections 2, 6 ("Reporting rule" and "Additional rules") and 8.

Build the sync engine in :core, pure Kotlin and unit-tested, with Android specifics behind interfaces:
- the cycle in spec section 8 exactly: sync → save policy and apps → apply requests in order → read back from the
  OS → report changed protections → full report when fullReportRequested → usage → schedule the next run from
  nextSyncSeconds.
- reconcile against policy, not just requests.
- an Enforcer interface per protection key with apply(config) and readBack(): config?. readBack must query the OS,
  never return what apply was given. Provide fakes for tests; the real ones come in 2.4.
- 401 anywhere → the removal path in spec section 5 ("Removal"): stop enforcing, clear token, policy and queue,
  show the removed screen, release device admin.
- if the sync response has minAppVersion above ours, show an update screen (if the field is absent, ignore it).

In the app module: a foreground service with the persistent "eGuard is active" notification (declare the
Android 14 foreground service type and explain the choice in a comment), a WorkManager backup job every 15 minutes,
restart on boot, and a request for the battery-optimization exemption from the setup flow.

Done when: unit tests cover the whole cycle with fakes, including a mismatch after apply (must report the real
value), a full report, a 401, and offline queueing. On an emulator, a parent change verifies within one cycle.
```

### 2.4 Android enforcers

This is the largest piece. Run it once per group, in this order, as separate sessions:
**(a)** Screen Time and Bedtime, **(b)** Uninstall Protection and Location, **(c)** App Restrictions, App Approval
and Downloads, **(d)** Web, **(e)** Notifications and Content.

```
Read CLAUDE.md and docs/child-app-spec.md sections 5 ("Block screens"), 6 and 10, and the decisions D1, D2 and D5
in section 15.

(plan first) Implement the Enforcer for: {group, e.g. SCREEN_TIME and BEDTIME}.

For each key:
- apply(config) using the Android mechanism in the spec's table;
- readBack() by querying the OS or the component actually doing the enforcement, per the reporting rule;
- detection of the child undoing it (permission revoked, admin disabled, VPN revoked) that triggers a report;
- the block screen(s) the key causes, with the spec's titles and bodies, and the always-allowed apps from D5;
- local warnings (10 minutes before limit or bedtime) where relevant.

Rules: count usage with monotonic time where the spec says so; bedtime windows can cross midnight; weekend is Sat
and Sun; SCHOOL_NIGHTS is Sunday to Thursday nights; use `timezone` from sync if present.
{For WEB only: the VPN filters DNS on the device. No traffic may go to any server. The blocklist source is
[describe it]; report blockedSites as the count actually loaded.}

Done when: unit tests for the logic (time windows, limits, read-back mapping), an instrumented test or a written
manual test script for the OS parts, and the acceptance items in spec section 14 for these keys pass on a device.
If the platform can't do something the spec says it can, stop and tell me, and propose the capability matrix
change instead of working around it.
```

### 2.5 Android child home screen

```
Read CLAUDE.md and docs/child-app-spec.md sections 2 and 5 ("Home", "Warnings").

Build the child's home screen from the saved sync state only, so it works offline and opens in under a second:
header, today's screen time vs today's limit, bedtime, "What's on" (one plain line per protection that is on,
hiding unsupported ones; reuse the wording of describeConfig from the spec's section 6 table), Ask for an app,
and last-synced time with the offline message after a day.

Write for a 7-year-old: short, warm, no jargon. Light and dark themes, TalkBack labels, dynamic text up to 200%.

Done when: Compose previews for normal, limit reached, bedtime, offline and nothing-configured states, UI tests
for the offline message, and an accessibility scan with no errors.
```

### 2.6 Android apps: approval, blocking, per-app limits

```
Read CLAUDE.md and docs/child-app-spec.md section 7 and section 9 ("Events").

Using the apps list from sync and the usage data from 2.4:
- apply each approval state as in the section 7 table, and per-app dailyLimitMinutes;
- detect newly installed apps (PACKAGE_ADDED) and handle them per App Approval, sending APP_INSTALLED or
  APP_REQUESTED;
- the Ask for an app flow from home and from block screens, sending APP_REQUESTED and showing "Sent to your
  parent"; limit "Ask again" on a blocked app to once a day on the device too;
- APP_BLOCKED when a blocked app is opened;
- a local notification when an approval or decline arrives on a later sync;
- send eventId and appId if the server supports them (prompts 0.4 and 0.5), otherwise leave them out.

Done when: unit tests cover every approval state and the new-app path with App Approval on and off, and a manual
run shows the parent's "App approval requested" alert and the app unblocking after approval.
```

### 2.7 Android usage, location and events

```
Read CLAUDE.md and docs/child-app-spec.md section 9 and section 11.

- Usage: compute today's totalMinutes, per-app minutes (by display name, no zero rows, max 200) and hourly[24]
  from UsageStatsManager events; exclude eGuard's own screens; send every cycle, plus a final total for yesterday
  once after midnight. Totals must match Settings › Digital Wellbeing within 5 minutes a day: write a debug screen
  that shows both side by side.
- Location: only when policy LOCATION sharing is true AND permission is granted; balanced accuracy; a fix when
  moved more than 150 m or every 15 minutes at rest; send accuracyM; nothing kept beyond the last unsent fix.
- LIMIT_REACHED once when the daily limit is hit.

Done when: unit tests cover the usage aggregation (including a day boundary and a clock change), location gating
(sharing off, permission denied, Free plan responses), and a day's run on a real phone passes the 5-minute check.
```

### 2.8 Android tamper and removal

```
Read CLAUDE.md and docs/child-app-spec.md section 10 and the removal part of section 5.

Go through the tamper table in section 10 one row at a time on a real device and make sure each "Device must"
happens: revocations reported on the app's next run, monotonic time for usage, server Date header for day
boundaries when the clock is off by more than an hour, and the full removal path on 401.

Write the results as a checklist in docs/android-tamper-test.md: the step you did, what the app did, what the
parent saw, pass or fail. Fix failures in this session if they're small; list the rest.
```

### 2.9 Android privacy and store audit

```
Read CLAUDE.md, docs/child-app-spec.md sections 11, 12 and 14, and (if present) the store sections of
app-listing.md.

Audit the Android build, don't add features:
1. List every dependency (./gradlew :app:dependencies) and flag anything that collects data or phones home.
2. List every permission in the merged manifest; each must map to a protection in the spec or be removed.
3. Confirm IsMonitoringTool, the persistent notification, the foreground service type declaration, and an in-app
   disclosure before every sensitive permission prompt.
4. Run the app for an hour behind a proxy (mitmproxy or Android Studio's network inspector) and confirm every
   request goes to the API base URL and carries only the fields in spec section 11.
5. Measure battery and data for a day against section 12.

Write docs/android-audit.md with the findings and fix what's wrong. Tell me anything that changes the store forms.
```

---

## Phase 3: iOS

Run after prompt 1.1's results are approved and the spec updated. If the spike showed that something in the spec
can't be done on iOS, the spec should already say what the app does instead; these prompts build what the spec says.

### 3.1 iOS API client, token store and App Group

```
Read CLAUDE.md, docs/child-app-spec.md sections 4, 8 and 10, and docs/ios-spike-results.md.

Build a Swift package (EGuardCore) used by the app and both extensions:
- the device API client with Codable types matching the spec exactly, ProtectionConfig as an enum with associated
  values encoding exactly the spec's fields (no `key` inside config, never NOTIFICATIONS on iOS), with a test per key
  against a JSON string;
- the same error mapping and offline queue rules as the spec's section 8, stored in the App Group container;
- token storage in the Keychain, shared through the App Group access group, with
  kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly; never logged.

Done when: `swift test` passes for EGuardCore and the app and extensions build.
```

### 3.2 iOS setup flow

```
Read CLAUDE.md, docs/child-app-spec.md sections 4 and 5, and docs/ios-spike-results.md.

Build the iOS version of the setup flow (same screens and messages as Android, spec section 4), with iOS steps:
FamilyControls .child authorization (explain that a parent approves it with their Apple ID, and handle refusal),
location When In Use then Always, notifications. Explain Family Sharing is required before authorization, and
handle the error when the device isn't in a family.

Done when: the flow pairs a real iPad or iPhone with a local server, SwiftUI previews exist for each screen, and
the authorization-refused and not-in-family paths show clear messages.
```

### 3.3 iOS sync and background

```
Read CLAUDE.md, docs/child-app-spec.md sections 6 and 8, and docs/ios-spike-results.md (the BGAppRefreshTask
findings).

Build the sync cycle from spec section 8 in EGuardCore with the same Enforcer interface idea as Android (apply,
readBack from ManagedSettings/DeviceActivityCenter, never from what was applied). Run it on app launch,
BGAppRefreshTask, location updates, DeviceActivityMonitor callbacks (through the App Group), and silent push if
prompt 0.7 is done. Handle 401 removal: clear the ManagedSettingsStore, stop monitoring, delete token and state.

Done when: unit tests with fakes cover the cycle, mismatch reporting, full reports and removal, and a parent change
verifies on a real device the next time it syncs.
```

### 3.4 iOS enforcement and shields

```
Read CLAUDE.md, docs/child-app-spec.md sections 5, 6 and 7, and docs/ios-spike-results.md.

(plan first) Implement the iOS enforcers for every key the spec's iOS column marks Available, and the read-back
for Guided and Verify-only keys exactly as the updated spec describes (from the spike). Screen time and bedtime use
DeviceActivitySchedule and threshold events; shields use ManagedSettingsStore; the ShieldConfiguration extension
shows the spec's block-screen titles and bodies. Map app rules to tokens as decision D4 settled.

Done when: every iOS acceptance item in spec section 14 passes on a real device, or you've told me which can't and
why.
```

### 3.5 iOS home, apps, usage and location

```
Read CLAUDE.md, docs/child-app-spec.md sections 5, 7 and 9, and docs/ios-spike-results.md.

Build the child home screen (same content and rules as Android, VoiceOver and Dynamic Type), Ask for an app, and
the usage and location reporting as the updated spec section 9 says for iOS. Send only what the spike showed can
leave the device; don't approximate numbers the spec doesn't define.

Done when: SwiftUI previews exist for each state and a day on a real device shows the expected data in the parent
app.
```

### 3.6 iOS privacy and store audit

```
Same audit as docs/android-audit.md, for iOS: dependencies, Info.plist usage strings (spec and app-listing.md
section 9), entitlements (Family Controls distribution requested?), App Privacy label accuracy, network capture,
battery. Write docs/ios-audit.md and fix what's wrong.
```

---

## Phase 4: acceptance

### 4.1 Acceptance pass

```
Read docs/child-app-spec.md section 14, docs/android-audit.md, docs/ios-audit.md and docs/android-tamper-test.md.

Walk every acceptance item in section 14 on one real Android device and one real iOS device paired to a staging
server. For each item record pass, fail or not applicable (with why) in docs/acceptance-{date}.md, with evidence.
Don't tick an item from reading code; each needs a run.

Then list, in priority order, what must be fixed before a store submission, and which open decisions in section 15
are still open.
```

---

## Writing your own prompts for this project

For anything not covered above, the prompts that work best here have:

1. **What to read first**: the spec sections by number, and the files that matter.
2. **One outcome**, stated as behavior the child or parent sees.
3. **The rules that can't bend**: exact-match reporting, read back from the OS, never hide, no data beyond section 11.
4. **"Done when"** in terms you can check: tests pass, a device does X, the parent sees Y.
5. **What to do if the spec is wrong**: stop and propose the spec change, don't work around it.
