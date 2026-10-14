# Child device app: product and technical spec

The spec for **child device mode**: the eGuard app running on a child's Android or iOS phone or tablet. It covers
what the child sees, how each protection is enforced, and exactly how the app talks to the device API
(`/api/device/v1`).

**Status:** draft, written 2026-09-30 against the server as it is today. The native apps aren't built yet (README
› Not built yet). Anything that depends on platform choices still to be made is marked **Decide**. Anything the
server doesn't support yet is marked **Server gap** and collected in [section 13](#13-server-gaps).

**Related:** [app-listing.md](app-listing.md) (store policies, permissions, privacy forms),
[mobile-api.md › Part C](mobile-api.md#part-c-child-device-api) (the device API this app calls: every endpoint, field and error),
[mobile-api.md › Part A and B](mobile-api.md) (one app with both modes, and the parent API), and the README's "How verification works".

## Contents

1. [What the app is](#1-what-the-app-is)
2. [Principles](#2-principles)
3. [Platforms and targets](#3-platforms-and-targets)
4. [Setup (pairing) flow](#4-setup-pairing-flow)
5. [What the child sees](#5-what-the-child-sees)
6. [Enforcing the 10 protections](#6-enforcing-the-10-protections)
7. [Apps: approval, blocking and per-app limits](#7-apps-approval-blocking-and-per-app-limits)
8. [Sync and reporting](#8-sync-and-reporting)
9. [Screen time, location and events](#9-screen-time-location-and-events)
10. [Security and tamper resistance](#10-security-and-tamper-resistance)
11. [Privacy](#11-privacy)
12. [Non-functional requirements](#12-non-functional-requirements)
13. [Server gaps](#13-server-gaps)
14. [Acceptance criteria](#14-acceptance-criteria)
15. [Open decisions](#15-open-decisions)

---

## 1. What the app is

One binary ships to both stores (app-listing.md › 2). On first launch it asks who is using it. Choosing
**"I'm setting up my child's device"** puts it in child device mode for good: it pairs with one child, applies and
reports that child's protections, and never shows parent screens or holds parent credentials.

| In scope | Out of scope |
|---|---|
| Pairing with a one-time code | Parent sign-in, family management (parent mode) |
| Enforcing the 10 protections where the platform allows | Reading messages, photos, files, browsing content or keystrokes |
| Reporting the configuration the device **actually** has | Web filtering in desktop browsers (the browser extension does that) |
| Screen time and per-app usage totals | Call or SMS logs, contacts, microphone, camera |
| Current location, when the parent turns it on | A location trail kept on the device |
| Letting the child ask for an app | Chat between child and parent |
| Showing the child, plainly, what's on and why | Hiding the app or its icon |

## 2. Principles

These come from how the server already works. Treat them as requirements.

1. **Report what is true, not what was asked.** The server marks a change `VERIFIED` only when the device reports a
   config that matches. If the app echoes the request back without reading the real OS state, Configuration Health
   becomes a lie. Always read back from the OS after applying, and report what you read.
2. **Never hide.** The child always knows eGuard is on: a persistent notification on Android, a visible app, and a
   home screen that lists what's active. No stealth mode, no disguised icon (app-listing.md › 10).
3. **Explain every block.** Anything the child hits (a blocked app, a limit, bedtime) shows who set it, what it is,
   and what they can do: ask a parent, or wait until a time.
4. **Collect the minimum.** Only what the device API accepts. Nothing else leaves the device (section 11).
5. **Keep working offline.** Enforcement uses the last policy the device received. The network is only for
   receiving changes and reporting.

## 3. Platforms and targets

| | Android | iOS / iPadOS |
|---|---|---|
| Minimum OS | **Decide.** Android 10 (API 29) suggested | iOS 16 (needed for `FamilyControls` `.child` authorization) |
| Device kinds | Phone, tablet | iPhone, iPad |
| Enforcement stack | On-device APIs: Usage access, device admin, local `VpnService`, foreground service. No Google Family Link ([decision D1](#15-open-decisions)) | `FamilyControls`, `ManagedSettings`, `DeviceActivity` (Screen Time API) |
| Needs Family Sharing / Family Link | No (D1: on-device APIs) | Yes: the child's Apple ID must be in the parent's Family Sharing group, and a parent approves `.child` authorization |
| Store entitlement | `IsMonitoringTool = parental_control`, permission declarations (app-listing.md › 9) | Family Controls **distribution** entitlement. Request it now; it can take weeks |

Capabilities per platform are defined in [src/lib/protections.ts](../src/lib/protections.ts) and must match what the
app does:

| Protection | Android | iOS |
|---|---|---|
| Screen Time | Available | Available |
| Bedtime | Available | Available |
| App Restrictions | Available | Available |
| App Approval | Available | Available |
| Content | Available | Available |
| Web Filtering | Guided (Private DNS) | Guided |
| Downloads | Available | Verify only |
| Location | Available | Guided |
| Notification Controls | Available | Unsupported |
| Uninstall Protection | Available | Available |

If the app can't deliver a cell marked **Available**, change the matrix in `protections.ts` before release, not
after. The parent app and the store listing read from it.

## 4. Setup (pairing) flow

A parent (or the child with a parent next to them) does this on the child's device. It takes about 3 minutes.

```
Mode choice ─► What eGuard does ─► Enter code ─► Name this device ─► Permissions (one screen each)
                                                                          │
                     Done ◄─ First sync + full report ◄───────────────────┘
```

| # | Screen | Behavior |
|---|---|---|
| 1 | **Who's using this device?** | "I'm a parent" / "I'm setting up my child's device". The second shows a note that the parent needs their own phone or the web to get a code |
| 2 | **What eGuard does here** | Plain list: what eGuard will control, what the parent will see (settings status, screen time totals, app names, location if on), and what it never sees (messages, photos, browsing content). Required by the stores before any permission prompt |
| 3 | **Enter the pairing code** | 8 characters from `A–Z` without `I`/`O` and `2–9`. Auto-uppercase, ignore spaces and dashes, accept paste. Hint: "In the eGuard app or at eguard.family, open your child and choose Add device. Codes last 15 minutes." |
| 4 | **Name this device** | Prefilled from the OS (`Mia's iPad`, or model name). Editable, 1–60 characters. Shown to parents everywhere |
| 5 | **Permissions** | One screen per permission the protections need, each with a disclosure before the system prompt (list below). "Skip for now" is allowed; the protection then reports as off and the parent sees it |
| 6 | **Finishing setup** | First `/sync`, apply `policy` and `requests`, then a full `/report`. Shows progress per protection |
| 7 | **You're all set** | "eGuard is protecting this device for {childName}." Lists what's on. Button to the home screen |

### Pair request

Call `POST /api/device/v1/pair` after screen 4 (the name is part of the request). Pair first, then ask for
permissions, so a bad code doesn't waste the permission steps. **Decide:** if the name screen should come later,
send the OS default name and add a rename call (**Server gap G6**).

```json
{
  "code": "K7PQ2M9X",
  "platform": "ANDROID",
  "name": "Mia's Galaxy A15",
  "model": "SM-A155F",
  "kind": "PHONE",
  "osVersion": "14",
  "appVersion": "1.0.0"
}
```

`code` is case-insensitive and may contain spaces or dashes ("k7pq-2m9x" works), so the field can accept what the
parent reads out. `201` returns `{ deviceId, token, childName }`. Store the token at once (section 10). It is shown only once.

| Response | What the app shows |
|---|---|
| `400` "Pairing code is invalid or expired" | "That code didn't work. Codes last 15 minutes and only the newest one works. Ask for a new code." |
| `400` "This code is for the eGuard browser extension…" | Show the server's message as-is |
| `409` "Device limit reached for this plan" | "{Family}'s plan has no free device slots. A parent can remove a device, then use the same code." (The server gives the code back.) |
| `429` | "Too many tries. Wait a few minutes and try again." |
| Network error | Retry button. Keep the typed code |

### Permissions by platform

**Android** (confirm each against the build; unused ones must be removed, app-listing.md › 9):

| Permission | Needed for | Disclosure text (short form) |
|---|---|---|
| Usage access (`PACKAGE_USAGE_STATS`) | Screen Time, per-app limits, app blocking | "Lets eGuard count screen time and pause apps when time is up." |
| Display over other apps, or AccessibilityService | Showing the block screen over a blocked app | **Decide** (D2). Prefer overlay; accessibility needs a Play declaration |
| Device admin | Uninstall Protection | "Stops eGuard from being removed without a parent." |
| None (Private DNS is a system setting the parent sets with the guided steps; eGuard only reads it) | Web Filtering | — |
| Location, then "Allow all the time" | Location | "Shares this device's location with your parent." Ask for background location on a separate screen after foreground |
| Notifications (`POST_NOTIFICATIONS`) | The "eGuard is active" notification | "Shows that eGuard is on." |
| Notification policy access | Notification Controls (quiet at bedtime) | "Silences notifications during bedtime." |
| Battery optimization exemption | Reliable sync | "Keeps eGuard working in the background." |

**iOS:**

| Step | Needed for |
|---|---|
| `AuthorizationCenter.requestAuthorization(for: .child)` | Every Screen Time protection. A parent approves with their Apple ID |
| Location "While Using", then "Always" | Location |
| Notifications | Limit and bedtime warnings |
| Guided steps for Web, Downloads and Location | Shown to the parent in the parent app; the child app just reports (section 6) |

## 5. What the child sees

Language is short, warm and never threatening. Say "your parent" unless the app knows more. Never call it
spying, monitoring or tracking.

### Home

- Header: "eGuard is on" and the child's name. "Set up by your family."
- **Today:** screen time used vs today's limit (weekend limit on Sat/Sun), as a bar with "1h 20m left".
- **Bedtime:** "Bedtime starts at 9:30 PM" or "Off".
- **What's on:** each protection that is on, one line each, with a plain explanation ("Apps rated 9+ and under").
  Unsupported ones aren't listed.
- **Ask for an app** button (section 7).
- Last synced time. If more than a day: "Can't reach eGuard. Your settings still work."

The home screen reads only from the last `/sync` response saved on the device. It works offline.

### Block screens

Every block screen has the eGuard mark, a title, one line of why, and a way forward.

| Trigger | Title | Body | Actions |
|---|---|---|---|
| App is `BLOCKED` | "{App} is blocked" | "Your parent turned this app off." | Ask again (at most once a day, the server rate-limits alerts) · Close |
| App is `PENDING` | "Waiting for your parent" | "You asked for {App}. You'll be able to use it once your parent says yes." | Close |
| App over its daily limit | "Time's up for {App}" | "You've used your {30m} for today." | Close |
| Daily limit reached | "Screen time is up for today" | "Your limit is {2h}. Apps come back tomorrow." | Allowed apps (phone, messages, always-allowed apps) · Close |
| Bedtime | "It's bedtime" | "Apps are paused until {6:00 AM}." | Allowed apps · Close |
| App over age rating | "{App} isn't allowed" | "It's rated {17}+." | Ask for it · Close |
| Website blocked (Android Private DNS) | The family resolver's own block page, or the site just doesn't load | Shown by the browser | None in v1 (the browser access-request flow is extension-only; see G7) |

Emergency calls and the phone dialer are never blocked. **Decide** (D5) the full always-allowed list (phone,
messages, maps, eGuard itself).

### Warnings

Local notifications, no server call: 10 minutes before the daily limit, 10 minutes before bedtime, and when a
parent approves or declines an app (detected on the next sync).

### Removal

There is no "unpair" button for the child. A parent removes the device in their app. When any call returns `401`,
the app stops enforcing, deletes its token and saved policy, and shows "This device was removed from eGuard by your
parent. You can now uninstall eGuard." It then turns off device admin (Android) or clears its `ManagedSettings`
store (iOS).

## 6. Enforcing the 10 protections

For each protection: how it's applied, how the app reads back the real state, and the exact config to report.

**Reporting rule.** Send `config` with **exactly** the fields in `ProtectionConfig`
([protections.ts](../src/lib/protections.ts)), with the same types, and no `key` inside `config` (the server adds
it). The server compares the whole object for equality: an extra field, `"120"` instead of `120`, or `"9:30"`
instead of `"21:30"` fails verification. A config with a missing or extra field, a wrong type or an impossible
value (`"25:00"`) isn't stored at all: the response is still `200`, with `ignored: [{ key, error }]` naming each
protection that was skipped. Treat a non-empty `ignored` as a bug and log it.

| Key | Config to report | Android: apply and read back | iOS: apply and read back |
|---|---|---|---|
| `SCREEN_TIME` | `{ dailyMinutes, weekendMinutes }` | Stored in the app. Count with `UsageStatsManager`, including the app open right now; at the limit, show the block screen over non-allowed apps at once, even mid-game or mid-video (Android plans a check for the exact moment the open app's time, extra time or the wait for bedtime runs out, and checks again as soon as a sync changes the rules). Report the limits the app is enforcing | `DeviceActivityMonitor` schedule with a threshold event; at the threshold, apply a shield through `ManagedSettingsStore`. Report the thresholds actually registered |
| `BEDTIME` | `{ enabled, start: "HH:MM", end: "HH:MM", days: "EVERY_DAY" \| "SCHOOL_NIGHTS" }` | App-enforced schedule; block screen during the window. Handle windows that cross midnight | `DeviceActivitySchedule` with `repeats: true`; shield on `intervalDidStart`, clear on `intervalDidEnd`. Report the registered schedule |
| `APP_RESTRICTIONS` | `{ maxAgeRating }` (4, 9, 12, 13 or 17) | **Set by the parent (`PARENT_SET`), don't report.** Android can't read app ratings (D3), so the parent sets Google Play's parental controls from the guide and confirms; the server records it as set by them, not verified, and ignores anything a device reports for this key | `ManagedSettings` `appStore.maximumRating` (`ageRating` mapping). Read back from the store |
| `APP_APPROVAL` | `{ enabled }` | When on, a newly installed app is blocked until approved; send `APP_REQUESTED` | `application.denyAppInstallation` (shared with `DOWNLOADS`: denied when either is on). Report `enabled` = installs denied **and** approval wanted |
| `CONTENT` | `{ maxAgeRating }` | **Set by the parent (`PARENT_SET`), don't report.** Google Play's parental controls for movies and TV, as for `APP_RESTRICTIONS` | `ManagedSettings` `media.maximumMovieRating` / `maximumTVShowRating`, explicit content. Report the higher of the movie and TV tiers (no cap counts as 21), so either one loosened shows as not matching |
| `WEB` | `{ mode: "OFF" \| "FILTER" \| "ALLOWLIST", blockedSites }` | **Guided.** The parent sets Private DNS to a family filter (`family.cloudflare-dns.com`; `FamilyDns.HOSTS` also accepts AdGuard, CleanBrowsing and Mullvad family resolvers). Read back with `LinkProperties.privateDnsServerName`: `FILTER` when it's one of those, else `OFF` (always `OFF` below Android 9). `ALLOWLIST` isn't possible, so it shows as not matching. `blockedSites` is 0; the server compares `mode` only. Turning it off on the phone is noticed on the next cycle (it's in the capability set) | **Applied by eGuard.** `webContent.blockedByFilter = .auto()` unless the mode is `OFF` (`ALLOWLIST` is applied as a filter, so it shows as not matching). Report `mode` from the store and `blockedSites: 0` |
| `DOWNLOADS` | `{ requireApproval }` | A newly installed app stays locked until approved (same mechanism as App Approval; Android can't stop the Play Store download itself) | **Applied by eGuard.** `application.denyAppInstallation` (shared with `APP_APPROVAL`). Report `requireApproval` = installs denied **and** downloads approval wanted |
| `LOCATION` | `{ sharing }` | `true` when location permission (background) is granted **and** the policy has sharing on | **Guided.** `true` when Always/While Using is granted and sharing is on |
| `NOTIFICATIONS` | `{ quietDuringBedtime }` | Turn on Do Not Disturb during bedtime with `NotificationManager.setInterruptionFilter`. Report whether the app has policy access and the rule is registered | **Unsupported.** Don't report this key |
| `UNINSTALL_PROTECTION` | `{ enabled }` | Device admin active (`DevicePolicyManager.isAdminActive`) | `ManagedSettings` `application.denyAppRemoval = true`. Read back |

Additional rules:

- **Only report protections the platform supports.** iOS never sends `NOTIFICATIONS`; Android never sends
  `APP_RESTRICTIONS` or `CONTENT` (set by the parent). The server counts an unsupported protection as unsupported
  whether or not it's reported.
- **A full report covers every protection the device can apply.** One left out of a `full: true` report is taken as
  not in force (status Warning, or Action required for App Approval and Uninstall Protection) with "eGuard isn't
  applying it". Better: report what is in force (e.g. `{ enabled: false }`) with `error` saying why ("Accessibility
  for eGuard is turned off."). Leave `error` out when there's nothing to say: `null` is rejected. Android does this
  for `SCREEN_TIME` (`{ dailyMinutes: 0, weekendMinutes: 0 }` without accessibility or usage access), `BEDTIME`,
  `APP_APPROVAL`, `DOWNLOADS` (without accessibility) and `NOTIFICATIONS` (without Do Not Disturb access); one the
  policy turns off is reported as the policy has it, with no `error`.
- **Report after every change,** whether the change came from the parent or from the child turning something off in
  system settings. Listen for permission and admin revocation (Android `DeviceAdminReceiver.onDisabled`, location
  permission changes, VPN revoked) and report within a minute of the app next running.
- **Guided and verify-only protections never arrive in `requests`.** `/sync` only delivers `APPLY` requests. For
  these, the parent follows steps and taps "Verify now", and the device sees `fullReportRequested: true` on its
  next sync. It then reads the state and sends a full report.
- **Time zone and days.** Count days in the family's time zone, `timezone` from `/sync` (e.g. `Asia/Manila`), so
  the device and the parent agree on "today" even when the device's own zone differs. Weekend means Saturday and
  Sunday, which is how the server counts it (`limitOn` in [src/lib/queries.ts](../src/lib/queries.ts)).
  `SCHOOL_NIGHTS` means the nights before a school day, Sunday to Thursday. A bedtime window belongs to the evening
  it starts on (or the evening before, when it starts after midnight): 21:30–06:00 on school nights runs from
  Thursday 21:30 to Friday 06:00, and not on Friday or Saturday night. `bedtimeActive` in
  [src/lib/protections.ts](../src/lib/protections.ts) is the reference, with tests.

## 7. Apps: approval, blocking and per-app limits

`/sync` returns `apps: [{ name, approval, dailyLimitMinutes, category }]` for the child. `name` is the display name and is
the only key: there's no package name or bundle ID (**Server gap G4**).

| `approval` | What the device does |
|---|---|
| `ALLOWED` | Usable, subject to screen time, bedtime and its own `dailyLimitMinutes` |
| `ALWAYS_ALLOWED` | Not paused by the daily screen-time limit or a category limit. Bedtime and its own `dailyLimitMinutes` still apply |
| `FILTERED` | Blocked, like `BLOCKED` (reserved for content filtering; parents can't pick it on web any more). Asking for it reaches the parent as for a blocked app |
| `BLOCKED` | Always shows the block screen. Opening it sends `APP_BLOCKED` |
| `PENDING` | Blocked, with the "Waiting for your parent" screen |
| Not in the list | New app. If App Approval is on, block it and send `APP_REQUESTED`; else allow it and send `APP_INSTALLED` |

Apps that were on the phone before pairing are never "installed": the server adds every app named in `/usage` to the
list (as `ALLOWED`, no alert), so they appear in `apps` on a later sync and the parent can block or limit them.

**Category limits.** Each app has a `category` (`GAMES`, `SOCIAL`, `VIDEO`, `MESSAGING`, `EDUCATION`, `CREATIVITY`,
`BROWSERS`, `OTHER`): the parent's choice or the server's guess from the name. `categoryLimits:
[{ category, dailyLimitMinutes }]` caps the day's total for all apps in a category, in the family's time zone. Once
it's used up, pause those apps (except `ALWAYS_ALLOWED`, whose minutes still count) like a per-app limit and send
`LIMIT_REACHED` with the `category`; asking for more time there sends `TIME_REQUESTED` with reason `CATEGORY_LIMIT`.
An app not in `apps` yet counts as `OTHER` until the next sync. Android: `EnforcementEngine` (since this change). The list is empty on plans without
category limits (`features.categoryLimits: false`).

**Asking for an app.** From a block screen or Home › Ask for an app, send `POST /events`
`{ "type": "APP_REQUESTED", "app": "Roblox" }`. The response includes `approval` when the app is already decided.
The answer reaches the device on a later sync (up to 5 minutes, or longer on iOS). Show "Sent to your parent".

**iOS note.** The Screen Time API gives opaque app tokens and no app names, even inside extensions. Showing app
names to parents, `APP_INSTALLED` events and name-based rules all depend on this. **Decide** (D4) how iOS maps the
server's names to tokens, for example by having the parent pick apps with `FamilyActivityPicker` in parent mode.
Until then the iOS app enforces none of the per-app rules in `apps` (approval, `dailyLimitMinutes`, `category`) nor
`categoryLimits`, sends `/usage` without `apps`, and has no `TIME_REQUESTED` or `extraTimeUntil` (checked 2026-10-13).
It does read `FILTERED` as blocked when answering a child's request.

## 8. Sync and reporting

### Calls

All calls: `Authorization: Bearer <device token>`, JSON, HTTPS only. Errors are `{ error }`.

| Call | When | Body |
|---|---|---|
| `POST /sync` | Every `nextSyncSeconds` (300 today), at app start, after network returns, after boot | `{ battery, osVersion, appVersion }`. Returns `{ deviceId, childName, policy, requests, apps, categoryLimits, extraTimeUntil, fullReportRequested, nextSyncSeconds, timezone, features: { locationSharing, categoryLimits }, minAppVersion }`. `childName` can change: a parent may move the device to another child, so show the latest one, not the name from pairing |
| `POST /report` | After applying anything from `/sync`, after any on-device change, and in full when `fullReportRequested` | `{ protections: [{ key, config }], full?, battery?, osVersion?, appVersion? }` |
| `POST /usage` | Every sync cycle for today, and once for yesterday after midnight | `{ date, totalMinutes, apps, hourly }` |
| `POST /location` | Section 9 | `{ lat, lng, accuracyM, placeLabel?, at }` (`at`: when the OS took the fix) |
| `POST /events` | Section 9 | One event |

### The sync cycle

```
POST /sync
  ├─ save policy + apps locally (this is what's enforced offline)
  ├─ for each item in requests: apply config ─► read back from the OS
  ├─ POST /report with the protections that changed (read-back values)
  └─ if fullReportRequested: POST /report { full: true, protections: every supported key }
POST /usage (today)
schedule next run in nextSyncSeconds
```

- Apply `requests` in the order given. Also reconcile against `policy`: if the policy says a protection is on and
  the device doesn't have it, re-apply it. The `policy` is the source of truth for enforcement, and already includes
  any change still waiting to be verified (the newest per protection), so enforcing `policy` alone is enough;
  `requests` tells you what the parent changed and hasn't been verified yet. A cancelled or failed change stops being
  sent, and `policy` goes back to the verified setting.
- A request keeps coming back in every `/sync` until the device reports that protection (then it's `VERIFIED` or
  `FAILED`), so a sync response lost on the way doesn't strand a change. Applying it again must be harmless: apply,
  read back, report. Report every protection that arrived in `requests`, even when nothing changed on the device.
- `minAppVersion`: when it's set and above the app's version, show an update screen and stop syncing until updated.
  `null` means no minimum.
- `features.locationSharing: false` means the family's plan doesn't include location: don't collect or send fixes,
  whatever the `LOCATION` policy says. Still report the `LOCATION` protection as usual.
- A full report must answer quickly. The parent's "Run a check" waits 12 seconds, or 30 when an iOS device hasn't
  answered yet (`CHECK_TIMEOUT_MS` / `CHECK_TIMEOUT_IOS_MS` in [engine.ts](../src/lib/engine.ts)), and after that
  marks the device unreachable. The check wakes the device (below); answer within that sync.
- When applying a protection fails, never swallow it: still report what the OS has, with `error` set to the reason
  (`/report`), and tell the child on their home screen. The parent sees "*Name* couldn't be applied on *device*:
  *reason*", and a change that fails keeps the reason.
- Send `pushToken` (the app's FCM registration token) on `/sync` whenever push is available. A message with
  `data.type == "sync"` (no notification part) means "sync now": a parent changed a setting, app rules or extra time,
  ran a check, or moved the device. `data.reason` is `config`, `check`, `apps` or `extra_time`, for logging only.
- Every call counts as "seen". A device that doesn't call for 24 hours raises "Device hasn't synced in over a day".

### Background execution

| | Android | iOS |
|---|---|---|
| Keeping alive | Foreground service with the persistent "eGuard is active" notification (type `specialUse` or `dataSync`, Android 14+ declaration) | No always-on process. Enforcement lives in the system (`ManagedSettings`) and keeps working without the app |
| Periodic sync | Inside the service, every `nextSyncSeconds`. `WorkManager` 15-minute job as a backup | `BGAppRefreshTask` (system-scheduled, often hours apart), `DeviceActivityMonitor` callbacks, location updates, and app launches |
| Instant changes | FCM high-priority data message → `EGuardMessagingService` → expedited sync (`syncNow`) | FCM → APNs background push (`content-available`) → `didReceiveRemoteNotification` → one sync. Needs the `remote-notification` background mode |
| After reboot | `RECEIVE_BOOT_COMPLETED` restarts the service | Enforcement survives; sync resumes on next wake |

On iOS the system decides when a background push runs: usually within seconds, but it can hold them back (Low Power
Mode, a force-quit app, a budget of a few per hour). Polling stays the guarantee, so the parent app should still say
"Applies the next time {device} checks in" once its wait times out. Nothing is woken when the server has no
`FCM_SERVICE_ACCOUNT`, or before the app has sent a `pushToken`.

### Retries and offline

- Queue `/report`, `/usage` and `/events` on disk when offline; send in order when back. `/usage` is idempotent per
  day (the latest total wins), so resend freely. Keep at most the newest `/report` per protection key and the
  newest `/location`.
- Retry `5xx` and network errors with exponential backoff from 30 seconds to 15 minutes, with jitter.
- `400`: log it locally and drop the item. It's a bug; don't retry.
- `401`: the device was removed (section 5 › Removal). Stop everything.

## 9. Screen time, location and events

### Screen time (`/usage`)

- `date` is the device's local date, `YYYY-MM-DD`, and must be a real day within the last 30 days. Older queued
  totals get a `400`: drop them.
- `totalMinutes` is foreground time across all apps, 0 to 1440. Don't count eGuard's own screens.
- `apps` is per-app minutes by display name, at most 200. Leave out apps with 0 minutes.
- `hourly` is 24 numbers, minutes per local hour (0 is midnight), each 0 to 60.
- Send today's running totals every sync, and a final total for yesterday once after midnight.

**iOS: Server gap G3 / Decide D4.** `DeviceActivityReport` extensions run sandboxed and can't send data off the
device. Totals may only be known as threshold events (for example, "reached 60 minutes"). Before promising the
parent's screen-time charts on iOS, prototype this. If only thresholds are possible, send `totalMinutes` rounded to
the last threshold crossed and no `apps`, and change the listing copy.

### Location (`/location`)

- Only when the child's `LOCATION` policy has `sharing: true`, the permission is granted **and** `/sync` says
  `features.locationSharing: true`. The server drops fixes on the Free plan and while sharing is off, but the device
  shouldn't collect or send them at all.
- Send a fix every sync cycle while moving, or after moving more than 150 m (the server's same-place radius). At
  rest, one fix every 15 minutes is enough to count as "live" in the parent app (it reads "Last seen" after 20).
- At most 240 fixes an hour: past that the server answers `429`. Keep only the newest unsent fix and send it after a
  few minutes.
- Use balanced accuracy (not GPS-always). Send `accuracyM`, and `at`, the fix's own time: a last-known position or
  one queued offline is older than the request, and the parent must see when it was really taken.
- `placeLabel` is optional. Don't reverse-geocode on the device in v1: the server names a fix from the places the
  parents saved (Home, School), and that name wins over a device label.
- Each fix replaces the previous one whole: a field you leave out (`placeLabel`, `accuracyM`) is cleared, not kept from the last fix.
- Nothing is stored on the device beyond the last unsent fix.

### Events (`/events`)

| Event | Send when | Server throttles |
|---|---|---|
| `APP_INSTALLED` `{ app, ageRating? }` | A new app appears and App Approval is off | Only the first time the name is seen for the child. Sent with approval on, the server treats it as `APP_REQUESTED` (the app is added as `PENDING`); send only `APP_REQUESTED` then. `ageRating` is 0–21; app names are trimmed, and a blank one is a `400` |
| `APP_REQUESTED` `{ app }` | The child taps Ask for an app, or a new app is installed with App Approval on | One open request per app; asking again for a blocked app alerts once a day |
| `APP_BLOCKED` `{ app }` | The child opens a `BLOCKED` app | One alert per app per hour |
| `LIMIT_REACHED` `{ minutes }` | The daily screen-time limit is hit (`minutes` is the limit) | One alert per 12 hours |
| `LIMIT_REACHED` `{ minutes, category }` | A category limit is used up (`category` from `categoryLimits`, `minutes` its limit) | One alert per category per 12 hours ("Gaming time used up") |
| `USER_LEFT` `{}` / `USER_RETURNED` `{ awayMinutes }` | Android: the phone switched to another user or guest profile (`ACTION_USER_BACKGROUND`, registered at runtime) and back (`ACTION_USER_FOREGROUND`). Queue them with an `eventId`: the network may not be reachable from a background user | Parents see "Switched to another user" while away and "Used on another user for N min" after |
| `TIME_REQUESTED` `{ app?, reason? }` | The child taps Ask for more time on a limit or bedtime block screen (`reason`: `DAILY_LIMIT`, `APP_LIMIT`, `CATEGORY_LIMIT`, `BEDTIME`) | One open request per child; the parent answers with extra time (`extraTimeUntil` on the next sync: limits and bedtime stop blocking until then) or not now |

Give each event an `eventId` (8–64 characters; a UUID made once per event) and send the same one on every retry.
The server answers a repeat from the same device within 7 days with `{ "ok": true, "duplicate": true }` and does
nothing else, so a retry after a timeout can't raise a second request. Without `eventId`, a retried event counts as
a new one.

## 10. Security and tamper resistance

- **Token storage:** Android Keystore-backed `EncryptedSharedPreferences`; iOS Keychain with
  `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (so background sync works after a reboot, and backups don't
  carry the token to another device). Shared with extensions through an App Group on iOS.
- **Never log the token.** Never put it in a URL.
- **TLS only,** to `https://www.eguard.family`. Certificate pinning: **Decide** (D6). If pinned, pin the issuing CA,
  not the leaf, and ship a backup pin.
- **No parent credentials** ever touch the device in child mode. The mode switch is one-way; going back to parent
  mode means removing the device and reinstalling. **Decide** (D7) whether a parent PIN on the device is wanted; the
  server has no API for one today.
- **Tampering the child can do, and what happens:**

| Child does | Device must | Parent sees |
|---|---|---|
| Revokes usage access, location, VPN, device admin | Report the protection as it now is, on next run | "Protection setting changed" or "Location sharing turned off" |
| Force-stops the app or clears its data (Android) | Nothing possible until restart; clearing data loses the token, so the device goes silent | "Device hasn't synced in over a day". **Server gap G9:** a faster "stopped reporting" alert |
| Changes the device clock | Use `SystemClock.elapsedRealtime` / monotonic time for counting usage; trust the server response `Date` header for day boundaries when they disagree by more than 1 hour | Usage stays correct |
| Uninstalls (Uninstall Protection off) | n/a | Device goes silent, then the offline alert |
| Factory reset | n/a | Same |

## 11. Privacy

What leaves the device, all of it:

| Data | Endpoint | Condition |
|---|---|---|
| Device name, model, platform, kind, OS and app version, battery | `/pair`, `/sync`, `/report` | Always |
| Protection configs | `/report` | Always |
| Screen time totals, per-app minutes by name, hourly totals | `/usage` | Always |
| App names (install, request, blocked) | `/events`, `/usage` | Always |
| Current location and accuracy | `/location` | Only while location sharing is on and the plan includes it |

Nothing else. In child device mode:

- No analytics, ads or attribution SDKs. Crash reporting only if it strips identifiers and is listed on the store
  forms (app-listing.md › 7 and 8). Apple guideline 5.1.2 applies.
- No web views that load third-party content.
- The VPN filters on the device. No traffic goes to eGuard or anyone else.
- Everything local (policy, queue) is deleted on `401`.

## 12. Non-functional requirements

| Area | Requirement |
|---|---|
| Battery | Under 3% a day on a mid-range Android phone with location on. Measure before beta |
| Data | Under 2 MB a day |
| Startup | Home screen shows saved state in under 1 second, offline |
| Accessibility | Screen reader labels on every control, dynamic type, 4.5:1 contrast, block screens readable at 200% text |
| Language | English at launch. Strings in resource files so Filipino can follow. **Decide** (D8) |
| Age range | Readable for a 7-year-old: short sentences, no jargon ("Screen time is up", not "Quota exceeded") |
| Versioning | Send `appVersion` on every call. Show an update screen when `/sync` returns a `minAppVersion` above it (set on the server with `CHILD_MIN_APP_VERSION`, per platform) |
| Theme | Light and dark, following the system |

## 13. Server gaps

Found while writing this spec. Each needs a server change or a written decision before the app ships.

| # | Gap | Why it matters | Suggested fix |
|---|---|---|---|
| G1 | No way to wake the device. Changes arrive only on the next poll | iOS devices may poll hours apart; "Run a check" times out after 12 s | **Done (2026-10-14):** `/sync` takes `pushToken` (`Device.pushToken`); `wakeDevices` ([push.ts](../src/lib/push.ts)) sends a silent FCM message on new requests, guided "verify now", checks, app rules, extra time and device moves, and forgets dead tokens. Checks with an iOS device wait 30 s. Also fixed: `policy` in `/sync` now includes waiting changes, so an app that enforces `policy` (Android) no longer reverts and fails them |
| G2 | `SCHOOL_NIGHTS` isn't defined on the server; the family time zone isn't sent to the device | Parent and device may disagree about which nights count, and about "today" when the device's zone differs from the family's | **Done:** `bedtimeActive` / `isSchoolNight` in `protections.ts` define it (section 6); `/sync` returns `timezone` |
| G3 | Guided and verify-only protections assume the device can read the setting back. On iOS, settings the parent makes in the Settings app aren't readable by the Screen Time API, and usage totals can't leave the report extension | Web, Downloads and iOS screen-time charts may be unverifiable | Prototype. If unreadable, change the iOS capability to one the server can honestly check, or report a "can't verify" status (new `CheckStatus`) |
| G4 | Apps are keyed by display name only | Two apps with the same name collide; renamed apps lose their rules; iOS has no names | Add an optional `bundleId` / `packageName` to `/events`, `/usage` and the `apps` list |
| G5 | Done 2026-10-13: `ALWAYS_ALLOWED` and `FILTERED` are defined in section 7, as Android 1.0.9 enforces them | — | — |
| G6 | No device rename or unpair from the device | Name must be chosen before pairing; the child can't leave cleanly even with a parent present | `PATCH /device/v1/me { name }`; `DELETE /device/v1/me` with a parent approval |
| G7 | No website access requests on the phone | The browser extension has them; phones only block | Reuse `browser-access` for devices later |
| G8 | Events have no idempotency key | A retried event after a timeout can create a duplicate request | **Done:** optional `eventId`; a repeat within 7 days returns `duplicate: true` (section 9) |
| G9 | "Offline" takes 24 hours | A child who force-stops the app goes unnoticed for a day | A shorter "stopped reporting" alert for devices that normally sync every 5 minutes (Android only) |
| G10 | No minimum child-app version | Can't force an update after a protocol change | **Done:** `/sync` returns `minAppVersion` from `CHILD_MIN_APP_VERSION` (per platform, null when unset) |

## 14. Acceptance criteria

Pairing

- [ ] A valid code pairs in one call; the device appears on the parent's Devices page with its name, and the
      parent's pairing screen says "Paired".
- [ ] An expired, used or replaced code shows the invalid-code message; a browser code shows the server's message;
      a full plan shows the device-limit message and the code still works after a device is removed.

Verification (the core rule)

- [ ] After first setup, Configuration Health shows every supported protection as verified with no parent action on
      Android, and after the guided steps on iOS.
- [ ] A parent change to each `APPLY` protection reaches `VERIFIED` within one sync cycle on Android.
- [ ] If the OS rejects a setting, the device reports the real value and the request becomes `FAILED`, never
      `VERIFIED`.
- [ ] Revoking any permission or admin on the device raises the matching parent alert within one sync of the app
      next running.
- [ ] "Run a check" gets a full report inside 12 seconds from an online Android device.
- [ ] iOS never sends `NOTIFICATIONS`; it shows as Unsupported and doesn't lower the score.

Enforcement

- [ ] At the daily limit (weekend limit on Sat/Sun), non-allowed apps show the limit screen and `LIMIT_REACHED` is
      sent once.
- [ ] Bedtime windows that cross midnight block from start to end, on the right days.
- [ ] A `BLOCKED` app can't be used; opening it sends `APP_BLOCKED`. A `PENDING` app shows the waiting screen.
- [ ] Asking for an app creates one "App approval requested" alert; approving it in parent mode unblocks it on the
      next sync.
- [ ] The dialer and emergency calls work during bedtime and after the limit.
- [ ] All enforcement keeps working in airplane mode, using the last policy.

Reporting and privacy

- [ ] Parent screen-time totals match the device's own settings screen within 5 minutes a day (Android).
- [ ] No location is sent while sharing is off or permission is denied.
- [ ] A network capture of a full day shows calls to `eguard.family` only, with only the fields in section 11.
- [ ] Removing the device in parent mode makes the child app stop enforcing, show the removed screen, and delete
      its token.

Store

- [ ] Every sensitive permission has an in-app disclosure before the system prompt.
- [ ] Android shows the persistent notification whenever eGuard is active; the manifest has `IsMonitoringTool`.

Testing aids: the dev simulator ([src/lib/simulator.ts](../src/lib/simulator.ts)) goes through the same
`deviceSync` / `processReport` paths and is the reference for request and report shapes. Real devices paired
against a local server (`npm run dev`, with `APP_URL` reachable from the phone) exercise the rest. Add a
`tests/api/device.test.ts` suite for the device API before the app's beta; there isn't one today.

## 15. Open decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Android enforcement stack | On-device APIs (this spec) · Google Family Link · Android Enterprise / device owner | **Decided 2026-10-08: on-device APIs.** Family Link has no public API for a third-party app to set or read its rules, so eGuard couldn't verify them. The help article `android-family-link` says Family Link isn't needed |
| D2 | How Android shows the block screen | Overlay (`SYSTEM_ALERT_WINDOW`) · AccessibilityService | Overlay, with usage-stats polling. Accessibility only if overlay proves unreliable, since Play scrutinizes it |
| D3 | Age ratings for Android apps | Play parental controls (no read API) · a bundled rating list · parent decides per app | **Decided 2026-10-14:** Play parental controls, as capability `PARENT_SET` ("Set by you"): guided steps, confirmed by the parent, never shown as verified and not counted in health. Applies to `CONTENT` too. A server-side rating lookup (G4) could make it verifiable later |
| D4 | iOS app identity and usage data | `FamilyActivityPicker` tokens chosen by the parent · threshold-only reporting | Prototype first (G3). This decides what the iOS listing can promise |
| D5 | Always-allowed apps during bedtime and limits | Fixed list · parent picks | Fixed (phone, messages, eGuard) in v1; parent-chosen via `ALWAYS_ALLOWED` later |
| D6 | Certificate pinning | Pin CA · none | Pin the CA with a backup pin |
| D7 | Parent PIN on the child's device (to pause rules or unpair) | None · PIN set in parent mode | None in v1; do G6 first |
| D8 | Launch languages | English · English and Filipino | English; Filipino in the first update |
