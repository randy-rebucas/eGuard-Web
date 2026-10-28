# eGuard Mobile API — v1 (parents and children)

eGuard ships **one app** for Android and iOS. The same install runs either as a **parent's app** (parent mode) or as
the **app on a child's phone or tablet** (child device mode). Each mode talks to its own API with its own credential,
and neither API accepts the other's token.

---

## Contents

**Part A: One app for parents and children**

- [A1. Parent vs child at a glance](#a1-parent-vs-child-at-a-glance)
- [A2. Choosing a mode](#a2-choosing-a-mode)
- [A3. Rules that keep the two modes apart](#a3-rules-that-keep-the-two-modes-apart)
- [A4. Moving between modes](#a4-moving-between-modes)
- [A5. One codebase, two modes](#a5-one-codebase-two-modes)
- [A6. Where the two sides meet](#a6-where-the-two-sides-meet)

**Part B: Parent API** (`/api/mobile/v1`)

- [P1. Conventions](#p1-conventions) · [P2. Shared objects](#p2-shared-objects) ·
  [P3. Screen → endpoint map](#p3-screen--endpoint-map)
- [P4. Endpoints](#p4-endpoints):
  [Public](#p41-public-no-sign-in) · [Auth](#p42-auth) · [Me](#p43-me-account-and-preferences) ·
  [Dashboard & health](#p44-dashboard-and-configuration-health) ·
  [Onboarding](#p45-onboarding-profiles-recommendations-setup) · [Children](#p46-children) ·
  [Protections & batches](#p47-protections-and-configuration-batches) · [Screen time](#p48-screen-time) ·
  [Apps](#p49-apps) · [Location](#p410-location) · [Alerts](#p411-alerts) ·
  [Devices & checks](#p412-devices-and-configuration-checks) · [Family & privacy](#p413-family-members-and-privacy) ·
  [Subscription](#p414-subscription) · [Help & support](#p415-help-and-support)
- [P5. Flows](#p5-flows) · [P6. Enums and config reference](#p6-enums-and-config-reference) ·
  [P7. Known gaps](#p7-known-gaps)

**Part C: Child device API** (`/api/device/v1`)

- [C1. Conventions](#c1-conventions) · [C2. Shared objects](#c2-shared-objects)
- [C3. Endpoints](#c3-endpoints): [Pair](#post-pair--201) · [Sync](#post-sync) · [Report](#post-report) ·
  [Usage](#post-usage) · [Location](#post-location) · [Events](#post-events)
- [C4. Flows](#c4-flows) · [C5. Enums and config reference](#c5-enums-and-config-reference) ·
  [C6. What the parent sees](#c6-what-the-parent-sees) · [C7. Known gaps](#c7-known-gaps)

---

## Part A: One app for parents and children

There is no separate parent app or child app. The person setting up the install says who it's for, and from then on
the app runs in exactly one mode, against exactly one API, with exactly one credential.

### A1. Parent vs child at a glance

| | Parent mode | Child device mode |
|---|---|---|
| **Who holds the phone** | A parent or guardian (18+), signed in | A child. Nobody signs in: the device is paired to one child |
| **Accounts** | Every parent has an eGuard account (`FAMILY_ADMIN` or `PARENT`) | Children never have accounts. A child exists only as a profile a parent created |
| **API** | Parent API, `/api/mobile/v1` ([Part B](#part-b-parent-api)) | Child device API, `/api/device/v1` ([Part C](#part-c-child-device-api)) |
| **Credential** | Session token from `/auth/login`, `/auth/register/verify`, `/auth/social` (or after two-step verification) | Device token from `POST /pair`, using a code a parent made |
| **Lifetime** | 30 days. Ends on sign-out, password change, "sign out other sessions", or removal from the family | Doesn't expire. Ends only when a parent removes the device, or deletes the child or the family |
| **Can it be recovered?** | Sign in again | No. Only a hash is kept on the server; a lost token means pairing again |
| **Storage** | iOS Keychain / Android EncryptedSharedPreferences | Android Keystore (EncryptedSharedPreferences) / iOS Keychain shared with the extensions through the App Group |
| **A `401` means** | The session ended: clear it and show sign-in | The device was removed: stop enforcing, wipe local data, show the removed screen |
| **Scope of data** | The whole family: all children, devices, alerts, settings, subscription | Its own child only: that child's policy, open changes and app rules |
| **Direction** | Reads state and **asks for** changes | **Applies** changes and **reports** what the OS really has |
| **Requests** | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `POST` only |
| **Errors** | `{ error, code }`. Branch on `code` | `{ error }`, no `code`. Branch on the status |
| **Extra headers** | `X-eGuard-Client: ios\|android`, readable `User-Agent` | None. `appVersion`, `osVersion` and `battery` go in request bodies |
| **"Today"** | Family time zone (`user.family.timezone`), pre-formatted `…Label` fields | Family time zone from `/sync` `timezone`. `/usage` dates use the device's local date |
| **Keeping up to date** | Poll `GET /batches/{id}` / `GET /checks/{id}` every 1–2 s while a screen waits | `POST /sync` every `nextSyncSeconds` (300 s), at start, after boot and when the network returns |
| **Version check** | `GET /app-info` `minimumAppVersion` | `/sync` `minAppVersion` |
| **Push** | `POST /me/push-tokens` (FCM) | `pushToken` on `/sync`; a silent `{ type: "sync" }` FCM message means "sync now" |
| **Sensitive permissions** | None (photo picker only) | Usage access, location, VPN, device admin, Screen Time (Family Controls)… |
| **Screens** | Dashboard, children, protections, screen time, apps, location, alerts, devices, family, organizations, subscription, help ([P3](#p3-screen--endpoint-map)) | The child's own protections, block screens, "Ask a parent" for apps, setup and removal ([child-app-spec.md](child-app-spec.md)) |
| **Payments** | Shows the plan; Android may buy through Google Play when `billingAvailable` | Never shown |
| **Organizations** | Join, leave, see a sponsored plan; manage organizations they admin | Never shown |
| **Leaving the mode** | Any time, from Settings | Only after a parent removes the device |

The store user is the parent in both modes (target age 18+, not the Families program; see
[app-listing.md](app-listing.md)).

### A2. Choosing a mode

The app stores one value, `mode`, in encrypted storage: `UNSET`, `PARENT` or `CHILD`. Launch routes on it:

```
                 launch
                   │
      mode? ───────┼────────────────┬──────────────────────────┐
      UNSET        │ PARENT         │ CHILD                    │
        │          │                │                          │
 "Who's using      │ parent token?  │ device token?            │
  this device?"    │  no → Sign in  │  no → wipe, mode = UNSET │
        │          │  yes → Home    │  yes → Child home        │
        ▼          ▼                ▼                          ▼
```

**First launch: "Who's using this device?"**

| Choice | Goes to | `mode` becomes |
|---|---|---|
| **"I'm a parent or guardian"** | Welcome → sign in or create an account ([P3](#p3-screen--endpoint-map) screens 1–3) | `PARENT`, once sign-in succeeds |
| **"This is my child's device"** | Child setup: enter the pairing code, name the device, grant permissions ([C4.1](#c41-pairing)) | `CHILD`, once `POST /pair` returns `201` |

Until sign-in or pairing succeeds, the person can go back and choose again. Picking an option never sets `mode` by
itself.

**On every later launch:**

- **Parent mode:** `GET /app-info` (force update, which sign-in buttons to show), then `GET /dashboard`
  ([P5.1](#p51-app-launch)).
- **Child device mode:** `POST /sync` (policy, changes, `minAppVersion`), then enforce the saved policy
  ([C4.2](#c42-the-sync-cycle)). Enforcement keeps running offline from the saved policy.

### A3. Rules that keep the two modes apart

1. **One mode at a time.** The app never holds a parent token and a device token together. Switching deletes the old
   credential before the new mode starts.
2. **Each mode calls only its own API.** Parent code never calls `/api/device/v1` (except `POST /pair` in the
   "Set up this device for a child" shortcut, [A4](#a4-moving-between-modes)); child code never calls
   `/api/mobile/v1`. A token sent to the wrong API gets `401`.
3. **No parent credentials on a child's device.** Child device mode can't open parent screens, and there is no
   "parent unlock" on the child's device. A parent manages the child from their own phone or the web.
4. **The child can't switch modes.** Leaving child device mode needs a parent to remove the device from their app
   (`DELETE /devices/{id}`, password or "DELETE" confirmation) or from the web.
5. **Deep links and notifications respect the mode.** Email verification, password reset and invitation links are for
   parents. In child device mode, show *"Open this link on your parent's phone or at eguard.family"* instead of
   handling them. No parent screen is reachable in child device mode through links, notifications or the back stack.
6. **Mode-specific code stays apart.** Parent screens never read device-token storage, and child screens never read
   the parent session ([A5](#a5-one-codebase-two-modes)).
7. **No analytics, ads or tracking SDKs anywhere in the app.** The same binary runs on children's devices, so the
   child-app privacy rule applies to the whole app, not just one mode.

### A4. Moving between modes

| From → to | How | What the app does |
|---|---|---|
| Unset → parent | Sign in or create an account | Save the session token, `mode = PARENT` |
| Unset → child | Pair with a code from a parent | Save the device token, `mode = CHILD` |
| Parent → parent (another account) | Sign out, sign in | As usual |
| Parent → unset | Settings › Sign out | `POST /auth/logout?pushToken=…`, delete the token, `mode = UNSET`, back to "Who's using this device?" |
| **Parent → child** | Settings › **Set up this device for a child** | See below |
| **Child → unset** | A parent removes the device; the child's device shows the removed screen | See below |

**Parent → child: "Set up this device for a child".** For a parent handing down an old phone or setting up a tablet
they're holding, without a second phone to read the code from.

1. Settings › **Set up this device for a child** (any parent; hidden when the family has no children).
2. Choose the child and confirm: *"You'll be signed out of eGuard on this device. It will become {child}'s device and
   can only be changed back by removing it from eGuard on another phone or on the web."*
3. `POST /api/mobile/v1/children/{id}/pairing-code` with the parent token. Handle `403 email_unverified` (show the
   verify banner), `409` (device limit) and `429` as in [P4.6](#p46-children).
4. Ask for the device name.
5. `POST /api/device/v1/pair` with that code. On `201`: save the device token, then
   `POST /auth/logout?pushToken=…`, delete the parent token and set `mode = CHILD`.
6. Continue child setup at the permissions step.

If pairing fails, the parent stays signed in and nothing changes. If sign-out fails (offline), delete the parent
token locally anyway: the session expires on the server within 30 days and the parent can end it from
**Sessions** (`DELETE /me/sessions`).

**Child → unset: after removal.**

1. A parent removes the device (`DELETE /api/mobile/v1/devices/{id}`), or deletes the child or the family.
2. The child's device gets `401` on its next call. It stops enforcing, deletes the device token, saved policy and
   queue, and releases device admin / clears `ManagedSettings`.
3. The removed screen: *"This device was removed from eGuard by your parent."* with **Set up eGuard again**
   (`mode = UNSET`, back to "Who's using this device?") and **Close**.

Nothing from the device's past (usage, settings) is kept, so the next mode starts clean. The device can't unpair
itself ([C7](#c7-known-gaps) G6).

### A5. One codebase, two modes

One codebase, split into modules so each mode pulls in only what it needs.

| Module | Used by | Contents |
|---|---|---|
| `core-ui` | Both | Theme (light and dark), typography, components, icons (Lucide names → SF Symbols / Material), strings |
| `core-net` | Both | HTTP client, TLS settings and pinning, JSON, retry. Two error mappers: by `code` for the parent API, by status for the device API |
| `parent` | Parent mode | Parent API client and every parent screen, including Organizations |
| `child` | Child device mode | Device API client, sync engine and offline queue, enforcers, block screens, iOS extensions |
| `app` | Both | Launch routing on `mode`, "Who's using this device?", mode switching, push registration |

On Android these are Gradle modules (`:core-ui`, `:core-net`, `:parent`, `:child`, `:app`); on iOS, Swift packages
plus the app and extension targets. The iOS extensions (`DeviceActivityMonitor`, `ShieldConfiguration`) depend only
on `child` and `core-*`.

**Shared behavior:**

- **Base URL** `https://www.eguard.family`, with a debug override for a dev server on the LAN. Each module adds its
  own path (`/api/mobile/v1` or `/api/device/v1`).
- **Update screen:** one "Please update" screen, triggered by `minimumAppVersion` in parent mode and `minAppVersion`
  in child device mode.
- **Push:** one FCM token per install. In parent mode register it with `POST /me/push-tokens`; unregister
  (`logout?pushToken=`) before switching to child device mode. Tokens belong to the account, not the session, so
  when a request answers `401` (session ended elsewhere, password changed) delete the FCM token too: FCM then
  reports it gone and the server drops it, instead of this phone getting the family's alerts while signed out.
  Android shows alerts on the `parent_alerts` channel, which the server names in each message.
- **Accessibility and language** follow [child-app-spec.md](child-app-spec.md) in both modes.

### A6. Where the two sides meet

The two APIs never call each other. They share one family's data on the server, and meet at three points.

**1. Pairing** links a child's device to a child profile:

```
parent app   POST /api/mobile/v1/children/{id}/pairing-code   → code (8 chars, 15 min, single use)
             (parent reads the code to the child's device, or uses "Set up this device for a child")
child app    POST /api/device/v1/pair { code, platform, name, model, osVersion }   → device token
server       "New device synchronized" alert to parents; first /sync asks for a full report
```

**2. A setting change** travels from parent to device and is only "saved" once the device proves it:

```
parent   PUT  /children/{id}/protections/BEDTIME      → Batch, request PENDING
device   POST /sync      → change arrives in `requests`  → DELIVERED
device   apply it, read the real value back from the OS
device   POST /report    → matches: VERIFIED · differs: FAILED ("Device reported …")
parent   GET  /batches/{id}   (polled every 1–2 s)    → "Saved and verified"
```

A parent never sees a setting as saved until the device's report verifies it. Guided protections on iOS (Web,
Downloads, Location) are changed by hand on the child's device; the parent taps "Verify now"
(`POST /batches/{id}/confirm`) and the device's next full report verifies them.

**3. Everything the device sends** shows up for parents: usage in screen time, fixes on the map, events as alerts
and app requests, reports in Configuration Health. The full mapping is in
[C6. What the parent sees](#c6-what-the-parent-sees).

**Same vocabulary on both sides.** Both APIs use the same 10 protection keys and config shapes, the same platform
capabilities (`AVAILABLE`, `GUIDED`, `VERIFY_ONLY`, `PARENT_SET`, `UNSUPPORTED`) and the same app `approval` values. Parents may
only set values within the "Parent range"; devices report the real value within the wider "Reported range"
([C5](#c5-enums-and-config-reference)).

---

## Part B: Parent API

For **parent mode**: a parent or guardian signed in on their own phone.

- **Base URL:** `https://www.eguard.family/api/mobile/v1`
- **Format:** JSON in and out, UTF-8. The only exception is child photos (raw image bytes).

### P1. Conventions

#### Authentication

Sign in (`/auth/login`, `/auth/register/verify` or `/auth/social`) returns:

```json
{ "token": "<opaque string>", "expiresAt": "2026-10-27T05:59:56.772Z", "user": { …User } }
```

- Send `Authorization: Bearer <token>` on every request except the [public endpoints](#p41-public-no-sign-in).
- Store the token in the **Keychain** (iOS) or **EncryptedSharedPreferences** (Android). It lasts **30 days**.
- The token is a normal eGuard session, the same kind the website uses. It is revoked when the parent:
  - signs out (`POST /auth/logout`)
  - changes their password on another device
  - taps "sign out other sessions" anywhere
  - is removed from the family
- **Any `401` means the token is no longer valid.** Clear it and show the sign-in screen.

#### Headers

| Header | When | Value |
|---|---|---|
| `Authorization` | every signed-in call | `Bearer <token>` |
| `Content-Type` | requests with a body | `application/json` (photos: the image type) |
| `X-eGuard-Client` | every call (recommended) | `ios` or `android`. Configuration history then reads "Randy Cruz on iOS app" |
| `User-Agent` | automatic | Shown to the parent in the sessions list, so make it readable, e.g. `eGuard/1.0 (iPhone; iOS 18.1)` |
| `X-eGuard-Install` | every sign-in call (recommended on all) | A random id (UUID) the app makes once per install and keeps in secure storage; a new one after reinstalling. Signing in from an install the parent hasn't used before emails them "New sign-in to your eGuard account". Without it, the app is told apart only by platform, so a second iPhone isn't noticed. 8–64 of `A–Z a–z 0–9 _ -` |

#### Errors

Every error has the same shape. `error` is always written for the parent and safe to show as-is.

```json
{ "error": "That email and password don't match an eGuard account.", "code": "invalid_credentials" }
```

| Status | `code` | Meaning / what the app should do |
|---|---|---|
| 400 | `invalid`, `invalid_json`, `confirm_required` | `confirm_required`: a deletion by a parent without a password didn't include `confirm: "DELETE"` (see [Confirming deletions](#confirming-deletions)). Otherwise validation failed. For body fields, `error` starts with the field path, e.g. `"email: Enter a valid email address."`, so you can highlight the field |
| 401 | `unauthorized`, `invalid_credentials`, `invalid_token` | Session gone (sign out locally), wrong password, or a rejected Apple/Google token |
| 403 | `forbidden`, `wrong_password`, `password_not_set`, `email_unverified` | Family-admin-only action, a password confirmation was wrong, changing the email of an account without a password, or pairing a device, creating an organization or paying (a web plan or sponsor codes) before verifying email |
| 404 | `not_found` | Doesn't exist **or belongs to another family**. The API never reveals which |
| 409 | `conflict`, `unsupported`, `not_dismissible` | Duplicate email/app, device limit reached, protection unsupported on the child's devices, alert can't be dismissed |
| 413 | `too_large` | Photo over 2 MB |
| 415 | `unsupported_media_type` | Photo isn't a JPEG/PNG/WebP/HEIC, or its bytes don't match its declared type |
| 429 | `rate_limited` | Too many tries, e.g. 10 failed sign-ins for one account from one address in 15 minutes (see `POST /auth/login`) |
| 501 | `provider_not_configured` | Apple/Google sign-in isn't enabled on this server (check `/app-info` first) |
| 500 | `server_error` | Unexpected. Show `error` and let the parent retry |

#### Confirming deletions

Deleting the account, a child, a device or a browser needs a confirmation in the body:

| `user.hasPassword` | Body | Show |
|---|---|---|
| `true` | `{ "password": "…" }` | A password field. Wrong: `403 wrong_password`; too many wrong tries: `429 rate_limited` |
| `false` (Apple/Google sign-in) | `{ "confirm": "DELETE" }` | "Type DELETE to confirm". Anything else: `400 confirm_required` |

A parent with a password can't use `confirm` instead of it.

#### Data types

- **IDs** are opaque strings (cuid or UUID). Don't parse them.
- **Timestamps** are ISO-8601 UTC (`2026-09-27T05:28:40.136Z`).
- **Calendar days** are `YYYY-MM-DD` in the **family's time zone** (`user.family.timezone`, e.g. `Asia/Manila`).
- **Durations** are integer **minutes**.
- **`…Label` fields** (`timeLabel`, `lastSeenLabel`, `renewsLabel`, `policyLabel`, …) are pre-formatted English strings
  in the family's time zone. Use them as-is, or format the raw value yourself for localization.
- **`icon`** fields are [Lucide](https://lucide.dev/icons) icon names (`moon`, `hourglass`, `map-pin`, …). Map them to
  SF Symbols or Material icons in the app.
- **`hue`** is a child's avatar color as an HSL hue (0–360). The web uses `hsl(hue 70% 45%)`.

#### Pagination

Lists that can grow (`/alerts`, `/children/{id}/history`) use a cursor. Each response has `nextBefore`, which is an
ISO timestamp or `null` on the last page. To get the next page, send it back as `?before=<nextBefore>` (URL-encoded). Any ISO 8601 time with `Z` or an offset (`+08:00`) is accepted; anything else is `400`.

#### Polling

Configuration changes and checks complete asynchronously, because the child's device has to confirm them. Poll
`GET /batches/{id}` or `GET /checks/{id}` every **1–2 seconds** while the screen is visible, stop when `done: true`,
and give up after about 60 seconds with a "Waiting for the device" state. The parent can come back later; batches
keep their state.

---

### P2. Shared objects

These shapes are reused across endpoints. Fields marked `?` may be `null`.

#### User

Returned by `/me`, every sign-in, and `dashboard.user`.

```json
{
  "id": "cmujeom240002ncgsonpp12hl",
  "name": "Randy Cruz",
  "firstName": "Randy",
  "email": "randy@example.com",
  "role": "FAMILY_ADMIN",
  "emailVerified": true,
  "family": { "id": "cmujeoltx0000ncgsox90ftwt", "name": "Cruz Family", "timezone": "Asia/Manila" },
  "notifications": { "notifyPush": true, "notifyEmail": true, "notifyApproval": true, "weeklySummary": true, "productUpdates": true },
  "hasPassword": true,
  "twoFactor": false,
  "createdAt": "2026-09-27T05:56:40.493Z"
}
```

`hasPassword` is false for parents who signed up with Apple/Google and haven't set a password. For them, hide
"Change password" and point to "Forgot password?". Deleting the account asks them to type DELETE instead of a
password. `twoFactor` is true when two-step verification is on: signing in then needs a code (see
[Two-step verification](#two-step-verification-post-authtwo-factor)).

`role` is `FAMILY_ADMIN` or `PARENT`. Admin-only actions return `403` for a `PARENT`, so hide them in the UI:
- deleting a child
- adding or removing parents
- changing privacy settings and the family time zone

#### ChildSummary

Used in the children list, the dashboard and the family screen.

```json
{
  "id": "cmujeom2c0006ncgsd9tlg8pp",
  "name": "Mia",
  "age": 12,
  "birthYear": 2014,
  "hue": 205,
  "photoUrl": null,
  "status": "protected",
  "health": { "score": 10, "total": 10 },
  "dailyLimitMinutes": 180,
  "weekendLimitMinutes": 240,
  "todayLimitMinutes": 240,
  "todayMinutes": 134,
  "deviceCount": 2,
  "browserCount": 1,
  "primaryDevice": { "id": "cmujeom5j000wncgs0ylb00q4", "name": "Galaxy A54", "platform": "ANDROID" }
}
```

| Field | Notes |
|---|---|
| `status` | `protected` (all checks pass on devices that are all online), `attention` (something to fix, or a device offline), `notconfigured` (no devices yet). Design labels: "Protected" / "Attention" |
| `photoUrl?` | Path relative to the host. Load it **with the bearer header**. The `?v=` query changes when the photo changes, so cache by URL |
| `todayLimitMinutes` | The limit that applies today (weekday or weekend) |
| `deviceCount` / `browserCount` | Phones and tablets paired / browser extensions connected (one disconnected for security isn't counted). A child with `deviceCount: 0` and a browser is `notconfigured` (no phone to verify) but not empty: show "Browser only" where you'd show "No device", as the web does. Older servers omit `browserCount`: treat it as 0 |

#### Device

```json
{
  "id": "cmujeom5j000wncgs0ylb00q4",
  "childId": "cmujeom2c0006ncgsd9tlg8pp",
  "childName": "Mia",
  "name": "Galaxy A54",
  "model": "SM-A546E",
  "kind": "PHONE",
  "platform": "ANDROID",
  "osVersion": "Android 14",
  "appVersion": "4.2.1",
  "battery": 72,
  "isPrimary": true,
  "lastSeenAt": "2026-09-27T05:56:43.267Z",
  "lastSeenLabel": "Today, 1:56 PM",
  "state": "healthy",
  "issues": 0,
  "firstCheck": false
}
```

`state` is `healthy`, `issues` (`issues` > 0 protections not passing, counting ones the device hasn't reported yet:
a device that was just paired has `issues` equal to the number of protections until its first check) or `offline`
(no sync for over 24 h). `firstCheck` is `true` until the device's first report: show "Waiting for first check"
instead of the issue count, as the web does. `battery?`
and `appVersion?` may be null.

#### Alert

```json
{
  "id": "cmujeonst00hmncgsu9x9omxu",
  "childId": "cmujeon8u00cfncgs77ksjr1g",
  "deviceId": "cmujeonbc00d5ncgs3k2m4glb",
  "severity": "ATTENTION",
  "category": "PROTECTION",
  "icon": "moon",
  "title": "Bedtime not configured",
  "body": "No bedtime schedule is set on this device. Other protections are working.",
  "subject": "Sophie's iPhone 13",
  "fromValue": null,
  "toValue": null,
  "read": false,
  "resolved": false,
  "dismissible": false,
  "createdAt": "2026-09-27T03:56:42.748Z",
  "timeLabel": "Today, 11:56 AM",
  "day": { "key": "2026-09-27", "label": "Today" },
  "action": { "type": "FIX_SETTING", "label": "Set bedtime", "childId": "cmujeon8u00cfncgs77ksjr1g", "key": "BEDTIME" }
}
```

- Group lists into sections by `day.key`, using `day.label` as the header ("Today", "Yesterday", "Fri, Sep 25").
- `fromValue` / `toValue`, when present, show a before → after change (e.g. `9:30 PM – 6:00 AM` → `10:30 PM – 6:30 AM`).
- `action?` is the alert's button. Route it by `type`, and show no button for a `type` you don't know (new ones are
  added over time):

| `action.type` | Extra fields | Open |
|---|---|---|
| `FIX_SETTING` | `childId`, `key` | That protection's edit screen for the child ([§P4.7](#p47-protections-and-configuration-batches)) |
| `VIEW_DEVICE` | `deviceId` | Device detail |
| `REVIEW_APPS` | `childId` | App Management (Pending tab for requests) |
| `VIEW_SCREEN_TIME` | `childId` | Screen Time |
| `VIEW_HISTORY` | `childId` | Child profile › History |
| `MANAGE_SUBSCRIPTION` | none | Subscription (plan changes, passes ending, sponsor codes) |
| `VIEW_LOCATION` | `childId` | The child's places (location history), for "Mia arrived at School" |
| `REVIEW_SITE_REQUEST` | `childId`, `requestId` | The child's website requests (`GET /children/{id}/browser-access-requests`), with that request open to approve or deny |
| `VIEW_BROWSERS` | `childId` (or `null`) | The child's browser protection (`GET /children/{id}/browser-policy`); with `childId: null`, the family's browsers list (`GET /browsers`; a browser disconnected for security) |
| `VIEW_ORGANIZATIONS` | none | Settings › Organizations (joined or left an organization) |
| `VIEW_FAMILY` | none | Settings › Family (another parent accepted their invitation) |

Other account notices (`category: "SYSTEM"`) have no button. Before these types existed, every `SYSTEM` alert had
`MANAGE_SUBSCRIPTION` and website requests had `VIEW_HISTORY`.

#### Batch (configuration progress)

Returned by `PUT /children/{id}/protections/{KEY}`, `POST /children/{id}/setup` (as `progress`), and
`GET /batches/{id}`.

```json
{
  "batchId": "c8ff86dd-2ab7-416b-9295-345280db658a",
  "childId": "cmujesv1y00tlnckonhe1ztou",
  "done": false,
  "summary": { "total": 1, "verified": 0, "setByYou": 0, "failed": 0, "awaitingParent": 1, "inProgress": 0, "cancelled": 0 },
  "items": [
    {
      "key": "WEB",
      "name": "Web",
      "icon": "globe",
      "status": "AWAITING_PARENT",
      "to": "Adult and unsafe sites filtered",
      "devices": [
        {
          "requestId": "cmujesvhf00vnncko3bmhqh76",
          "deviceId": "cmujesv7400unncko2j3n890p",
          "deviceName": "Galaxy A54",
          "platform": "ANDROID",
          "mode": "GUIDED",
          "status": "AWAITING_PARENT",
          "failureReason": null,
          "offline": false,
          "parentSet": false,
          "from": "Off",
          "guide": [
            "Open Settings, tap Network & internet, then Private DNS. On Samsung: Connections, More connection settings, Private DNS.",
            "Choose Private DNS provider hostname.",
            "Type family.cloudflare-dns.com and tap Save."
          ]
        }
      ]
    }
  ],
  "health": { "score": 10, "total": 10 }
}
```

- One `item` per protection, and one entry in `devices` per device that supports it.
- `item.status` is the least-finished status across its devices.
- `summary.setByYou` counts the `verified` items that were set by the parent in Google Play (`parentSet` on every
  device): done, but not checked by a device. It's part of `verified`, so a progress bar keeps working; say
  "N verified, M set by you" where there's room.
- Request status goes `PENDING` → `DELIVERED` → `VERIFIED` or `FAILED`. Guided setup starts at `AWAITING_PARENT`, and a
  batch can also be `CANCELLED`.
- `failureReason?` explains a `FAILED` device, e.g. `"Device reported Rated 13+ and under"`.
- `offline: true` means the device hasn't synced for a day. Show "Waiting for the device to come online".
- `guide?` lists the steps the parent performs on the child's device (`mode: "GUIDED"`).
- `health` is the child's score right now. Use it for the "Configuration Health updated" moment.

**Important:** never show a setting as saved until its item is `VERIFIED`. This is a core product rule.

---

### P3. Screen → endpoint map

| # | Screen (design) | Calls |
|---|---|---|
| 1 | Splash | `GET /app-info` (force-update check, which sign-in buttons to show) |
| 2 | Welcome | none |
| 3 | Create Account | `POST /auth/register` then `POST /auth/register/verify` (code from the email), `POST /auth/social` (Continue with Apple/Google), `POST /auth/login` (Sign in) |
| 4 | Add Child | `POST /children` → `PUT /children/{id}/photo` |
| 5 | Protection Profile | `GET /profiles?age=` |
| 6 | Recommended Setup | `GET /children/{id}/recommendations?profile=` |
| 7 | Setup Progress | `POST /children/{id}/pairing-code` ("Set up supervision": Family Sharing on iOS; on Android the eGuard app itself, no Family Link; help articles `ios-family-sharing` / `android-family-link`), `POST /children/{id}/setup`, poll `GET /batches/{id}`, `POST /batches/{id}/confirm` |
| 8 | Configuration Health | `GET /health?childId=` ("Fix N settings" uses `toFix`) |
| 9 | Setup Complete | Use the last `GET /batches/{id}` (the verified items) |
| 10 | Dashboard | `GET /dashboard` |
| 11 | Child Profile | `GET /children/{id}` (Overview), `/screen-time`, `/apps`, `/protections`, `/history` |
| 12 | Screen Time | `GET /children/{id}/screen-time?period=today\|7d\|30d` |
| 13 | App Management | `GET /children/{id}/apps?filter=`, `PATCH /apps/{id}`, `POST /children/{id}/apps` (Request to Install App) |
| 14 | Location | `GET /children/{id}/location`, "View All" → `GET /children/{id}/location/visits`, `GET /locations` |
| 15 | Alerts | `GET /alerts?filter=`, `POST /alerts/{id}/read`, `/read-all`, `/dismiss`, `GET /alerts/unread-count` (includes "App blocked") |
| 16 | Settings | `GET /family`, `PATCH /family`, `/me`, `/me/notifications`, `/family/privacy`, `/me/sessions`, `POST /me/password`, `/me/two-factor`, `/me/identities`, `POST /me/export`, `DELETE /me`, `GET /organizations`, `POST /auth/logout` |
| 17 | Subscription | `GET /subscription`. Android upgrade: `GET /subscription/plans` → Play Billing → `POST /subscription/google-play` |
| 18 | Help & Support | `GET /help?q=`, `GET /help/{slug}`, `POST /support/tickets`. Share eGuard needs no endpoint: the system share sheet with the app's own text and `https://www.eguard.family/`, worded as the web's (`src/lib/share.ts`) |
| — | Tab-bar badge | `GET /alerts/unread-count` |
| — | Push registration | `POST /me/push-tokens` after sign-in, `DELETE` / `logout?pushToken=` on sign-out |

---

### P4. Endpoints

#### P4.1 Public (no sign-in)

##### `GET /app-info`

Call it on launch. Compare `minimumAppVersion` with the app's version and block with "Please update" if the app is
older. Show the Apple/Google buttons only when enabled.

```json
{
  "name": "eGuard",
  "apiVersion": "1",
  "minimumAppVersion": "1.0.0",
  "signIn": { "password": true, "apple": false, "google": false },
  "supportEmail": "support@devcomdigital.com"
}
```

##### `GET /help?q=&category=`

| Query | Type | Notes |
|---|---|---|
| `q` | string, optional | Every word must match the title, summary or body (case-insensitive) |
| `category` | `SETUP` \| `TROUBLESHOOTING` \| `PRIVACY` \| `FAQ`, optional | Invalid value → 400 |

```json
{
  "categories": [
    { "id": "SETUP", "name": "Setup Guides", "description": "Step-by-step instructions", "icon": "book-open" },
    { "id": "TROUBLESHOOTING", "name": "Troubleshooting", "description": "Common solutions", "icon": "wrench" }
  ],
  "articles": [
    { "slug": "device-offline", "category": "TROUBLESHOOTING", "title": "A device shows as offline",
      "summary": "Settings stay active, but eGuard can't verify them until the device reconnects." }
  ],
  "contact": { "email": "support@devcomdigital.com", "replyTime": "Replies within 1 business day" }
}
```

##### `GET /help/{slug}`

Returns one article with `body` as an array of paragraphs, or `404`.

```json
{
  "slug": "device-offline",
  "category": "TROUBLESHOOTING",
  "title": "A device shows as offline",
  "summary": "Settings stay active, but eGuard can't verify them until the device reconnects.",
  "body": [
    "A device is offline when it hasn't synced for more than a day. Check that it's charged, connected to the internet, and that eGuard isn't restricted by battery saver.",
    "Once the device reconnects, eGuard verifies every protection again automatically."
  ]
}
```

#### P4.2 Auth

##### `POST /auth/register` → `202`

Create Account, step 1. Emails a 6-digit code to the address and returns the `signup` ticket that goes with it. **No
account exists yet**: step 2 (`/auth/register/verify`) creates it and signs in.

| Field | Type | Rules |
|---|---|---|
| `name` | string | ≥ 2 chars |
| `email` | string | valid email. Case doesn't matter; it's stored lowercase |
| `password` | string | 10–72 chars, and not one published in a data breach (`400`, "This password has appeared in a data breach…") |
| `familyName` | string, optional | ≥ 2 chars. Default: last name + " Family" ("Cruz Family"), or "Randy's Family" |
| `guardian` | `true` | Required. The "I'm a parent or legal guardian, 18 or older" checkbox. Children never get accounts; parents add them after sign-up |

Response: `{ verificationRequired: true, signup, email, expiresAt }`. Keep `signup` in memory for step 2 (it lasts
15 minutes); show "Check your email" with a 6-digit code field.

**The answer is the same whether or not the email already has an account**, so the form can't be used to find out
who uses eGuard. That inbox gets "You already have an eGuard account" (with sign-in and reset links) instead of a
code, and no code finishes that sign-up. Don't show anything different; the parent reads the email. One account per
mailbox: `randy+kids@…`, and for Gmail `r.andy@gmail.com` / `randy@googlemail.com`, count as `randy@gmail.com`.

Errors: `400` (field message, e.g. `guardian: Confirm you're a parent…`, or the breached-password message), `429`
(10 sign-ups an hour from one address).

##### `POST /auth/register/verify` → `201`

Create Account, step 2. `{ signup, code }`. Creates the family with this parent as `FAMILY_ADMIN`, email already
verified (`user.emailVerified: true`), and signs in: `{ token, expiresAt, user }` like `/auth/login`.

| Error | What to show |
|---|---|
| `400 wrong_code` | The `error` text; let them try again (5 tries per code) |
| `400 signup_expired` | The `error` text and a button back to the form: the code expired (15 min), was used up, or had 5 wrong tries |
| `409 conflict` | Only if the email was taken in the minutes between the steps: "Sign in instead" |

A double tap is safe: the first finishes, the second gets `400`/`409`, never a second account.

##### `POST /auth/register/resend` → `200`

"Send a new code". `{ signup }` → `{ ok: true, email, expiresAt }`. The previous code stops working, and tries start
again. Once a minute (`429` sooner) and 5 emails per sign-up (`429`: fill in the form again). `400 signup_expired` as
above.

##### Email verification

Parents must verify their email before they can pair a child's device. Everything else works while unverified.

- New sign-ups prove their email with the code, so they start verified. Parents added by the admin and anyone who
  changes their email get a link:
  `{APP_URL}/verify-email?token=…`. It works once, expires after 24 hours, and stops working if a newer link is sent or the email changes.
- Apple / Google sign-ins count as verified, because the provider has already verified the email.
- While `user.emailVerified` is `false`, show a "Verify your email" banner with a **Resend link** button.
- `POST /children/{id}/pairing-code` returns `403 email_unverified` until the parent verifies. Show the error message and the resend button.
- After the parent taps the link, refresh `GET /me`.

| Endpoint | Body | Response |
|---|---|---|
| `POST /me/verify-email` | none | Sends a new link. `202 { sent: true, email }`, or `200 { sent: false, email }` if already verified. `429 rate_limited` if a link went out in the last minute |
| `POST /auth/verify-email` (no auth) | `{ token }` | For apps that open the link themselves (universal link / app link). `200 { ok: true }`, `400 link_expired` or `400 link_invalid` (used, replaced or unknown) |

Otherwise the link opens a web page, where the parent taps **Verify my email**. The link doesn't verify on page load, so email scanners that open links can't use it up.

##### `POST /auth/login` → `200`

```json
{ "email": "randy@example.com", "password": "ChangeMe123!" }
```

Response: `{ token, expiresAt, user }`, or `{ twoFactorRequired: true, challenge, expiresAt }` when the parent has
two-step verification on (see below). Errors: `401 invalid_credentials`, `429 rate_limited`. After 10 wrong
passwords in 15 minutes from one address, that address can't sign in to the account for the rest of the window, even
with the right password; other addresses (the parent's own phone) still can, unless the account has 50 wrong
passwords from everywhere in that time. Offer "Forgot password?" on `429`, since a reset lifts every lock.

##### `POST /auth/forgot-password` → `202`

`{ "email": "randy@example.com" }`. Emails a link to `/reset-password?token=…` (valid for 1 hour, single use) if an
account uses that address. The response is the same whether or not one does:
`{ ok: true, message }`. Show the message. Also how Apple/Google parents set their first password. `429` after
too many requests from one address.

##### `POST /auth/reset-password` → `200`

`{ "token": "<from the link>", "password": "at least 10 characters" }`. For apps that open reset links
themselves. Sets the password, **signs out every session**, and returns a new one: `{ token, expiresAt, user }`
(or `twoFactorRequired`, like sign-in: an emailed link alone never gets past two-step verification).
Errors: `400 invalid` (password too short), `400 link_invalid` (used, replaced or unknown), `400 link_expired`.

##### Invitations (no auth): `GET /auth/invite`, `POST /auth/accept-invite`, `POST /auth/decline-invite`

When a family admin invites another parent, the invitee gets an email linking to `/accept-invite?token=…` (valid
7 days, single use). For apps that open that link themselves:

| Call | Body / query | Response |
|---|---|---|
| `GET /auth/invite?token=…` | | `{ name, email, familyName, invitedBy }`. Show which family it is **before** they accept. `400 link_invalid` / `400 link_expired` |
| `POST /auth/accept-invite` | `{ token, password }` (their own, ≥ 10 characters) | Same as sign-in: `{ token, expiresAt, user }`. Their email counts as verified. `400 invalid`, `link_invalid`, `link_expired` |
| `POST /auth/decline-invite` | `{ token }` | `{ ok, familyName }`. Nothing about them stays with the family |

Until they accept, the invitee can't sign in. A pending invitation never blocks them: signing up (or with
Apple/Google) at that address creates their own family and drops the invitation. "Forgot password" for that
address emails the invitation again rather than a reset link.

##### `POST /auth/social` → `200` (existing account) / `201` (new account)

"Continue with Apple / Google". Send the **ID token** (JWT) from the native SDK, not an authorization code.

| Field | Type | Notes |
|---|---|---|
| `provider` | `"apple"` \| `"google"` | |
| `idToken` | string | iOS: `ASAuthorizationAppleIDCredential.identityToken` (UTF-8). Google: `GIDGoogleUser.idToken.tokenString` / Android `GoogleIdTokenCredential.idToken` |
| `name` | string, optional | Apple only gives the name on the **first** authorization. Forward `fullName` so the account gets a name |
| `guardian` | boolean, optional | Needed only when this creates a new account. Without it, a new sign-up gets `400 guardian_required`: show the parent/guardian (18+) confirmation and retry the same `idToken` with `guardian: true` |
| `nonce` | string (16–128), optional | The raw one-time nonce. Apple: put its SHA-256 (hex) in `ASAuthorizationAppleIDRequest.nonce`. Google: pass it as the request's nonce. When the token carries a nonce it must match, and a nonce sent with a token that has none is refused (`401 invalid_token`); retries with `guardian: true` reuse the same nonce |

Response: `{ token, expiresAt, user, isNew }`, or `{ twoFactorRequired: true, challenge, expiresAt, isNew: false }`
when the linked account has two-step verification on. Continue with onboarding when `isNew` is true.

- If the provider account is already linked, the parent is signed in.
- Otherwise, an existing eGuard account with **exactly** the same email gets linked. Aliases (`+tag`, Gmail dots)
  never link, and get `409 conflict` asking the parent to sign in with their password. If that account's email
  was never verified, whoever registered it is signed out and their password stops working.
- Otherwise, a new family is created.

Errors: `400 email_required` (no verified email; Apple "Hide my email" relay addresses are fine),
`401 invalid_token`, `501 provider_not_configured`.

> Server setup: the ID token's audience must be listed in `APPLE_CLIENT_IDS` (the iOS bundle ID) or
> `GOOGLE_CLIENT_IDS` (the iOS and Android OAuth client IDs). Send these IDs to the backend team.

##### Two-step verification: `POST /auth/two-factor`

When `/auth/login`, `/auth/social` or `/auth/reset-password` answer `{ twoFactorRequired: true, challenge, expiresAt }`,
no session exists yet. Ask for the 6-digit code from the parent's authenticator app (offer "Use a recovery code"
too), then:

```json
{ "challenge": "<from the sign-in response>", "code": "123456" }
```

Response: `{ token, expiresAt, user }`, plus `usedRecoveryCode: true, recoveryCodesLeft` when a recovery code was
used (tell the parent it's used up, and suggest new codes when few are left). Errors: `400 wrong_code` (try
again), `401 challenge_expired` (10 minutes passed, 5 wrong codes, or already used: go back to the sign-in screen),
`429 rate_limited`. Each authenticator code works once.

##### `POST /auth/logout[?pushToken=<token>]` → `200`

Ends this session only. Pass the device's push token so this phone stops receiving pushes for this parent. Response:
`{ "ok": true }`.

#### P4.3 Me (account and preferences)

| Method & path | Body | Response |
|---|---|---|
| `GET /me` | none | `User` |
| `PATCH /me` | any of `{ name, email, password, timezone }` | `User`. `timezone` (IANA, e.g. `Asia/Manila`) is the family's, stored with proper casing (`asia/manila` → `Asia/Manila`); fixed offsets like `+08:00` are `400`. Only the family admin can change it (`403 forbidden` for another parent sending a different zone). Changing `email` needs the current `password` (`403 wrong_password`, or `403 password_not_set` when `hasPassword` is false). `409` if the email is taken. A new email sets `emailVerified: false`, sends a link to the new address, and unlinks Apple/Google sign-ins |
| `DELETE /me` | `{ password }`, or `{ confirm: "DELETE" }` when `hasPassword` is false ([Confirming deletions](#confirming-deletions)) | `{ ok, deleted: "family" \| "account" }`. **Deletes the account.** The family admin's account deletes the whole family (children, devices, history, other parents). Another parent's account removes only them. Sign out locally afterwards |
| `POST /me/export` | none | The family's data as a JSON file (`Content-Disposition: attachment; filename="eguard-family-export.json"`): parents, children, settings, devices, app rules, screen time, location visits, history, alerts, browsers, support requests and purchases. Never includes passwords or tokens. Save it or hand it to the share sheet. Any parent can export; each export is recorded in the family's audit log. Same file as the website's export |
| `GET /me/identities` | none | `{ identities: [{ id, provider, email, createdAt }] }`: linked sign-ins. `provider` is `apple`, `google` or `linkedin` (LinkedIn is linked on the website only; show any other value as is) |
| `DELETE /me/identities/{id}` | none | `{ ok }`. `409` if it's the only way to sign in (no password set) |
| `POST /me/password` | `{ current, next }` | `{ ok, message }`. `403 wrong_password`, `400` if `next` < 10 chars. **Signs out every other session**; this one stays. The parent is emailed that it changed (as for an email change, to the old address, and for turning off two-step verification) |
| `GET /me/notifications` | none | `{ notifyPush, notifyEmail, notifyApproval, weeklySummary, productUpdates }`. `notifyEmail` emails alerts that need attention; `notifyPush` pushes the same alerts to this parent's phones (every plan: all of them with `realtimeAlerts`, security alerts only otherwise, see `pushScope`); `notifyApproval` also sends a child's requests for an app or a blocked website, by whichever of email and push is on; `productUpdates` is the eGuard team's emails about new features (notices about the account, privacy or security are sent regardless) |
| `PATCH /me/notifications` | any subset of those booleans | Same object, updated. Send only what changed. Push can be turned on on every plan |

Both answers also carry `pushScope`: `"all"` with `realtimeAlerts`, `"security"` otherwise (only alerts that eGuard was
removed, tampered with or a protection turned off: category `PROTECTION` or `DEVICES` with severity `ACTION_REQUIRED`
or `CRITICAL`). With `"security"`, say so under the switch ("Security alerts only") and leave it usable.
`pushIncluded` is now always `true`; apps that lock the switch when it's false keep working.
| `POST /me/push-tokens` | `{ token, platform: "IOS" \| "ANDROID" }` | `201 { ok }`. `token` is an **FCM registration token** on both platforms (iOS: from the Firebase Messaging SDK, not the raw APNs token). Call it after sign-in and whenever FCM rotates the token. Re-registering the same token under another parent moves it. Tokens FCM reports as uninstalled are removed |
| `DELETE /me/push-tokens` | `{ token }` | `{ ok }` |
| `GET /me/sessions` | none | `{ sessions: [{ id, userAgent, createdAt, lastSeenAt, current }] }` |
| `DELETE /me/sessions` | none | `{ signedOut: n }`. Signs out everywhere except this session |
| `DELETE /me/sessions/{id}` | none | `{ ok: true }`. Signs out one other session (a lost phone). `404` for an unknown id or another parent's; `400 current_session` for this one (use `POST /auth/logout`). Push alerts to the phone it registered stop at once |

Push tokens (`POST /me/push-tokens`) are tied to the session that registered them: logging out, "sign out everywhere
else", a single sign-out or the session expiring deletes the token, so the phone stops getting the family's alerts.
Register the token again after signing in.
| `GET /me/two-factor` | none | `{ available, enabled, recoveryCodesLeft }`. `available` false: the server isn't set up for it; hide the option |
| `POST /me/two-factor/setup` | none | `{ secret, uri }`. Show `uri` (an `otpauth://` link) as a QR code, or open it to hand it to an authenticator app on this phone; show `secret` for typing in by hand. Calling again replaces the secret. `409` if already on |
| `POST /me/two-factor/confirm` | `{ code }` | `{ recoveryCodes: [10 strings] }`. A code from the app turns it on. **Show the recovery codes once** with copy/save; they're never returned again. `400 wrong_code`, `400 setup_missing` |
| `POST /me/two-factor/recovery-codes` | `{ code }` (authenticator or recovery code) | `{ recoveryCodes }`. The old codes stop working |
| `DELETE /me/two-factor` | `{ code }` (authenticator or recovery code) | `{ available, enabled: false, recoveryCodesLeft: 0 }`. Turns it off |

#### P4.4 Dashboard and Configuration Health

##### `GET /dashboard`

One call for the whole Home tab.

```json
{
  "user": { …User },
  "greeting": "Good afternoon,",
  "summary": "1 child needs attention.",
  "health": { "score": 8, "total": 10, "offline": 1, "verified": false, "label": "Good protection" },
  "children": [ …ChildSummary ],
  "deviceCount": 5,
  "browserCount": 1,
  "recentAlerts": [ …Alert (up to 3) ],
  "unreadAlerts": 4
}
```

`deviceCount` is phones and tablets; `browserCount` is connected browser extensions (not ones disconnected for
security). Each takes a slot of the plan's device limit, so show `deviceCount + browserCount` where the web's
Devices card shows its total.

`recentAlerts` are open alerts, most severe first and then newest (as on the web dashboard), so newer info never
pushes a critical alert off the Home tab.

`summary` is one of:
- "Add your first child to get started." when the family has no children yet (show the Add Child call to action)
- "N children need attention." / "1 child needs attention."
- "Pair Mia's device to start protecting them." or "N children have no paired device yet." when a child has no device
  (show the pairing call to action: the first child in `children` with `deviceCount: 0`, opening its pairing screen.
  The web shows it whenever such a child exists, even when the summary leads with children needing attention)
- "Your family's digital safety looks good today."

##### `GET /health[?childId=]`

Configuration Health. There are 10 checks, one per protection, and each shows the least healthy device's status.
`UNSUPPORTED` never counts against the score. The score measures **configuration, not the child's behavior**.

```json
{
  "score": 8,
  "total": 10,
  "offline": 1,
  "verified": false,
  "label": "Good protection",
  "checks": [
    { "key": "SCREEN_TIME", "name": "Screen Time", "icon": "hourglass", "status": "PASS",
      "detail": "Verified on 4 of 5 devices; 1 offline, last known state" },
    { "key": "BEDTIME", "name": "Bedtime", "icon": "moon", "status": "NOT_CONFIGURED",
      "detail": "Not configured on Sophie's iPhone 13",
      "fixDeviceId": "cmujeonbc00d5ncgs3k2m4glb", "fixChildId": "cmujeon8u00cfncgs77ksjr1g" }
  ],
  "toFix": [
    { "key": "BEDTIME", "name": "Bedtime", "status": "NOT_CONFIGURED", "detail": "Not configured on Sophie's iPhone 13",
      "childId": "cmujeon8u00cfncgs77ksjr1g", "deviceId": "cmujeonbc00d5ncgs3k2m4glb" },
    { "key": "LOCATION", "name": "Location", "status": "WARNING", "detail": "Sharing turned off on Sophie's iPhone 13",
      "childId": "cmujeon8u00cfncgs77ksjr1g", "deviceId": "cmujeonbc00d5ncgs3k2m4glb" }
  ],
  "children": [ { "id": "cmujeom2c0006ncgsd9tlg8pp", "name": "Mia", "score": 10, "total": 10, "status": "protected" } ]
}
```

- The design's "Fix 2 settings" button is `toFix.length`. Each item opens `FIX_SETTING` for `childId` + `key`.
- `label`: 10/10 "Fully protected" ("Last known: all set" while a device is offline), 8–9 "Good protection",
  5–7 "Needs attention", below 5 "Action required". With no paired device it's "No devices yet": show "–" rather
  than the score, which is 0 only because nothing can be checked.
  10/10 with a device offline is "Last known: all set".
- `offline` counts devices that haven't synced in over a day. They're scored by their last known state, which isn't a
  verification: only say "verified" or "protected" when `verified` is true (every check passes and no device is offline).
- With `?childId=`, the score covers that child only and `children` is omitted.
- Check statuses and suggested colors: `PASS` green, `WARNING` amber, `ACTION_REQUIRED` red, `NOT_CONFIGURED` grey,
  `UNSUPPORTED` grey (with the label "Not supported").

#### P4.5 Onboarding: profiles, recommendations, setup

##### `GET /profiles?age=12`

```json
{
  "profiles": [
    { "id": "BALANCED", "name": "Balanced", "description": "Moderate limits for independent kids", "icon": "scale", "recommended": false },
    { "id": "PROTECTED", "name": "Protected", "description": "Stronger controls for younger children", "icon": "shield-check", "recommended": true },
    { "id": "CUSTOM", "name": "Custom", "description": "Choose settings yourself", "icon": "sliders-horizontal", "recommended": false }
  ]
}
```

| Profile | What it does |
|---|---|
| `PROTECTED` | eGuard's defaults for the child's age. Recommended under 13 |
| `BALANCED` | Protected plus: +60 min daily and weekend screen time, bedtime starts 1 h later, age rating one tier higher. Recommended for 13+ |
| `CUSTOM` | Starts from the Protected values. The parent edits them and sends the changes as `overrides` |

All profiles keep all 10 protections switched on.

##### `GET /children/{id}/recommendations?profile=`

The Recommended Setup screen. `profile` defaults to the recommended one for the child's age.

```json
{
  "childId": "cmujesv1y00tlnckonhe1ztou",
  "age": 12,
  "profile": "PROTECTED",
  "settings": [
    {
      "key": "BEDTIME",
      "name": "Bedtime",
      "icon": "moon",
      "config": { "key": "BEDTIME", "enabled": true, "start": "21:30", "end": "06:00", "days": "EVERY_DAY" },
      "label": "9:30 PM – 6:00 AM",
      "devices": [ { "deviceId": "…", "deviceName": "iPhone 13", "capability": "AVAILABLE", "capabilityLabel": "Available" } ]
    }
  ]
}
```

`settings` always has all 10 protections (see [§P6](#p6-enums-and-config-reference)). The design shows 6; pick the ones
you want and keep the rest as they are. `devices` is empty until a device is paired.

The response also has `categoryLimits`: `[{ "category": "GAMES", "label": "Gaming time", "dailyLimitMinutes": 60,
"available": true, "upgrade": null }]` (60 minutes on Protected and Custom, 90 on Balanced). That's the design's
"Gaming time". When `available` is false, show it locked with `upgrade`.

##### `POST /children/{id}/setup` → `201`

"Review & Configure". Sends a whole profile in one batch.

```json
{
  "profile": "BALANCED",
  "overrides": [ { "key": "SCREEN_TIME", "dailyMinutes": 150, "weekendMinutes": 200 } ]
}
```

`overrides` holds full config objects (see [§P6](#p6-enums-and-config-reference)) that replace the profile's values,
at most one per key. `categoryLimits` (optional) sets category limits too, e.g.
`[{ "category": "GAMES", "dailyLimitMinutes": 60 }]`. On a plan without them, a limit there is `403 plan_required`,
checked before anything else is changed.

```json
{
  "batchId": "9d5aefae-64ce-4231-b69b-1287dd961d03",
  "requested": ["SCREEN_TIME", "BEDTIME", "…"],
  "saved": ["NOTIFICATIONS"],
  "progress": { …Batch }
}
```

- `requested`: protections sent to devices for verification. Poll `GET /batches/{batchId}`.
- `saved`: protections no device can verify yet. These are stored as the child's settings and sent when a device
  pairs. Two cases:
  - **The child has no devices:** everything is saved, `batchId` and `progress` are `null`, and `saved` lists all 10.
    Skip the progress screen or show "We'll apply these when you add a device".
  - **The protection is unsupported on all of the child's devices:** for example, Notifications on iOS.

#### P4.6 Children

##### `GET /children`

Returns `{ "children": [ …ChildSummary ] }`, in the order the children were added.

##### `POST /children` → `201`

| Field | Type | Rules |
|---|---|---|
| `name` | string | 1–40 chars |
| `age` | int | 0–17 (or send `birthYear` instead) |
| `profile` | `BALANCED` \| `PROTECTED` \| `CUSTOM`, optional | Initial settings. Default: the one recommended for their age (`BALANCED` for 13+, else `PROTECTED`), as on the web |

Response: `ChildSummary`, with `status: "notconfigured"` and `health.score: 0` until a device is paired.

##### `GET /children/{id}`

Child Profile › Overview.

```json
{
  "child": { …ChildSummary },
  "health": { "score": 10, "total": 10, "offline": 0, "verified": true, "label": "Fully protected", "checks": [ …same as /health checks ] },
  "today": { "minutes": 134, "limitMinutes": 240, "appsUsed": 3, "topApps": [ { "name": "YouTube", "minutes": 54 } ] },
  "bedtime": { "enabled": true, "start": "21:30", "end": "06:00", "days": "EVERY_DAY", "label": "9:30 PM – 6:00 AM" },
  "location": { "sharing": true, "state": "located", "placeLabel": "Home", "updatedAt": "2026-09-27T05:28:40.136Z", "label": "Sharing enabled" },
  "deviceProtection": { "state": "healthy", "label": "Healthy" },
  "pendingApprovals": 0,
  "devices": [ …Device ],
  "recentChanges": [
    { "id": "…", "key": "BEDTIME", "title": "Weekend bedtime changed", "actor": "Ana Cruz (Parent) on Galaxy A54",
      "fromValue": "9:30 PM – 6:00 AM", "toValue": "10:30 PM – 6:30 AM", "createdAt": "2026-09-25T03:56:42.757Z" }
  ]
}
```

- `health.verified` / `health.offline` work as in [`GET /health`](#get-healthchildid): only say "verified" when
  `verified` is true.
- `today.topApps` names up to 5 apps, most used first, and never more than the plan's `appMonitoringLimit`. With a
  limit, it only names apps the child's apps list (`GET /children/{id}/apps`) shows.
  `appsUsed` counts every app used today.
- `location.state` is the same as in `GET /locations` (`located`, `waiting`, `sharing_off`, `no_devices`), plus
  `plan_required` on plans without location sharing (then `sharing` is false and there's no place). `location.label`
  is "Sharing enabled", "Waiting for location", "Sharing off", "No devices yet" or "Not on your plan".
  `updatedAt` is when the newest fix was taken.
- `deviceProtection.state` is `healthy`, `issues`, `offline` or `no_devices`. `issues` wins over `offline`; `offline`
  means no device has issues but at least one hasn't synced for a day, so its state can't be verified ("Offline", or
  "1 of 2 devices offline"). A device that was just paired and hasn't reported yet is `issues` with the label
  "Waiting for first check".
- `pendingApprovals` counts app requests waiting for the parent (use it for a badge on the Apps tab).

##### `PATCH /children/{id}`

Body: any of `{ name, age }` (or `birthYear`). Returns the same shape as `GET /children/{id}`.

##### `DELETE /children/{id}`

Family admin only. Body: `{ "password": "…" }` (the admin's own password), or `{ "confirm": "DELETE" }` when the
admin has no password (see [Confirming deletions](#confirming-deletions)). This permanently deletes the child,
their devices and all their data. Errors: `403 forbidden`, `403 wrong_password`, `400 confirm_required`,
`429 rate_limited`.

##### Photo: `PUT` / `GET` / `DELETE /children/{id}/photo`

- **Upload:** `PUT` with the **raw image bytes** as the body (not multipart, not base64).
  - `Content-Type` must be `image/jpeg`, `image/png`, `image/webp` or `image/heic`, and must match the actual bytes.
  - Maximum 2 MB. Resize to about 512×512 before uploading.
  - Response: `{ "photoUrl": "/api/mobile/v1/children/…/photo?v=1790488799782" }`
  - Errors: `413` (too big), `415` (wrong type or content).
- **Download:** `GET` with the bearer header. The response is the image, cacheable forever per URL.
- **Remove:** `DELETE` returns `{ "ok": true }`. After that, `photoUrl` is `null`; show an initial on `hue`.

##### `GET /children/{id}/history?limit=30&before=`

Configuration history, newest first. `limit` is 1–100.

```json
{
  "changes": [
    { "id": "…", "key": "APP_APPROVAL", "title": "Roblox approved", "actor": "Randy Cruz on web",
      "fromValue": null, "toValue": null, "createdAt": "2026-09-27T00:26:42.757Z", "timeLabel": "Today, 8:26 AM" }
  ],
  "nextBefore": "2026-09-25T03:56:42.757Z"
}
```

##### `POST /children/{id}/pairing-code` → `201`

"Set up supervision" / "Add device". Show the code large; the parent types it into the eGuard app on the child's
device, which calls `POST /api/device/v1/pair` (see [C3 › Pair](#post-pair--201)).

```json
{ "code": "FJZM7J7H", "expiresAt": "2026-09-27T06:14:58.928Z", "expiresInSeconds": 900, "childName": "Mia", "kind": "DEVICE" }
```

The code is 8 characters, single-use, and valid for 15 minutes. Count down from `expiresInSeconds` (from when the
response arrived), not from `expiresAt`: the phone's clock may be off. Only a child's newest code of each kind (device, browser) works: asking for another
replaces the previous one, so show only the latest. `409` means the plan's device limit has been reached. `403 email_unverified` means the parent hasn't verified their email yet (see Email verification).
`429 rate_limited` means the parent made more than 20 codes in an hour.
After pairing, `GET /children/{id}` shows the device, and a first full check runs automatically.

**Browser codes ("Add a browser").** Send `{ "kind": "BROWSER", "deviceLabel": "Mia's MacBook" }` (label 1–60 chars, required) to get a code for the eGuard browser extension instead; the response adds `"kind": "BROWSER"`. The parent types it into the extension's setup page, which calls `POST /api/browser/v1/pair` (see [browser-extension-api.md](browser-extension-api.md)). Browser codes don't work in the phone app and phone codes don't work in the extension. Connected browsers count toward the plan's device limit (`usage.devicesUsed` in `GET /subscription` includes them). No body, or `{ "kind": "DEVICE" }`, gives a phone-app code as before.

#### P4.7 Protections and configuration batches

##### `GET /children/{id}/protections`

Protection & Controls for one child: all 10 protections, each with the parent's setting and what every device
reports.

```json
{
  "protections": [
    {
      "key": "BEDTIME",
      "name": "Bedtime",
      "checkName": "Bedtime",
      "icon": "moon",
      "policy": { "key": "BEDTIME", "enabled": false, "start": "22:00", "end": "06:00", "days": "EVERY_DAY" },
      "policyLabel": "Off",
      "status": "PASS",
      "openBatchId": null,
      "version": "q7Yb3kLm0aZx9VtR",
      "devices": [
        {
          "deviceId": "cmujeonbc00d5ncgs3k2m4glb",
          "deviceName": "iPhone 13",
          "platform": "IOS",
          "capability": "AVAILABLE",
          "status": "PASS",
          "reported": { "key": "BEDTIME", "enabled": false, "start": "22:00", "end": "06:00", "days": "EVERY_DAY" },
          "reportedLabel": "Off",
          "message": null,
          "lastVerifiedAt": "2026-09-27T05:32:40.136Z",
          "guide": null
        }
      ]
    }
  ]
}
```

- Pre-fill the edit form from `policy`.
- If `openBatchId` is set, a change is still in progress: resume polling it instead of starting a new one.
- Send `version` back as `baseVersion` when you change the protection (below), so a change another parent made or
  queued since you loaded it isn't silently replaced.
- `capability` says how eGuard can apply this protection on the device (`AVAILABLE`, `GUIDED`, `VERIFY_ONLY`,
  `PARENT_SET` or `UNSUPPORTED`; see "Platform capability per protection"). `reportedLabel` is `"Set by you: …"`
  for a `PARENT_SET` protection the parent confirmed, `"Not set up yet"` before, and `"Not applied"` when the device
  left it out of a full report.
- A protection the parent turned off passes once the device confirms it's off (as above): it's the parent's choice,
  not something to fix. `NOT_CONFIGURED` means the child has no setting for it and the device has it off.
- `reportedLabel` is `"Not reported"` for a device that hasn't reported this protection yet.

##### `PUT /children/{id}/protections/{KEY}` → `202` (or `200` with no device)

Change one protection. `KEY` is case-insensitive. The body is that protection's config **without** `key`:

```json
PUT /children/{id}/protections/BEDTIME
{ "enabled": true, "start": "21:00", "end": "06:30", "days": "SCHOOL_NIGHTS", "baseVersion": "q7Yb3kLm0aZx9VtR" }
```

The response is a `Batch`. Poll `GET /batches/{batchId}`.

`baseVersion` is optional (older apps work without it): the `version` of this protection from
`GET /children/{id}/protections`. When the setting changed since, or another change was queued for it, the answer is
`409` `stale` ("Bedtime for Mia was changed by someone else since you opened this…"): reload the protection and show
the parent what's there now. Without `baseVersion`, the newest change wins and cancels one still waiting.

A child with no paired device yet has nothing to verify the change, so it's saved as their setting straight away and
applied when a device pairs: `200` with `{ "batchId": null, "saved": ["BEDTIME"] }`. Say so ("Saved. It applies when
Mia's device is paired"), not "verified".

- Any open change for the same protection is cancelled and replaced.
- `400` for an invalid config.
- `409 unsupported` if the child has devices but none of them supports it (e.g. Notifications on an iOS-only child). Hide or
  disable that control when every device's `capability` is `UNSUPPORTED`.

##### `GET /batches/{id}`

Poll until `done: true`. Returns a `Batch`.

##### `POST /batches/{id}/confirm`

Guided setup: the parent taps "I've done this, verify now" after following `guide`. The request moves from
`AWAITING_PARENT` to `DELIVERED`, and the device is asked for a full report. The response is a `Batch` plus
`confirmed` (the number of requests moved). Pass `?key=<protection key>` when the screen shows one protection's
guide, so only its steps are confirmed; without it every guided step in the batch is (an unknown key is a `400`).

##### `DELETE /batches/{id}`

Cancels everything in the batch that isn't verified yet. Response: `{ "cancelled": 8 }`. Verified items stay verified.
`?key=SCREEN_TIME` cancels only that protection's change: use it for a protection screen's "Cancel change", so the
rest of a setup batch keeps going. An unknown key is `400`.

#### P4.8 Screen time

##### `GET /children/{id}/screen-time?period=today|7d|30d`

`period` defaults to `today`. Any other value returns `400`. `30d` is an advanced report: without
`entitlements.advancedReports` (eGuard Family) it returns `403 plan_required`, so lock the 30-day tab on other plans.
Every response says which tabs are locked (`locked`), so the first Today load is enough to lock it before a tap.

```json
{
  "period": "today",
  "from": "2026-09-27",
  "to": "2026-09-27",
  "totalMinutes": 134,
  "averageMinutes": 134,
  "previousAverageMinutes": null,
  "completeDays": 0,
  "limitMinutes": 240,
  "deviceCount": 1,
  "locked": { "periods": ["30d"], "message": "30-day reports are included with eGuard Family." },
  "days": [ { "date": "2026-09-27", "minutes": 134, "limitMinutes": 240 } ],
  "hourly": [0,0,0,0,0,0,0,7,7,7,7,7,3,3,3,3,12,12,12,27,12,12,0,0],
  "apps": [
    { "name": "YouTube", "minutes": 54, "appId": "cmujeom2c0007ncgsfr985obv", "approval": "ALLOWED", "dailyLimitMinutes": null }
  ]
}
```

| Field | Notes |
|---|---|
| `totalMinutes` / `limitMinutes` | The "2h 14m of 3 hours" ring. For 7d/30d, `limitMinutes` is the weekday limit; per-day limits are in `days[].limitMinutes` |
| `hourly` | 24 values (index 0 = midnight, family time zone) for `today` only. `null` for 7d/30d, **or when the child's devices don't send hourly data**. Hide the hourly chart then |
| `days` | One entry per day, oldest first (1, 7 or 30 entries). Use for the 7/30-day bar charts |
| `averageMinutes` / `previousAverageMinutes` / `completeDays` | Averages over complete days only, as the web's reports: today is still in progress, so for 7d/30d `averageMinutes` covers the `completeDays` (6 or 29) before today, and `previousAverageMinutes` as many days just before those (for "↓ 12% vs the previous period"). For `today`, `averageMinutes` is today's total and `previousAverageMinutes` is `null` (nothing complete to compare): hide the comparison. The chart's `days` still include today |
| `deviceCount` | Phones and tablets paired to the child (browsers don't send screen time). `0`: say "Pair a phone or tablet to see screen time" instead of an empty ring and chart |
| `locked` | `null`, or `{ periods, message }`: tabs the plan doesn't include (`["30d"]`). Show a lock on them and `message` when tapped, without requesting them |
| `from` / `to` | The days covered, family time zone (`YYYY-MM-DD`). Show them ("Oct 7 – 13"); parse as calendar dates, not in the phone's zone |
| `apps` | Most used first. `appId` / `approval` are `null` for apps without a rule (e.g. `Others`). With an `appMonitoringLimit`, only that many are named and the rest are summed into `Others`. For `today`, the named apps are also only ones the child's apps list (`GET /children/{id}/apps`) shows, which keeps apps waiting for approval first |
| `hiddenApps` | How many apps were left unnamed because of the plan's `appMonitoringLimit` (0 otherwise). Show the upgrade note when above 0 |

#### P4.9 Apps

##### `GET /children/{id}/apps?filter=all|installed|blocked|pending`

- `installed` means everything that isn't blocked (the design's "Installed" tab).
- `pending` means requests waiting for the parent's approval: new apps (`PENDING`), and blocked apps the
  child asked for again. A request never unblocks an app; it stays `BLOCKED` with `requested: true`.

```json
{
  "counts": { "all": 4, "blocked": 0, "pending": 0, "installed": 4 },
  "apps": [
    { "id": "cmujeom2c0008ncgsgn8kylmz", "name": "Roblox", "approval": "ALLOWED", "approvalLabel": "Allowed",
      "requested": false, "allowed": true, "dailyLimitMinutes": null, "todayMinutes": 42, "installedAt": "2026-09-27T00:56:40.499Z",
      "category": "GAMES", "categoryLabel": "Games", "categoryAuto": true }
  ],
  "limited": null
}
```

- `limited` is `null`, or `{ hidden, message }` on a plan with an `appMonitoringLimit`: only that many apps are
  listed (requests first, then the most used), `hidden` more exist. Show `message` as the upgrade note.

- `requested` is true while a request waits for the parent. Show Approve (`PATCH /apps/{id}` with `ALLOWED`) and
  Decline (`BLOCKED`); either one resolves the request, even when the app is already blocked.
- `allowed` drives the on/off switch. It's false for `BLOCKED` and `PENDING`.
- The design's subtitle maps as follows:
  - `ALWAYS_ALLOWED` → "Always allowed"
  - `dailyLimitMinutes` → "1 hour/day"
  - `PENDING` → "Ask parent"
  - `BLOCKED` → "Blocked"
- `category` is what the app counts toward for category limits: the parent's choice, or eGuard's guess from the
  app's name while `categoryAuto` is true. Values: `GAMES`, `SOCIAL`, `VIDEO`, `MESSAGING`, `EDUCATION`,
  `CREATIVITY`, `BROWSERS`, `OTHER`.

##### `PATCH /apps/{id}`

| Field | Type | Notes |
|---|---|---|
| `approval` | `ALLOWED` \| `ALWAYS_ALLOWED` \| `FILTERED` \| `BLOCKED`, optional | Switch on → `ALLOWED`, off → `BLOCKED`. Approving or declining a request also resolves its alert |
| `dailyLimitMinutes` | int 1–1440, or `null` to remove, optional | |
| `category` | a category, or `null` to go back to eGuard's guess, optional | Any plan; it only matters once a category limit is set |

Send at least one field. Response:
`{ id, name, approval, approvalLabel, dailyLimitMinutes, category, categoryLabel, categoryAuto }`. The device picks up the change on its next sync (within
about 5 minutes).

##### `POST /children/{id}/apps` → `201`

"Request to Install App": the parent adds an app ahead of time.

```json
{ "name": "Khan Academy", "approval": "ALWAYS_ALLOWED", "dailyLimitMinutes": null }
```

`name` is 1–80 characters; `approval` is any app `approval` value and defaults to `ALLOWED`; `dailyLimitMinutes` is
1–1440 or `null`. Response: `201 { id, name, approval, approvalLabel, dailyLimitMinutes, category, categoryLabel, categoryAuto }`,
the same shape as `PATCH /apps/{id}`. Returns `409` if an app with that name is already on the child's apps list as
`GET /children/{id}/apps` shows it. With an `appMonitoringLimit`, naming an app that list hides applies the rule to it
and answers `201` as for a new app (blocking or limiting an app works on every plan, and the answer doesn't confirm
which apps are hidden).

##### `GET /children/{id}/category-limits` and `PUT`

One daily limit for all of a child's apps of a kind together ("Gaming time"). Every category is listed, with its limit
(`null` for none) and the minutes the child's apps in it were used today:

```json
{
  "available": true,
  "upgrade": null,
  "categories": [ { "category": "GAMES", "label": "Games", "limitLabel": "Gaming time", "dailyLimitMinutes": 60, "todayMinutes": 42 } ]
}
```

`PUT` with `{ "category": "GAMES", "dailyLimitMinutes": 60 }` (1–1440, or `null` to remove) returns
`{ category, dailyLimitMinutes }`. Category limits are on eGuard Plus and above: on Free, `available` is false,
`upgrade` is the message to show, and setting one is `403 plan_required` (removing one always works). A limit set
before a downgrade is kept but not sent to devices until the family upgrades again.

##### `GET /children/{id}/extra-time`, `POST` and `DELETE`

Extra time lets the child keep using apps past a limit or bedtime for a while (blocked apps stay blocked). It also
answers the child's "Ask for more time" (the ATTENTION alert "More time requested", whose button is
`VIEW_SCREEN_TIME`, so show this on the Screen Time screen).

```json
{ "until": "2026-10-13T12:45:00.000Z", "request": { "body": "Lia asked for more time on YouTube, paused by the daily limit.", "askedAt": "2026-10-13T12:10:02.000Z" }, "choices": [15, 30, 60] }
```

`until` is `null` when none is running, `request` when the child isn't waiting. `POST { "minutes": 30 }` (one of
`choices`) adds that much, to what's left if extra time is running, never more than 4 hours ahead, answers the
request, and returns `{ until, addedMinutes }`. `addedMinutes` is what was actually given: less than `minutes` (0
when already at the cap) when the 4-hour cap applies, so say "Mia has 10 more minutes", not the amount chosen.
Two parents giving time at once both count. `DELETE` ends it, or answers the request with "not now", and returns
`{ until: null }`. Devices pick it up on their next sync; one showing the block screen after asking checks every 20
seconds.

#### P4.10 Location

##### `GET /children/{id}/location`

```json
{
  "childId": "cmujeom2c0006ncgsd9tlg8pp",
  "sharing": true,
  "state": "located",
  "waitingForReport": null,
  "current": {
    "deviceId": "cmujeom5j000wncgs0ylb00q4", "deviceName": "Galaxy A54",
    "lat": 14.6507, "lng": 121.0494, "accuracyM": 25, "placeLabel": "Home", "placeId": "cmuplace0001",
    "locatedAt": "2026-09-27T05:28:40.136Z", "updatedLabel": "Today, 1:28 PM", "fresh": true, "approximate": false
  },
  "devices": [ { "id": "cmujeom5j000wncgs0ylb00q4", "name": "Galaxy A54", "sharing": true, "hasLocation": true } ],
  "history": {
    "enabled": true,
    "visits": [
      { "id": "…", "deviceName": "Galaxy A54", "lat": 11.29, "lng": 125.07, "placeLabel": "School", "placeId": "cmuplace0002",
        "arrivedAt": "…", "lastSeenAt": "…", "timeLabel": "Today, 2:32 PM", "day": { "key": "2026-09-27", "label": "Today" },
        "stayed": true, "durationMinutes": 390, "spanLabel": "7:40 AM – 2:10 PM · 6 h 30 min" }
    ],
    "more": false
  }
}
```

- `current` is `null` when sharing is off or no location has arrived yet. `state` is the same as in `GET /locations`.
- `placeLabel` is the name of the saved place the location falls inside (`placeId`, see
  [Saved places](#saved-places)), else the device's own label (devices don't send one in v1), else `null`: show
  "Current location" / "Unnamed place".
- `fresh` is true when the location is under 20 minutes old and the device is still syncing. Otherwise show it as
  "Last seen {updatedLabel}", never as live. `approximate` is true when `accuracyM` is over 200 m (e.g. a cell-tower
  fix): draw the accuracy circle and say "approximate".
- When sharing is turned off, eGuard deletes the device's last position, and locations it sends while sharing is off
  aren't stored.
- The banner at the top of the screen reads "Location sharing Enabled" when `sharing` is true.
- `history.visits` covers today and yesterday, newest first, up to 100 (`more: true` when there were more; "View All"
  pages them), and is empty unless `history.enabled`. A visit that began earlier and went on into yesterday or today
  is included (a child home since Friday is still at home on Sunday); its `day` is the day it began. The admin turns history on with
  `PATCH /family/privacy { keepLocationHistory: true }`. When it's off, show a prompt instead of the "Today" list.
- A visit with `stayed: false` is a fix taken while passing by (it lasted under about 4 minutes): show it as
  "Passing by", and leave it out of any list of places the child went. A device and another of the child's devices at
  the same place make one visit, not two. `spanLabel` reads "11:00 PM – 7:00 AM next day · 8 h" across midnight.
- `waitingForReport` names the device eGuard is waiting on when `state` is `waiting` only because no device has
  reported yet whether it shares ("Waiting for *Galaxy A54* to report whether location sharing is on"); otherwise
  `null`.
- `note` (also on each child of `GET /locations`): when the location comes from an iPhone or iPad and isn't fresh,
  "iPhone shares its location while eGuard is open on it, so this updates when your child opens eGuard." Show it
  under the location; `null` otherwise. The iPhone app asks for While Using access only.
- To turn sharing on or off, change the `LOCATION` protection (`PUT /children/{id}/protections/LOCATION
  { "sharing": true }`). On iOS this is guided setup.

##### `GET /children/{id}/location/visits?limit=50&before=` or `?day=2026-10-05`

"View All" under Today's visits: every visit kept, up to the family's retention period, newest first. `limit` is 1–100,
and pages use `nextBefore` (the `arrivedAt` of the last item).

```json
{
  "enabled": true,
  "retentionDays": 90,
  "visits": [
    { "id": "…", "deviceName": "Galaxy A54", "lat": 11.32, "lng": 125.06, "placeLabel": "Park", "placeId": "…",
      "arrivedAt": "…", "lastSeenAt": "…", "timeLabel": "Today, 2:32 PM", "day": { "key": "2026-09-27", "label": "Today" },
      "stayed": true, "durationMinutes": 45, "spanLabel": "2:32 PM – 3:17 PM · 45 min" }
  ],
  "nextBefore": "2026-09-27T06:12:44.031Z",
  "thinned": false
}
```

With history off, the response is `{ "enabled": false, "visits": [], "nextBefore": null, "thinned": false }`. Group
sections by `day.key`, like alerts.

**A day's route:** with `day` (YYYY-MM-DD in the family's time zone), the response holds that day's visits **oldest
first** (`limit` and `before` are ignored, `nextBefore` is `null`). Draw them in order as a line; number the ones
with `stayed: true`, and show the rest as small dots. A visit that spans midnight is in both days. A `day` that isn't
a real date is a `400`. Every stay is included; on a very busy day (a long drive sends a fix every 150 m) passing-by
fixes are thinned to about 300 visits in all, evenly along the route and always keeping the last one, and `thinned`
is `true`: say "Some spots passed on the way are left out". `thinned` is always `false` without `day`.

##### `GET /locations`

The family map, one entry per child:

```json
{
  "children": [
    { "childId": "…", "name": "Mia", "hue": 205, "photoUrl": null, "sharing": true, "state": "located", "waitingForReport": null,
      "location": { "deviceId": "…", "deviceName": "Galaxy A54", "lat": 14.6507, "lng": 121.0494, "accuracyM": 25,
                    "placeLabel": "Home", "placeId": "…", "locatedAt": "…", "updatedLabel": "Today, 1:28 PM", "fresh": true, "approximate": false } }
  ],
  "places": [ { "id": "…", "name": "Home", "lat": 14.6507, "lng": 121.0494, "radiusM": 150 } ]
}
```

`state` is `located`, `waiting` (sharing on and no location yet, or no device has reported yet whether it shares and
the parent's setting is on: `waitingForReport` names it), `sharing_off` (a device reported sharing off, or the
parent's setting is off) or `no_devices`. `fresh` and `approximate` work as in `GET /children/{id}/location`.
`places` are the family's saved places: draw each as a circle of `radiusM` metres with its name.

##### Saved places

Places the parents name (Home, School). A location or visit inside one (the nearest, when they overlap) is
labelled with its name; naming, renaming, resizing or removing a place relabels what's already kept. Any parent can
manage them. A place can be anywhere, not only where a child has been: offer "Add a place" with a map to tap (and a
latitude, longitude field), so parents can set up School before the first day. `POST` and `PATCH` are 403
`plan_required` on Free; `GET` and `DELETE` work on every plan, so places saved before a move to Free can be listed
and removed (show them with Remove only, under the upgrade note).

| Request | Body | Response |
|---|---|---|
| `GET /places` | | `{ places: [{ id, name, lat, lng, radiusM, notifyArrive, notifyLeave }] }`, by name |
| `POST /places` | `{ name, lat, lng, radiusM?, notifyArrive?, notifyLeave? }`: name 1–40 characters, `radiusM` one of 100, 150 (default), 250, 500, 1000; notices default to `false` | `201` the place. `400` past 30 places |
| `PATCH /places/{id}` | `{ name?, radiusM?, notifyArrive?, notifyLeave? }` (at least one) | the place |
| `DELETE /places/{id}` | | `{ ok: true }`; visits there lose its name unless another saved place covers them |

Offer "Name this place" on the child's current location and on a visit with no `placeId`, using its `lat` and `lng`,
and "Add a place" anywhere on the map.

**Arrive and leave alerts.** With `notifyArrive` / `notifyLeave` on, a child's device reaching or leaving the place
raises an `INFO` alert in the `LOCATION` category ("Mia arrived at School", "Mia left Home", action `VIEW_LOCATION`),
emailed and pushed like other alerts. It works with location history off. A device's first fix is never an arrival,
a fix within 50 m (or its accuracy, if rougher) past the edge of the place it was at doesn't count as leaving, and
each child, place and direction raises at most one alert per 30 minutes, whichever device gets there first.

#### P4.11 Alerts

##### `GET /alerts`

| Query | Default | Notes |
|---|---|---|
| `filter` | `ALL` | See the table below. The design's tabs are All / Protection / Apps |
| `childId` | none | Only this child's alerts |
| `includeResolved` | `false` | `true` to show a "Resolved" section |
| `limit` | 50 | 1–100 |
| `before` | none | Pagination cursor |

| `filter` | Includes these categories |
|---|---|
| `ALL` | Everything |
| `PROTECTION` | `PROTECTION`, `LOCATION` |
| `APPS` | `APPS` |
| `SCREEN_TIME` | `SCREEN_TIME` |
| `DEVICES` | `DEVICES` |
| `LOCATION` | `LOCATION` |
| `SYSTEM` | `SYSTEM` |

Response: `{ "alerts": [ …Alert ], "unread": 4, "nextBefore": "…" | null }`.

Alerts resolve on their own when the problem is fixed (e.g. a device verifies the setting), so refresh the list after
a batch completes.

| Method & path | Response | Notes |
|---|---|---|
| `GET /alerts/unread-count` | `{ "unread": 4 }` | Tab-bar badge: unresolved, unread, above `INFO` severity. Read state is per parent |
| `POST /alerts/{id}/read` | `{ ok, unread }` | Call when the alert is opened |
| `POST /alerts/read-all` | `{ marked, unread: 0 }` | |
| `POST /alerts/{id}/dismiss` | `{ ok }` | Only when `dismissible`: INFO alerts, and notices nothing resolves on its own (e.g. "Device removed"). Alerts that clear once the issue is fixed return `409 not_dismissible`; an already resolved alert returns `{ ok }` |

#### P4.12 Devices and configuration checks

| Method & path | Body | Response |
|---|---|---|
| `GET /devices` | none | `{ devices: [ …Device ], limit: 8, used: 3 }`. `used` is what the plan's limit counts: these devices plus connected browsers (one disconnected for security doesn't count, nor one that's part of a paired computer), as pairing counts them. Show "`used` of `limit`". A computer has `kind: "COMPUTER"`, `platform: "WINDOWS"` and `removalRequestedAt` (set while its removal waits) |
| `GET /devices/{id}` | none | `Device` + `protections: [{ key, name, icon, capability, capabilityLabel, status, reportedLabel, message, lastVerifiedAt }]` (all 10). Computers also have `removalCode: { code, expiresAt }` while their removal waits (null otherwise): the offline code a parent types into eGuard on the computer. Show it with "Keep this computer" |
| `PATCH /devices/{id}` | `{ name?, isPrimary? }`: `name` 1–60 chars; `isPrimary: true` makes it its child's primary device (listed first, shown on the child's card; the previous primary stops being one). At least one field. Both are in the audit log | Same as GET |
| `POST /devices/{id}/move` | `{ childId, password }` (or `confirm: "DELETE"` without a password) | Same as GET. Moves the device to another child without pairing again: it gets that child's protections and apps on its next sync. Its reported protections are cleared (`firstCheck: true` until it reports again) and a full report is requested; its last position is cleared; its open configuration requests are cancelled; what it recorded stays with the old child. Becomes the new child's primary only if they have none; the old child's oldest remaining device takes over as primary. The family gets a "Device moved" alert. `400` if it already belongs to that child, `404` for an unknown device or child, `403 wrong_password` |
| `POST /devices/{id}/keep` | none | Same as GET. Cancels a computer's waiting removal: it stays, and its next sync carries no uninstall command. Nothing to do for other devices. `404` for an unknown device |
| `DELETE /devices/{id}` | `{ password }`, or `{ confirm: "DELETE" }` without one ([Confirming deletions](#confirming-deletions)), and optionally `deleteHistory: true` and `now: true` | `{ ok, pending }`. **A computer** isn't removed at once (`pending: true`): it uninstalls eGuard on its next sync and is removed then (desktop-agent-spec.md section 10); `now: true` removes it without waiting. Otherwise: The device is unpaired and its token stops working. `403 wrong_password` / `400 confirm_required` without the confirmation. The family gets a "Device removed" alert, emailed to parents, since eGuard stops verifying the device. By default the screen time, app usage and location visits recorded from the device are kept with the child (until the family's retention period, or the child is deleted); in location history their `deviceName` is `"Removed device"`. With `deleteHistory: true` they're deleted too. Offer this as an "Also delete what it recorded" option in the confirmation, unticked by default |
| `GET /browsers` | none | `{ browsers: [{ id, childId, childName, deviceLabel, browser, browserVersion, extensionVersion, platform, lastSeenAt, lastSeenLabel, connected, createdAt, protectionState, offline, status: { tone, label, note } }] }`: the eGuard browser extension installs. **Show `status`**: the web card's words, with disconnected and silent already taken into account (`tone` is `ok`, `warn`, `crit`, `muted` or `accent`; `label` e.g. "Protected", "Action required", "Not seen for a day", "Disconnected for security"; `note` one sentence or `null`). `extensionVersion` and `browserVersion` are kept current by the extension's health checks. `connected: false` means eGuard disconnected it for security (its sign-in key was used from two places); remove it and add it again. `protectionState` is the extension's own answer from its latest health check: `PROTECTED`, `NEEDS_ATTENTION`, `ACTION_REQUIRED`, `SYNC_PAUSED` or `UNSUPPORTED`, and `null` before its first check (show "Waiting for first health check"). `offline: true` means it hasn't checked in for a day: show "Not seen for a day" instead of its last state, which can't be confirmed |
| `GET /children/{id}/browser-policy` | none | `{ version, safeBrowsing, safeSearch, youtubeRestrict, blockedCategories[], blockedDomains[], allowedDomains[], unknownSitesPolicy, schedule, updatedBy, updatedAt, categories: [{ key, label, hint }], youtubeLevels: [{ key, label, text }] }`. `youtubeRestrict` is YouTube Restricted Mode in the child's browsers: `OFF`, `MODERATE` or `STRICT` (offer `youtubeLevels`, in order, with the web's words). `categories` now includes `PROXY` (proxies, page translators and web archives; on by default for new children). Created with age-based defaults (`updatedBy: "eGuard defaults"`) the first time it's read. Applies to all of the child's browsers |
| `PUT /children/{id}/browser-policy` | every field except `youtubeRestrict`, which may be left out to keep the saved level: `{ safeBrowsing, safeSearch, youtubeRestrict?, blockedCategories: ["ADULT", …], blockedDomains: ["example.com"], allowedDomains: [], unknownSitesPolicy: "ALLOW" \| "WARN" \| "BLOCK", schedule: { enabled, startTime: "21:00", endTime: "06:00" } \| null }` | Same as GET. Sites are normalised (`https://www.x.com/page` → `www.x.com`), sorted and de-duplicated, up to 500 per list. `400` with a parent-readable `error` for a site that isn't an address, a site in both lists, or equal focus-hour times. Saving identical settings keeps the version; any change adds one, which browsers pick up within 5 minutes. `409 conflict` if another parent saved at the same moment. Optional `baseVersion`: the `version` you showed the parent; if the policy changed since (an approved access request, another parent), the save is refused with `409 stale_version` instead of undoing that change. Reload and let the parent redo their edit. Send it from every editor. `unknownSitesPolicy` is for sites on neither list: `ALLOW`, `WARN` (notice first) or `BLOCK` (allowed list only); focus hours block everything not on the allowed list |
| `GET /children/{id}/browser-access-requests` | none | `{ pending: [Request], recent: [Request] }` where `Request` is `{ id, domain, reason, status: "PENDING" \| "APPROVED" \| "DENIED", duration, expiresAt, createdAt, decidedAt, decidedBy }`. Sites the child asked to open from the browser's block page; each new one also raises an `ATTENTION` alert "Website access request" (`resolveKey` `WEBREQ:<id>`) |
| `POST /browser-access-requests/{id}` | `{ decision: "APPROVE", duration: "15M" \| "1H" \| "TODAY" \| "ALWAYS" }` or `{ decision: "DENY" }` | `{ request }`. Approval becomes a new browser policy version the browser picks up within 5 minutes (the child can also tap Check again): `ALWAYS` adds the site to the allowed list, the others allow it until then (`TODAY` = midnight in the family's time zone). Resolves the alert. `409 already_decided` if another parent answered first |
| `DELETE /browsers/{id}` | `{ password }` or `{ confirm: "DELETE" }` | `{ ok }`. Same rules as removing a device; the extension forgets the connection on its next check and the family gets a "Browser removed" alert |
| `POST /checks` | `{ deviceId? }` (omit for all devices) | `202 { runId }`. `409 no_devices` if the family has no paired device. `429 rate_limited` after 30 checks per parent per hour |
| `GET /checks/{runId}` | none | See below. Poll until `done` |

```json
{
  "status": "RUNNING",
  "done": false,
  "health": { "score": 10, "total": 10, "verified": false, "offline": 1 },
  "results": [
    { "deviceId": "…", "deviceName": "iPhone 13", "childName": "Mia", "reachable": null, "issues": null, "reported": false }
  ]
}
```

- `health` covers the devices in this check: one device's score for a `deviceId` check, the family's otherwise.
- `health.verified` is true only when every protection passes **and** no device is offline (`health.offline` is the
  number offline). A full score with `verified: false` is the offline devices' last known state: say "Every protection
  is set, as last reported", never "verified".

- Devices report back on their next sync. A check finishes when every device has reported, or after 12 seconds.
- Devices that didn't answer end with `reachable: false`; show "Couldn't reach".
- `issues` is the number of protections not passing on that device.

#### P4.13 Family, members and privacy

##### `GET /family`

Settings › Family.

```json
{
  "id": "cmujeoltx0000ncgsox90ftwt",
  "name": "Cruz Family",
  "timezone": "Asia/Manila",
  "members": [
    { "id": "…", "name": "Randy Cruz", "email": "randy@example.com", "role": "FAMILY_ADMIN", "createdAt": "…", "you": true, "pending": false },
    { "id": "…", "name": "Ana Cruz", "email": "ana@example.com", "role": "PARENT", "createdAt": "…", "you": false, "pending": true }
  ],
  "children": [ …ChildSummary ],
  "deviceCount": 5,
  "devicesUsed": 6,
  "deviceLimit": 8,
  "childCount": 3,
  "childLimit": 5,
  "plan": "eGuard Plus",
  "entitlements": { …same as GET /subscription },
  "canManage": true
}
```

`deviceCount` is phones and tablets; `devicesUsed` also counts connected browsers, which take plan slots too.
Compare `devicesUsed` with `deviceLimit` ("6 of 8 devices").

| Method & path | Body | Response / notes |
|---|---|---|
| `PATCH /family` | `{ name }` | Same as `GET /family`. Renames the family (2–80 characters); admin only (`403 forbidden`). Show the field read-only when `canManage` is false. The name appears in invitations and the weekly summary |
| `POST /family/members` | `{ name, email }` | `201 { id, name, email, role: "PARENT", pending: true, emailSent, expiresInDays }`. Admin only. **Sends an invitation**: they join once they accept it (see Invitations). A `password` from older apps is ignored. `409` if the email already has an eGuard account; `429` after 10 invitations an hour. `emailSent: false` means the email failed: offer Resend |
| `POST /family/members/{id}/invite` | none | `{ ok }`. Admin only. Sends a pending invitation again with a new 7-day link. `409` if they already accepted, `503 mail_failed` |
| `DELETE /family/members/{id}` | none | `{ ok }`. Admin only. Removes a `PARENT` (not yourself) and signs them out everywhere, or withdraws a pending invitation |
| `GET /family/privacy` | none | `{ keepLocationHistory, shareAnalytics, retentionDays }`. eGuard doesn't collect product analytics yet: `shareAnalytics` is saved as the family's consent and applies if it starts, so say that under the switch |
| `PATCH /family/privacy` | any of `{ keepLocationHistory, shareAnalytics }` | Same object. Admin only. **Turning `keepLocationHistory` off deletes all stored visits**, so confirm with the parent first |

##### Organizations

Schools, community groups and businesses give families a **join code** (8 characters; dashes and spaces are
ignored). Joining shares nothing about the family: the organization only sees how many families joined. Other
parents in the family get an alert when the admin joins or leaves.

| Method & path | Body | Response / notes |
|---|---|---|
| `GET /organizations` | none | `{ organizations: [{ id, name, kind, kindLabel, joinedAt }], canManage, privacy }`. `kind` is `SCHOOL`, `COMMUNITY` or `BUSINESS` (pick an icon); `kindLabel` is "School", "Community group" or "Business". `privacy` is a sentence to show under the list. Hide join and leave when `canManage` is false |
| `POST /organizations/preview` | `{ code }` | `{ name, kind, kindLabel, alreadyJoined, message }`. Show `name` and `message` (what the organization will and won't see) before the parent confirms. `400 invalid` for a code that matches no organization; `429 rate_limited` after several wrong codes. Admin only |
| `POST /organizations` | `{ code }` | `201 { ok, name, organizations }`. Joins; joining again is fine. `409 conflict` at the limit of organizations per family. Admin only |
| `DELETE /organizations/{id}` | none | `{ ok, name }`. Leaves. A plan the organization already sponsored keeps running until it ends. Admin only |

Sponsor codes, which pay for a plan, are redeemed on the website only (see [Known gaps](#p7-known-gaps)).

#### P4.14 Subscription

##### `GET /subscription`

```json
{
  "plan": "eGuard Plus",
  "planId": "PLUS",
  "status": "ACTIVE",
  "renewsAt": "2026-10-11T16:00:00.000Z",
  "renewsLabel": "Renews on Oct 12, 2026",
  "features": [
    { "key": "children", "included": true, "label": "Up to 5 children and 10 devices" },
    { "key": "apps", "included": true, "label": "See and manage every app" },
    { "key": "category_limits", "included": true, "label": "Category limits, like gaming time" },
    { "key": "location", "included": true, "label": "Location sharing" },
    { "key": "alerts", "included": true, "label": "Push alerts" },
    { "key": "support", "included": true, "label": "Priority support" }
  ],
  "entitlements": {
    "childLimit": 5, "deviceLimit": 10, "locationSharing": true, "appMonitoringLimit": null,
    "realtimeAlerts": true, "advancedReports": false, "apiAccess": false, "categoryLimits": true, "driftAlerts": true
  },
  "usage": { "devicesUsed": 5, "deviceLimit": 10, "children": 3, "childLimit": 5 },
  "canManage": true,
  "billingAvailable": false,
  "store": null,
  "upgrade": { "planId": "PRO", "name": "eGuard Family", "googlePlayProductId": "eguard_pro" }
}
```

- Plans are **Free** (1 child, 1 device), **eGuard Plus** (₱149/month, 3 children, 5 devices) and **eGuard Family** (₱249/month, 6 children, 12 devices). Families subscribed before 2026-10-28 keep 5/10 or 10/20: always show `usage.childLimit` and `usage.deviceLimit`, never a number from the plan.
  `upgrade` is the next plan up, or `null` on eGuard Family.
- `status` is `ACTIVE` or `EXPIRED`. A failed auto-renew payment that is being retried stays `ACTIVE` (the plan has a
  grace period). `renewsLabel` then reads "Renewal failed on …".
- Plan Usage "3 of 5 children" comes from `usage.children` / `usage.childLimit`; devices from `usage.devicesUsed` / `usage.deviceLimit`.
- Use `entitlements` to hide or badge what the plan doesn't include (also on `GET /family`). The server enforces
  them either way:
  - at `childLimit`, `POST /children` → `409 { code: "plan_limit" }`; pairing past `deviceLimit` is refused the same way
  - without `locationSharing`, `/locations` and `/children/{id}/location…` → `403 { code: "plan_required" }`, and
    turning on location history is refused
  - with an `appMonitoringLimit`, `GET /children/{id}/apps` lists that many (apps waiting for approval first, then the
    most used) and `limited: { hidden, message }` says how many more there are; `/children/{id}/screen-time`
    names only apps that list shows today, for every period, and sums the rest as Others (`hiddenApps`)
  - without `realtimeAlerts`, push sends security alerts only (`pushScope: "security"` on `/me/notifications`)
  - without `driftAlerts` (Free), a protection changed on the device raises no "Protection setting changed" alert; its status and the history still show it. Alerts that a protection can't be applied, location was turned off or uninstall protection was turned off come on every plan
  - without `advancedReports`, `/children/{id}/screen-time?period=30d` → `403 plan_required`
- **Plans are paid for on the web for now** (PayMongo, in Settings › Subscription on the website). The apps show the
  plan and usage but **don't sell it and don't link to the website**: store policies forbid steering users to
  outside payment for digital subscriptions.
- `billingAvailable` is `true` only when the request comes from the Android app (`X-eGuard-Client: android`) **and**
  the server has Google Play configured **and** the plan isn't already paid another way (a web pass or auto-renew,
  or a sponsor code), so a Play subscription never charges on top of one. It is `false` while payments are web-only. Show an upgrade button only
  when all three hold:
  - `billingAvailable` is true
  - `upgrade` is non-null
  - `canManage` is true (only the family admin can buy)

  Otherwise show no upgrade button. `upgrade` is always `null` for the iOS app (`X-eGuard-Client: ios`), which sells
  nothing; its help articles also leave out prices and where to buy.
- `store`, when set, says how the current plan is paid: `{ name, productId, autoRenewing, expiresAt }`.
  - `name` is `PAYMONGO` for a web purchase (a pass, or auto-renew), `VOUCHER` for a sponsor code an organization gave the family (show it as "Sponsored by {sponsor}", or "Sponsored plan" when `sponsor` is null; codes are redeemed on the web), or `GOOGLE_PLAY`.
  - `sponsor` (optional, newer servers): the organization's name for a `VOUCHER` plan, otherwise null.
  - If `autoRenewing` is false (a pass, or auto-renew turned off), `renewsLabel` reads "Ends on …".
  - For a Google Play plan, "Manage Subscription" opens
    `https://play.google.com/store/account/subscriptions?sku={productId}&package={packageName}`.
- The server re-checks purchases on each call: an unfinished web payment at most every minute, one whose paid period
  has ended at most every 10 minutes, and an
  active one once a day. It also learns about payments, renewals and refunds from PayMongo webhooks. When the plan
  lapses, the family goes back to Free. Children and devices already added stay, but no new ones can be added over
  the limits.
- Server-side details (payment flows, sync, configuration): [subscriptions.md](subscriptions.md).

##### `GET /subscription/plans`

The upgrade screen: Free, eGuard Plus and eGuard Family, in that order. Where Play Billing is available, show the
localized price from `ProductDetails`; `monthlyPesos` is the web price.

```json
{
  "plans": [
    { "id": "FREE", "name": "Free", "blurb": "Get started with essential protection tools.", "monthlyPesos": 0, "current": false,
      "childLimit": 1, "deviceLimit": 2, "entitlements": { "…": "…" },
      "features": [ { "key": "children", "included": true, "label": "Up to 1 child" } ], "googlePlayProductId": null },
    { "id": "PLUS", "name": "eGuard Plus", "monthlyPesos": 149, "current": true, "childLimit": 5, "deviceLimit": 10, "…": "…",
      "googlePlayProductId": "eguard_plus" },
    { "id": "PRO", "name": "eGuard Family", "monthlyPesos": 249, "current": false, "childLimit": 10, "deviceLimit": 20, "…": "…",
      "googlePlayProductId": "eguard_pro" }
  ],
  "googlePlay": { "packageName": "app.eguard.android", "obfuscatedAccountId": "9f2c…(64 hex chars)" },
  "canManage": true
}
```

`googlePlay` is `null` when the server has no Play billing configured.

##### `POST /subscription/google-play` (Android, family admin)

Send the purchase to eGuard after Play Billing reports it.

```json
{ "productId": "eguard_pro", "purchaseToken": "<Purchase.getPurchaseToken()>" }
```

→ `200 { "plan": "eGuard Family", "expiresAt": "2026-10-27T…Z", "autoRenewing": true, "test": false }`

`eguard_family`, sold before these plans, is still accepted and grants eGuard Family.

The server does the following:
- verifies the token with Google
- checks the purchase was made for this family
- upgrades the plan (eGuard Family: 6 children, 12 devices)
- **acknowledges the purchase**, so the app must **not** call `acknowledgePurchase` itself
- raises an INFO alert "Welcome to eGuard Family"

The call is idempotent: send it again for "Restore purchases" or after a network error.

| Status / `code` | Meaning |
|---|---|
| `400 invalid` | Unknown product, or the token is for a different product |
| `400 invalid_purchase` | Google doesn't recognize the token |
| `403 forbidden` | Not the family admin |
| `403 account_mismatch` | The purchase wasn't made with this family's `obfuscatedAccountId` |
| `409 conflict` | The token is already linked to another eGuard family |
| `409 purchase_pending` | Payment pending (e.g. cash at a store). Show "We'll upgrade you once payment clears" and retry later |
| `409 not_active` | Expired, on hold or paused |
| `409 billed_elsewhere` | The plan already auto-renews on the website. The purchase isn't acknowledged, so Google refunds it within 3 days. Show the message |
| `501 billing_not_configured` | The server has no Google Play config |
| `502 store_unavailable` | Google unreachable. Retry; the purchase is safe (unacknowledged purchases are refunded after 3 days, so retry soon) |

**Android purchase flow**

```
GET /subscription/plans                       → productId, obfuscatedAccountId
BillingClient.queryProductDetailsAsync(productId)   → localized price, offerToken
BillingClient.launchBillingFlow(
    BillingFlowParams.newBuilder()
      .setProductDetailsParamsList(…offerToken…)
      .setObfuscatedAccountId(googlePlay.obfuscatedAccountId)   ← required, or eGuard rejects the purchase
      .build())
onPurchasesUpdated(PURCHASED) → POST /subscription/google-play { productId, purchaseToken }
                   (PENDING)  → show "Payment pending"; send the token again when it becomes PURCHASED
on launch: BillingClient.queryPurchasesAsync(SUBS) → re-send any unacknowledged purchase (Restore)
```

#### P4.15 Help and support

The public help endpoints are in [§P4.1](#p41-public-no-sign-in).

| Method & path | Body | Response |
|---|---|---|
| `POST /support/tickets` | `{ category?, subject, message }` | `201 { id, status: "OPEN", createdAt, message }`. Show `message` as the confirmation |
| `GET /support/tickets` | none | `{ tickets: [{ id, category, subject, message, status, createdAt }] }` (this parent's, newest first) |

- `category`: `SETUP`, `DEVICE`, `BILLING`, `ACCOUNT` or `OTHER` (the default).
- `subject`: 3–120 characters.
- `message`: 10–5000 characters.

#### Parent care (tips, plans, reminders)

Optional guidance, separate from safety alerts (`/alerts`): nothing here changes which alerts arrive. Full design in
[docs/features/parent-care.md](features/parent-care.md). Writes share one limit per parent (300 an hour, 429 `rate_limited`).

| Method & path | Body | Response |
|---|---|---|
| `GET /me/care` | none | `{ enabled, inApp, push, email, briefings, followUps, weeklyPlan, checkIns, monthlyReport, briefingDays, deliveryTime, quietStart, quietEnd, language, timezone, effectiveTimezone, consent: { push, email }, channels: { push, email, inApp }, languages }` |
| `PATCH /me/care` | any of the fields above except `consent`, `channels`, `languages`, `effectiveTimezone` | Same as GET. Times are `"HH:MM"` (24-hour, local); `briefingDays` 0 (Sun)–6; `language` `en` or `fil`; `timezone` an IANA zone or `null` (the family's). Unknown fields: 400 |
| `GET /care/activities` | none | `{ week, plan, inProgress, suggested, completed, dismissed, completedTotal }`; each activity `{ key, title, why, minutes, steps, ages?, article, appLink?, repeatDays?, status, startedAt, completedAt, due }` |
| `GET /care/activities/{key}` | none | One activity, as above |
| `POST /care/activities/{key}` | `{ action: "start" \| "complete" \| "dismiss" \| "restore" }` | The activity. `start` schedules one reminder ~24 h later; `complete`/`dismiss` cancel it. 409 `already_completed` when starting a one-time activity that's done |
| `GET /care/messages` | query `limit` (1–50), `before`, `channel` | `{ messages: [{ id, automation, channel, title, body, cta, link, sentAt, openedAt, clickedAt }], unread, nextBefore }` |
| `POST /care/messages/{id}` | `{ action: "open" \| "click" \| "dismiss" }` | `{ ok, link }`. Recorded once each. 404 for another parent's message |
| `POST /care/events` | `{ events: [{ eventId, type, occurredAt?, messageId?, month? }] }` (1–50) | `{ recorded, skipped }`. `type`: `NOTIFICATION_OPENED`, `NOTIFICATION_CLICKED` (need `messageId`), `PLAN_OPENED`, `REPORT_VIEWED`. `eventId` is the app's own (8–64 chars) so resending a queue records once |
| `GET /care/report` | query `month` (`YYYY-MM`, default last month) | `{ month, completed, started, protectionChanges, planWeeks, activities, nextStep, joinedAfter }` |

Push: parent-care pushes carry `data: { type: "care", messageId, link }` (alerts carry `type: "alert"`). On tap, open
`link` in the app and report `NOTIFICATION_CLICKED` with `messageId`.

---

### P5. Flows

#### P5.1 App launch

```
GET /app-info ── app too old? ──► "Please update"
      │
token in Keychain? ── no ──► Welcome / Create Account
      │ yes
GET /dashboard ── 401 ──► clear token ──► Sign in
      │ 200
Home  (+ POST /me/push-tokens if the APNs token changed)
```

#### P5.2 Onboarding (screens 3 → 9)

```
POST /auth/register → /auth/register/verify { signup, code } | /auth/social → token
POST /children { name, age }              → childId          (4. Add Child)
PUT  /children/{id}/photo  (optional)
GET  /profiles?age=12                     → pick profile     (5. Protection Profile)
GET  /children/{id}/recommendations?profile=PROTECTED        (6. Recommended Setup; parent may edit values)
POST /children/{id}/pairing-code          → show code        (7. step 1 "Set up supervision")
     … parent pairs the child's device, then the app polls GET /children/{id} until deviceCount > 0 …
POST /children/{id}/setup { profile, overrides }  → batchId  (7. "Review & Configure")
loop GET /batches/{batchId} every 1–2 s                      (7. Setup Progress: map items to the steps)
     guided item? show guide → POST /batches/{batchId}/confirm
until done
GET  /health?childId={id}                                    (8. Configuration Health, "Fix N settings")
→ 9. Setup Complete (list the VERIFIED items) → "Go to Dashboard"
```

If the parent skips pairing, `POST /setup` returns `batchId: null` and saves the settings. They are applied
automatically when a device is paired later.

#### P5.3 Changing one setting

```
GET /children/{id}/protections             → policy, capabilities, openBatchId
PUT /children/{id}/protections/BEDTIME {…} → Batch (PENDING / AWAITING_PARENT)
poll GET /batches/{batchId}
  VERIFIED        → "Saved and verified", refresh the screen
  FAILED          → show failureReason, offer "Try again"
  AWAITING_PARENT → show guide steps + "Verify now" → POST /batches/{id}/confirm
  offline: true   → "Waiting for {device} to come online"; the parent can leave and come back
```

#### P5.4 Approving an app request

```
push/alert "App approval requested" (action.type = REVIEW_APPS)
GET  /children/{id}/apps?filter=pending
PATCH /apps/{appId} { "approval": "ALLOWED" }  or  { "approval": "BLOCKED" }
→ the alert resolves automatically; the device applies the rule on its next sync
```

---

### P6. Enums and config reference

#### Protections (`KEY`) and their config bodies

| KEY | Config (body for `PUT`, or an entry in `overrides` with `key`) | Example label |
|---|---|---|
| `SCREEN_TIME` | `dailyMinutes` 15–1440, `weekendMinutes` 15–1440 | "3h / day", or "3h / day, 4h weekends" when the limits differ |
| `BEDTIME` | `enabled` bool, `start` "HH:MM", `end` "HH:MM" (24 h), `days` `EVERY_DAY` \| `SCHOOL_NIGHTS` | "9:30 PM – 6:00 AM", or "9:30 PM – 6:00 AM, school nights" |
| `APP_RESTRICTIONS` | `maxAgeRating` 4–18 | "Apps rated 9+ and under" |
| `APP_APPROVAL` | `enabled` bool | "Approval required" |
| `CONTENT` | `maxAgeRating` 4–18 | "Rated 13+ and under" (the design's "Explicit content") |
| `WEB` | `mode` `OFF` \| `FILTER` \| `ALLOWLIST`, `blockedSites` int ≥ 0 (optional, default 0; not compared, since devices report the size of their own list) | "Adult and unsafe sites filtered" |
| `DOWNLOADS` | `requireApproval` bool | "Parent approval" (the design's "App downloads · Ask parent") |
| `LOCATION` | `sharing` bool | "Sharing" |
| `NOTIFICATIONS` | `quietDuringBedtime` bool | "Quiet during bedtime" |
| `UNINSTALL_PROTECTION` | `enabled` bool | "On" |

Age-rating tiers used by the profiles: 4, 9, 13, 16, 18.

#### Platform capability per protection

| KEY | Android | iOS |
|---|---|---|
| `APP_RESTRICTIONS` | PARENT_SET | AVAILABLE |
| `CONTENT` | PARENT_SET | AVAILABLE |
| `WEB` | GUIDED | AVAILABLE |
| `LOCATION` | AVAILABLE | GUIDED |
| `NOTIFICATIONS` | AVAILABLE | UNSUPPORTED |
| All others | AVAILABLE | AVAILABLE |

| Capability | Meaning for the UI |
|---|---|
| `AVAILABLE` | eGuard applies it directly; just wait for verification |
| `GUIDED` | Show `guide` steps, then "Verify now" (`/confirm`) |
| `VERIFY_ONLY` | Same UI as GUIDED: the parent sets it on the device, eGuard confirms it (no protection uses it today) |
| `PARENT_SET` | Show `guide` steps (Google Play's parental controls), then "Save" (`/confirm`). The device can't read it, so `/confirm` records it at once as the parent's word: the request becomes `VERIFIED` with `parentSet: true` on the batch device, and the device's protection status becomes `UNSUPPORTED` (not counted in health). Show it as "Set by you", never "Verified" or "Not supported". `NOT_CONFIGURED` until the parent confirms ("Not set up yet") |
| `UNSUPPORTED` | Show "Not supported on iPhone". It never counts against health |

Health checks (`GET /health` `checks[]`) carry `parentSet: true` when the check's `UNSUPPORTED` status comes from
protections the parent set this way: show "Set by you" for it.

#### Other enums

| Enum | Values |
|---|---|
| `role` | `FAMILY_ADMIN`, `PARENT` |
| `platform` | `ANDROID`, `IOS` |
| device `kind` | `PHONE`, `TABLET` |
| check `status` | `PASS`, `WARNING`, `ACTION_REQUIRED`, `NOT_CONFIGURED`, `UNSUPPORTED` |
| request / item `status` | `PENDING`, `DELIVERED`, `AWAITING_PARENT`, `VERIFIED`, `FAILED`, `CANCELLED` |
| request `mode` | `APPLY`, `GUIDED` |
| alert `severity` | `INFO`, `ATTENTION`, `ACTION_REQUIRED`, `CRITICAL` |
| alert `category` | `PROTECTION`, `DEVICES`, `APPS`, `SCREEN_TIME`, `LOCATION`, `SYSTEM` |
| alert titles you'll see | "Protection setting changed", "Location sharing turned off", "Device hasn't synced in over a day", "New device synchronized", "Device removed", "New app installed", "App approval requested", "App blocked", "Screen time limit reached", "Welcome to eGuard Plus" / "Welcome to eGuard Family", "eGuard Plus ended" / "eGuard Family ended" |
| app `approval` | `ALLOWED`, `ALWAYS_ALLOWED`, `FILTERED`, `BLOCKED`, `PENDING` |
| child `status` | `protected`, `attention`, `notconfigured` |
| device `state` | `healthy`, `issues`, `offline` |

---

### P7. Known gaps

These parts of the design aren't backed by the API yet. Plan the UI accordingly.

| Design element | Status | Suggested UI for now |
|---|---|---|
| Push notifications | Sent through Firebase Cloud Messaging once the server has `FCM_SERVICE_ACCOUNT`; alerts go out with the maintenance job (every few minutes), not instantly | Register FCM tokens; still refresh with `/alerts/unread-count` on foreground. A push's `data` has `type: "alert"`, `alertId`, `category` and `childId?`, plus the alert's `action` flattened when it has one: `actionType`, `deviceId?`, `key?`, `requestId?` (`childId` is then the action's). Open what `actionType` opens, as the alert's button does; without one, open the alert. `type` is always `"alert"`, never an action |
| Upgrade / Manage Subscription in the apps | Plans are sold on the web only (PayMongo) for now; Google Play billing is turned off and App Store purchases aren't supported, so `billingAvailable` is `false` | Show the plan and usage without a buy button or a link to the website |
| Password for Apple/Google accounts | Social accounts have no password until they set one, so they can't change one or change their email | Hide "Change password" while `hasPassword` is false and offer "Forgot password?" to set one. Deletions use "Type DELETE" instead ([Confirming deletions](#confirming-deletions)) |
| Sponsor codes | Redeeming a code that pays for a plan happens on the website only: unlocking a paid plan with a code inside a store app can break App Store and Google Play payment rules. Joining an organization (free) works in the app | Show a sponsored plan (`store.name: "VOUCHER"`) as "Sponsored plan"; no in-app redeem and no link to the website |
| Realtime updates | No WebSocket/SSE | Poll as described in [Polling](#polling) |
| Location history on the web | Visits are available only through this API | none |

---

## Part C: Child device API

For **child device mode**: the eGuard app on the child's phone or tablet. The device has no parent session: it pairs
once with a code a parent creates, then works with its own device token. Parents manage everything through
[Part B](#part-b-parent-api); this part covers only what the device sends and receives.

What the app must do with these calls (screens, enforcement per platform, permissions, background execution, tamper
resistance) is in [child-app-spec.md](child-app-spec.md). This part is the wire reference.

**Computers** (eGuard for Windows) use the same API as `platform: "WINDOWS"`, `kind: "COMPUTER"`. They add app `ids`,
`serverTime`, a signed `uninstall` command on `/sync`, the `APPS_FOUND`, `TAMPER` and `UNINSTALL_ACK` events, and
`GET /catalog` and `GET /update`, and `accounts` on `/report` (the Windows accounts the child's rules apply in). They sync every
minute. See [desktop-agent-spec.md › 12](desktop-agent-spec.md#12-wire-reference-whats-new-for-computers).
Removing a computer waits for it: `DELETE /devices/{id}` returns `pending: true` (and takes `now: true`), and
`POST /devices/{id}/keep` cancels the removal.

- **Base URL:** `https://www.eguard.family/api/device/v1`
- **Format:** JSON in and out, UTF-8, HTTPS only. Every endpoint is a `POST`.

### C1. Conventions

#### Authentication

`POST /pair` exchanges a pairing code for a **device token**:

```json
{ "deviceId": "cmujeom5j000wncgs0ylb00q4", "token": "<opaque string>", "childName": "Mia" }
```

- Send `Authorization: Bearer <token>` on every other call.
- The token is returned **once**. Store it at once in the **Android Keystore** (EncryptedSharedPreferences) or the
  **iOS Keychain** (shared with extensions through the App Group).
- It doesn't expire. Only a SHA-256 hash is kept on the server, so a lost token can't be recovered: the device has
  to be paired again.
- It stops working when a parent removes the device (web, or `DELETE /devices/{id}` in the parent API), or deletes
  the child or the family.
- **Any `401` means the device was removed.** Stop syncing and enforcing, clear the token, and show the removal
  screen ([child-app-spec.md › Removal](child-app-spec.md#removal)).

A parent token doesn't work here and a device token doesn't work in the parent API. When a parent pairs the phone
they're holding, the app signs out of the parent session after pairing
([A4](#a4-moving-between-modes)).

#### Headers

| Header | When | Value |
|---|---|---|
| `Authorization` | every call except `/pair` | `Bearer <device token>` |
| `Content-Type` | every call | `application/json` |

`appVersion`, `osVersion` and `battery` travel in request bodies (`/pair`, `/sync`, `/report`), not headers.

#### Errors

```json
{ "error": "Pairing code is invalid or expired" }
```

`error` is a readable message. Unlike the parent API there is **no `code` field**: branch on the status.

| Status | Meaning / what the app should do |
|---|---|
| 400 | Validation failed (the message names the problem, e.g. `date must be YYYY-MM-DD`), or a bad pairing code. A `400` on a queued item is a bug: log it locally and **drop it**, don't retry |
| 401 | `Invalid or missing device token`: the device was removed. Stop everything |
| 409 | `/pair` only: the plan's device limit is reached |
| 429 | Rate limited (`/pair` per IP; `/events`, `/report`, `/usage` and `/location` per device). Back off and retry later |
| 5xx / network | Retry with exponential backoff from 30 seconds to 15 minutes, with jitter |

Request bodies are limited to **64 KB**. A larger or non-JSON body is read as empty (`400` where a body is required).

#### Data types

- **IDs** are opaque strings. Don't parse them.
- **Calendar days** in `/usage` are `YYYY-MM-DD` in the **device's local date**.
- **Durations** are integer **minutes**.
- **Times** in configs are `"HH:MM"`, 24-hour.
- **`timezone`** from `/sync` is the family's IANA zone (e.g. `Asia/Manila`). Use it for "today", weekends and
  school nights, so the device agrees with what the parent sees even when its own zone differs.
- **App names** are trimmed display names, 1–80 characters. They are the key that links events, usage and app rules
  (see [Known gaps](#c7-known-gaps)).

#### Being "seen"

Every authenticated call updates the device's `lastSeenAt`. `/sync` and `/report` also update `battery`,
`osVersion` and `appVersion` when sent. A device that makes no call for **24 hours** shows as offline to parents and
raises "Device hasn't synced in over a day"; the next call resolves it.

---

### C2. Shared objects

#### ProtectionConfig

Every protection is a config object with a `key` and that protection's fields. The same shape is used for the
child's `policy` and for configuration `requests`; `/report` sends the same fields without `key`.

```json
{ "key": "BEDTIME", "enabled": true, "start": "21:30", "end": "06:00", "days": "EVERY_DAY" }
```

All 10 shapes and their bounds are in [§C5](#c5-enums-and-config-reference). The type is `ProtectionConfig` in
[src/lib/protections.ts](../src/lib/protections.ts).

#### PolicyEntry

```json
{ "key": "SCREEN_TIME", "config": { "key": "SCREEN_TIME", "dailyMinutes": 180, "weekendMinutes": 240 } }
```

The child's current settings, one per protection. **This is what the device enforces**, including offline.

#### Request

```json
{ "id": "cmujesvhf00vnncko3bmhqh76", "key": "BEDTIME",
  "config": { "key": "BEDTIME", "enabled": true, "start": "21:00", "end": "06:30", "days": "SCHOOL_NIGHTS" } }
```

A change a parent made that this device hasn't verified yet. Apply `config`, read the setting back from the OS, and
report it. Only `APPLY` requests are sent; guided setup (the parent changes the setting by hand on the device) never
appears here, but the device's next report verifies it the same way.

#### AppRule

```json
{ "name": "Roblox", "approval": "ALLOWED", "dailyLimitMinutes": 60 }
```

| `approval` | Device behavior |
|---|---|
| `ALLOWED` | Usable, subject to screen time, bedtime and its own `dailyLimitMinutes` |
| `ALWAYS_ALLOWED` | Not paused by the daily screen-time limit or a category limit; bedtime and its own `dailyLimitMinutes` still apply |
| `FILTERED` | Blocked, like `BLOCKED` (reserved for content filtering). Asking for it reaches the parent as for a blocked app |
| `BLOCKED` | Always shows the block screen. Opening it sends `APP_BLOCKED` |
| `PENDING` | Blocked, with the "Waiting for your parent" screen |
| Not in the list | New app. With App Approval on, block it and send `APP_REQUESTED`; otherwise allow it and send `APP_INSTALLED` |

Each entry also has `category`, and `categoryLimits` caps a category's total: see
[child-app-spec.md §7](child-app-spec.md#7-apps-approval-blocking-and-per-app-limits). Apps that were on the phone
before pairing join the list from `/usage`.

---

### C3. Endpoints

#### `POST /pair` → `201`

No auth. Called once, on the child's device, after the parent creates a code
(`POST /children/{id}/pairing-code` in the [parent API](#post-childrenidpairing-code--201)), or by the same app
just before it switches to child device mode ([A4](#a4-moving-between-modes)).

| Field | Type | Rules |
|---|---|---|
| `code` | string | The 8-character code. Case-insensitive; spaces and dashes are ignored (`"k7pq-2m9x"` works) |
| `platform` | `"ANDROID"` \| `"IOS"` | |
| `name` | string | 1–60 chars. Shown to parents everywhere (`"Mia's Galaxy A15"`) |
| `model` | string | 1–60 chars (`"SM-A155F"`) |
| `kind` | `"PHONE"` \| `"TABLET"`, optional | Default `PHONE` |
| `osVersion` | string | 1–40 chars |
| `appVersion` | string, optional | ≤ 20 chars |

```json
{ "code": "K7PQ2M9X", "platform": "ANDROID", "name": "Mia's Galaxy A15", "model": "SM-A155F",
  "kind": "PHONE", "osVersion": "14", "appVersion": "1.0.0" }
```

Response: `{ deviceId, token, childName }`. Store the token before doing anything else.

| Status | `error` | Show |
|---|---|---|
| `400` | "Pairing code is invalid or expired" | "That code didn't work. Codes last 15 minutes and only the newest one works. Ask for a new code." Codes are single-use |
| `400` | "This code is for the eGuard browser extension…" | The message as-is |
| `409` | "Device limit reached for this plan" | "No free device slots. A parent can remove a device, then use the same code." The code is given back, so it still works |
| `429` | "Too many attempts…" | 20 tries per 15 minutes per IP. "Wait a few minutes and try again" |

On success the server:
- makes the device the child's **primary** device if the child has none
- raises an INFO alert "New device synchronized" for the parents
- sets `fullReportRequested` so the first `/sync` asks for a full report and Configuration Health is known at once

Connected browsers count toward the same device limit as phones and tablets.

#### `POST /sync`

The heartbeat. Call it every `nextSyncSeconds`, at app start, when the network returns and after boot.

```json
{ "battery": 72, "osVersion": "14", "appVersion": "1.0.0", "pushToken": "fcm-registration-token…" }
```

All fields are optional (`battery` 0–100 or `null`, `osVersion` ≤ 40, `appVersion` ≤ 20, `pushToken` ≤ 4096 or
`null`); an empty body is fine. An invalid body is ignored rather than refused.

`pushToken` is the app's FCM registration token (on iOS, from the Firebase Messaging SDK). With it, a parent's change
wakes the device: a data-only FCM message `{ "type": "sync", "reason": "config" | "check" | "apps" | "extra_time" }`,
high priority on Android and a background push on iOS. On receiving it, run one sync cycle. Send it on every
`/sync`; leaving it out keeps the saved one, `null` clears it.

```json
{
  "deviceId": "cmujeom5j000wncgs0ylb00q4",
  "childName": "Mia",
  "policy": [
    { "key": "SCREEN_TIME", "config": { "key": "SCREEN_TIME", "dailyMinutes": 180, "weekendMinutes": 240 } },
    { "key": "BEDTIME", "config": { "key": "BEDTIME", "enabled": true, "start": "21:00", "end": "06:30", "days": "SCHOOL_NIGHTS" } }
  ],
  "requests": [
    { "id": "cmujesvhf00vnncko3bmhqh76", "key": "BEDTIME",
      "config": { "key": "BEDTIME", "enabled": true, "start": "21:00", "end": "06:30", "days": "SCHOOL_NIGHTS" } }
  ],
  "apps": [
    { "name": "YouTube", "approval": "ALLOWED", "dailyLimitMinutes": 60 },
    { "name": "Roblox", "approval": "BLOCKED", "dailyLimitMinutes": null }
  ],
  "extraTimeUntil": null,
  "fullReportRequested": false,
  "nextSyncSeconds": 300,
  "timezone": "Asia/Manila",
  "features": { "locationSharing": true },
  "minAppVersion": null
}
```

| Field | Notes |
|---|---|
| `childName` | Whose device this is now. A parent can rename the child or move the device to another child, so show this one and save it, not the name from `/pair` |
| `policy` | `PolicyEntry[]`, one per protection. The source of truth for enforcement: the verified setting, or the change still waiting to be verified when there is one (as for `BEDTIME` above). Save it locally and reconcile: if the policy says a protection is on and the device doesn't have it, apply it again |
| `requests` | `Request[]`, oldest first. Apply them in order. **A request is sent again in every `/sync` until the device reports that protection**, so a lost response never strands a change. Applying the same config twice must be harmless |
| `apps` | `AppRule[]`: every app rule for the child, from all their devices |
| `extraTimeUntil` | ISO time, or `null`. Extra time a parent gave: until then, don't pause apps for bedtime, the daily limit, app limits or category limits. `BLOCKED`, `FILTERED` and pending apps stay blocked. After the child asks for more time, sync every ~20 seconds for a while so a "yes" reaches them quickly. While it runs, `nextSyncSeconds` is 60, so a parent ending it early reaches the device within a minute |
| `fullReportRequested` | A parent ran a check, or the device just paired. Send `POST /report { full: true }` with every supported protection right away: the parent's check waits only **12 seconds** (30 when an iOS device hasn't answered) |
| `nextSyncSeconds` | When to call again. 300, or 60 while extra time runs. Always 60 for computers (no push wakes them) |
| `timezone` | The family's zone. Use it for days, weekends and school nights |
| `features.locationSharing` | `false` on plans without location: don't collect or send fixes, whatever `LOCATION` says. Still report the `LOCATION` protection |
| `minAppVersion` | When set and above the app's version, show an update screen and stop syncing until updated. `null`: no minimum |

The first `/sync` that carries a new request marks it `DELIVERED`, which the parent sees as progress. `/sync` also
resolves the device's "hasn't synced" alert.

#### `POST /report`

The configuration the device **actually has**, read back from the OS. This is the only way a setting becomes
"verified" for the parent, so never report the value you were asked to apply: report what the OS says.

| Field | Type | Notes |
|---|---|---|
| `protections` | `[{ key, config, error? }]`, ≤ 20 | `config` is the protection's fields, without `key` (the server adds it). `error` (≤ 200 chars, optional): the device tried to apply it and couldn't, in words a parent can read ("Choose at least one app or category first."). Still send what the OS really has in `config`; the parent then sees "*Screen Time* couldn't be applied on *Mia's iPad*: …" instead of a bare mismatch, and a change that fails records the reason |
| `full` | boolean, optional | `true` when this report covers every protection the device supports (answering `fullReportRequested`) |
| `battery`, `osVersion`, `appVersion` | optional | As in `/sync` |

```json
{
  "full": true,
  "protections": [
    { "key": "SCREEN_TIME", "config": { "dailyMinutes": 180, "weekendMinutes": 240 } },
    { "key": "BEDTIME", "config": { "enabled": true, "start": "21:00", "end": "06:30", "days": "SCHOOL_NIGHTS" } },
    { "key": "LOCATION", "config": { "sharing": true } }
  ],
  "battery": 71
}
```

Response: `{ "ok": true }`, plus `ignored: [{ key, error }]` when some entries didn't match their schema. Those are
skipped and the rest of the report still counts. Fix the app; don't retry them. `429` after 120 reports an hour from
one device: wait a few minutes, then send one report with the current state.

Send a report:
- after applying anything from `/sync`, with **every protection that arrived in `requests`**, even if nothing changed
- after any change on the device (the child or someone else turned something off)
- in full when `fullReportRequested` is true

Configs must have **exactly** the fields in [§C5](#c5-enums-and-config-reference): an extra or missing field puts the
entry in `ignored`. Reported bounds are wider than the parent's (`0` minutes when the OS has no limit, any age rating
0–21), so report the real value even when the parent couldn't set it.

What the server does with each entry:

1. **Open requests** for that protection on this device: if the reported config equals the requested one (exact
   field-by-field match), the request is `VERIFIED`, the child's policy is updated and a history entry is written.
   A delivered request that doesn't match is `FAILED` with `failureReason: "Device reported …"`.
2. **Status**: the config is checked against the child's policy and the platform's capability, giving `PASS`,
   `WARNING`, `ACTION_REQUIRED`, `NOT_CONFIGURED` or `UNSUPPORTED`. This feeds Configuration Health.
3. **Alerts**: a protection that stops passing raises "Protection setting changed" (or "Location sharing turned off")
   unless a parent's change for it is less than 6 hours old. One that passes again resolves its alert.
4. **Location**: reporting `LOCATION` with `sharing: false` deletes the device's last position on the server.
5. **Check**: a `full: true` report while a check is waiting completes this device's part of it and clears
   `fullReportRequested`.

#### `POST /usage`

Daily screen-time totals. Idempotent per device and day: the latest total wins, so resend freely.

| Field | Type | Rules |
|---|---|---|
| `date` | `"YYYY-MM-DD"` | The device's local date. A real day within the last 30 days (older queued totals get `400`: drop them) |
| `totalMinutes` | int | 0–1440. Foreground time across all apps, not counting eGuard's own screens |
| `apps` | `[{ name, minutes }]`, optional | ≤ 200 entries, `minutes` 0–1440. Leave out apps with 0 minutes |
| `hourly` | 24 ints, optional | Minutes per local hour (index 0 = midnight), each 0–60. Without it the parent's hourly chart is hidden |

```json
{ "date": "2026-09-27", "totalMinutes": 134,
  "apps": [ { "name": "YouTube", "minutes": 54 }, { "name": "Roblox", "minutes": 42 } ],
  "hourly": [0,0,0,0,0,0,0,7,7,7,7,7,3,3,3,3,12,12,12,27,12,12,0,0] }
```

Response: `{ "ok": true }`. Send today's running totals every sync cycle, and a final total for yesterday once after
midnight. Totals are kept per device, and a child's phone and tablet are added together for the parent. Sending
`hourly` once and leaving it out later keeps the earlier hourly values. Up to 300 different apps are kept per device
and day; names past that are ignored. `429` after 120 usage reports an hour from one device: keep the newest total
per day and send it later (a backlog after a few days offline fits easily). Every app named here that isn't on the
child's list yet is added as `ALLOWED`, without an alert (it was on the phone before eGuard; `"Others"` is skipped),
so the parent can block or limit it and it comes back in `/sync` `apps`. A child's list keeps up to 1000 apps.

#### `POST /location`

The device's current position.

| Field | Type | Rules |
|---|---|---|
| `lat` | number | −90 to 90 |
| `lng` | number | −180 to 180 |
| `accuracyM` | number, optional | 0–100000 metres. Over 200 shows as "approximate" to the parent |
| `placeLabel` | string, optional | ≤ 80 chars. Blank counts as none. Don't reverse-geocode on the device in v1. A saved place the fix falls inside overrides it |
| `at` | ISO 8601 time, optional | When the OS took the fix (Android `Location.time`, iOS `CLLocation.timestamp`). **Send it**: a last-known or queued fix can be hours old, and without `at` it's shown to the parent as taken on arrival ("Live"). A time in the future counts as now. A fix older than 24 hours, or not newer than the one already stored, is dropped (still `{ ok: true }`). Without it: the time it arrives |

```json
{ "lat": 14.6507, "lng": 121.0494, "accuracyM": 25, "at": "2026-10-13T05:12:40Z" }
```

Response: `{ "ok": true }`, including when the fix is dropped. `429` past 240 fixes an hour from one device: wait a
few minutes and send only the newest. Send fixes only when all three hold:
- the child's `LOCATION` policy has `sharing: true`
- the OS permission is granted
- `/sync` says `features.locationSharing: true`

The server also drops fixes on plans without location, and while the device's last `LOCATION` report said sharing
was off. Each fix **replaces the previous one whole**: a field you leave out is cleared, not kept. With the family's
location history on, a fix within 150 m of this device's last visit, or of a visit another of the child's devices
is at now, extends it; others start a new visit. A visit with a single fix shows as "Passing by".

At rest, one fix every 15 minutes keeps the parent's map "live" (it shows "Last seen" after 20 minutes, leaving a
margin for a late fix).

#### `POST /events`

Things that happened on the device that parents should hear about. Protection changes are **not** events: they're
detected from `/report`.

| `type` | Extra fields | Send when | Server effect |
|---|---|---|---|
| `APP_INSTALLED` | `app`, `ageRating?` (0–21) | A new app appears and App Approval is off | Adds the app to the child's list; INFO alert "New app installed" the first time the name is seen for this child (from any device). If App Approval (or Downloads "parent approval") is on anyway, the new app is added as `PENDING` with an "App approval requested" alert, as `APP_REQUESTED` would (Android 1.0.9 and earlier send both events). On a plan that limits apps (Free), the alert names the app only if the parent's Apps list shows it; otherwise it says "An app was installed" with the upgrade line |
| `APP_REQUESTED` | `app`; computers also `ids?`, `source?`, `category?` (as `APP_INSTALLED`) | The child taps Ask, or a new app is installed with App Approval on | Marks the app `PENDING` and raises an ATTENTION "App approval requested". One open request per app. A new app keeps the `category` and `source` sent, and its `ids` are remembered (the computer agent sends them for an app its scan hadn't reported) |
| `APP_BLOCKED` | `app` | The child opens a `BLOCKED` app | INFO "App blocked", at most once per app per device per hour. On Free, an app the Apps list hides isn't named ("tried to open a blocked app"), and those share one alert per hour |
| `LIMIT_REACHED` | `minutes` (0–1440, the limit) | The daily screen-time limit is hit | INFO "Screen time limit reached", at most once per device per 12 hours |
| `TIME_REQUESTED` | `app?`, `reason?` (`DAILY_LIMIT`, `APP_LIMIT`, `CATEGORY_LIMIT`, `BEDTIME`) | The child taps "Ask for more time" on a limit or bedtime block screen | ATTENTION "More time requested" (Screen time). One open request per child across devices; after a parent answers it (extra time, or not now), a new one only 10 minutes later. `app` is named only if the plan's Apps list shows it |
| `USER_LEFT` | none | Android: the phone switched to another user or a guest profile (`ACTION_USER_BACKGROUND`), where eGuard doesn't run | ATTENTION "Switched to another user" (Devices), open until `USER_RETURNED` |
| `USER_RETURNED` | `awayMinutes` (0–20160) | Android: back on the child's profile (`ACTION_USER_FOREGROUND`) | Resolves "Switched to another user"; from 1 minute away, a dismissible ATTENTION "Used on another user" saying for how long nothing was enforced |

```json
{ "type": "APP_REQUESTED", "app": "Minecraft", "eventId": "4f1c2a9e-6b0d-4c55-9a51-0d7f3f7e2b10" }
```

Response: `{ "ok": true }`.

- `APP_REQUESTED` for an app the parent already allowed (`ALLOWED`, `ALWAYS_ALLOWED`) changes nothing (a `FILTERED` app is asked for like a blocked one)
  and returns `{ ok: true, approval }`: unlock it locally. For a `BLOCKED` app it stays blocked, the parent is told
  at most once a day, and the response is `{ ok: true, approval: "BLOCKED" }`. Show "Your parent said no for now".
- **`eventId`** (optional, 8–64 chars, e.g. a UUID): make one per event and send the same one on every retry. A repeat
  from the same device within 7 days returns `{ "ok": true, "duplicate": true }` and does nothing. Without it, a
  retried event counts as new.
- `429` after 120 events an hour from one device. Keep the event queued and retry later.
- Legacy names from Android 1.0.7 and earlier are still accepted: `NEW_APP` as `APP_INSTALLED`, and `APP_REQUEST` as
  `APP_REQUESTED`, except that an `APP_REQUEST` for an app the parent already allowed is taken as `TIME_REQUESTED`
  (those builds sent it from "Ask for more time"). New builds send the names above.

---

### C4. Flows

#### C4.1 Pairing

```
parent app: POST /api/mobile/v1/children/{id}/pairing-code  → code (8 chars, 15 min)
child app:  enter code ─► name the device
            POST /pair ── 400/409/429 ──► show the message, keep the typed code
                 │ 201
            save token (Keystore / Keychain)
            permission screens (one per protection)
            POST /sync                       → policy, requests, fullReportRequested: true
            apply policy + requests, read back
            POST /report { full: true, protections: every supported key }
            "You're all set"
```

Pair before asking for permissions, so a bad code doesn't waste the permission steps.

#### C4.2 The sync cycle

```
POST /sync
  ├─ minAppVersion above ours?  → update screen, stop
  ├─ save policy + apps locally (enforced offline)
  ├─ for each request (in order): apply config ─► read back from the OS
  ├─ POST /report with every key from requests, plus anything else that changed
  └─ fullReportRequested?  → POST /report { full: true, protections: every supported key }
POST /usage (today)
POST /location (if allowed, see C3)
schedule the next run in nextSyncSeconds
```

#### C4.3 A parent changes a setting

```
parent:  PUT /children/{id}/protections/BEDTIME            → batch, request PENDING
device:  POST /sync      → request in `requests`            → DELIVERED
device:  apply, read back, POST /report { BEDTIME: … }
            matches   → VERIFIED   (parent sees "Saved and verified")
            different → FAILED     (parent sees "Device reported …")
```

Guided setup (iOS Web, Downloads, Location): the request isn't sent to the device. The parent changes the setting by
hand and taps "Verify now", which sets `fullReportRequested`. The device's full report then verifies it.

#### C4.4 Offline and retries

- Queue `/report`, `/usage` and `/events` on disk while offline and send them in order when back.
  Keep at most the newest `/report` per protection and the newest `/location`.
- Retry `5xx` and network errors with backoff (30 s to 15 min, with jitter). Drop items that get `400`.
- `401` at any point: the device was removed. Stop everything.

#### C4.5 Removal

A parent removes the device (or the child, or the family). The token stops working at once, and the family gets a
"Device removed" alert. The device finds out on its next call (`401`): stop enforcing, clear stored data and the
token, and show the removal screen. There is no way yet for the device to unpair itself (gap G6).

---

### C5. Enums and config reference

#### Protections and their configs

`/report` accepts exactly these fields. The "Parent range" is what a parent can request, so it's what arrives in
`policy` and `requests`; the "Reported range" is what the device may send back.

| KEY | Fields | Parent range | Reported range |
|---|---|---|---|
| `SCREEN_TIME` | `dailyMinutes`, `weekendMinutes` | 15–1440 | 0–1440 (0: no limit on the device) |
| `BEDTIME` | `enabled` bool, `start` / `end` `"HH:MM"`, `days` `EVERY_DAY` \| `SCHOOL_NIGHTS` | start ≠ end when enabled | any valid times |
| `APP_RESTRICTIONS` | `maxAgeRating` | 4–18 | 0–21 |
| `APP_APPROVAL` | `enabled` bool | | |
| `CONTENT` | `maxAgeRating` | 4–18 | 0–21 |
| `WEB` | `mode` `OFF` \| `FILTER` \| `ALLOWLIST`, `blockedSites` int | ≥ 0 | 0–1,000,000 |
| `DOWNLOADS` | `requireApproval` bool | | |
| `LOCATION` | `sharing` bool | | |
| `NOTIFICATIONS` | `quietDuringBedtime` bool | | |
| `UNINSTALL_PROTECTION` | `enabled` bool | | |

**Weekends and school nights**, in the family's `timezone`:
- `weekendMinutes` applies on Saturday and Sunday (`limitOn` in [src/lib/queries.ts](../src/lib/queries.ts)).
- A bedtime window belongs to the night it starts on, or to the night before when it starts before noon.
  `SCHOOL_NIGHTS` are Sunday to Thursday nights. So 21:30–06:00 covers Thursday 21:30 to Friday 06:00 but not Friday
  or Saturday night. Reference implementation: `bedtimeActive` in [src/lib/protections.ts](../src/lib/protections.ts).

#### Platform capability

How each protection is applied. **Only report protections the platform supports**: iOS never sends
`NOTIFICATIONS`, Android never sends `APP_RESTRICTIONS` or `CONTENT`. `UNSUPPORTED` never counts against the child's
health. In a `full` report, a protection the device can apply but leaves out is taken as not in force.

| KEY | Android | iOS |
|---|---|---|
| `APP_RESTRICTIONS` | PARENT_SET | AVAILABLE |
| `CONTENT` | PARENT_SET | AVAILABLE |
| `WEB` | GUIDED | AVAILABLE |
| `LOCATION` | AVAILABLE | GUIDED |
| `NOTIFICATIONS` | AVAILABLE | UNSUPPORTED |
| All others | AVAILABLE | AVAILABLE |

| Capability | What the device does |
|---|---|
| `AVAILABLE` | Applies requests itself, then reports |
| `GUIDED` / `VERIFY_ONLY` | A parent sets it by hand on the device; the device only reads it back and reports |
| `PARENT_SET` | Nothing: the parent sets it in another app (Google Play) and confirms. Leave it out of reports; the server ignores it |
| `UNSUPPORTED` | Nothing, and leaves it out of reports |

How each protection is enforced on each platform is in [child-app-spec.md › 6](child-app-spec.md#6-enforcing-the-10-protections).

#### Other enums

| Enum | Values |
|---|---|
| `platform` | `ANDROID`, `IOS` |
| `kind` | `PHONE`, `TABLET` |
| app `approval` | `ALLOWED`, `ALWAYS_ALLOWED`, `FILTERED`, `BLOCKED`, `PENDING` |
| event `type` | `APP_INSTALLED`, `APP_REQUESTED`, `APP_BLOCKED`, `LIMIT_REACHED`, `TIME_REQUESTED`, `USER_LEFT`, `USER_RETURNED` |

---

### C6. What the parent sees

Each device call shows up in the parent API like this. Use it to check the app end to end.

| Device call | Parent API |
|---|---|
| `/pair` | New entry in `GET /devices` and `GET /children/{id}` `devices`; "New device synchronized" alert |
| any call | `Device.lastSeenAt` / `lastSeenLabel`, `state` leaves `offline` |
| `/sync` | Batch items move from `PENDING` to `DELIVERED` |
| `/report` | Batch items `VERIFIED` / `FAILED`; `GET /health` checks; `GET /children/{id}/protections` `devices[].reported` |
| `/usage` | `GET /children/{id}/screen-time`, `today` in `GET /children/{id}` |
| `/location` | `GET /children/{id}/location`, `GET /locations`, visits when history is on |
| `/events` | `GET /alerts`, and `GET /children/{id}/apps?filter=pending` for requests |

---

### C7. Known gaps

Tracked in [child-app-spec.md › Server gaps](child-app-spec.md#13-server-gaps). The ones that affect this API:

| # | Gap | For now |
|---|---|---|
| G1 | ~~No way to wake the device~~ **Done (2026-10-14):** send `pushToken` on `/sync`; changes, checks, app rules and extra time send a silent "sync now" | Keep polling every `nextSyncSeconds` too: iOS may hold a background push back, and nothing is sent before the device has a token |
| G3 | iOS may not be able to read back settings made in the Settings app, or send usage from the report extension | Prototype before promising iOS verification and screen-time charts |
| G4 | Apps are keyed by display name only | Send the exact display name everywhere; same-name apps share one rule |
| G5 | Done 2026-10-13: `ALWAYS_ALLOWED` and `FILTERED` defined as Android enforces them | The spec's section 7 |
| G6 | No rename or unpair from the device | Choose the name before pairing. Only a parent can remove the device |
| G7 | No website access requests from phones | Only the browser extension has them ([browser-extension-api.md](browser-extension-api.md)) |
| G9 | "Offline" takes 24 hours | none |
