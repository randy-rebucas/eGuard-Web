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
| **Credential** | Session token from `/auth/login`, `/auth/register`, `/auth/social` (or after two-step verification) | Device token from `POST /pair`, using a code a parent made |
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
| **Push** | `POST /me/push-tokens` (FCM) | None yet: changes arrive on the next `/sync` ([C7](#c7-known-gaps) G1) |
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
  (`logout?pushToken=`) before switching to child device mode.
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
capabilities (`AVAILABLE`, `GUIDED`, `VERIFY_ONLY`, `UNSUPPORTED`) and the same app `approval` values. Parents may
only set values within the "Parent range"; devices report the real value within the wider "Reported range"
([C5](#c5-enums-and-config-reference)).

---

## Part B: Parent API

For **parent mode**: a parent or guardian signed in on their own phone.

- **Base URL:** `https://www.eguard.family/api/mobile/v1`
- **Format:** JSON in and out, UTF-8. The only exception is child photos (raw image bytes).

### P1. Conventions

#### Authentication

Sign in (`/auth/login`, `/auth/register` or `/auth/social`) returns:

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
| 429 | `rate_limited` | 5 failed sign-ins in 10 minutes (per email and IP) |
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
  "notifications": { "notifyPush": true, "notifyEmail": true, "notifyApproval": true, "weeklySummary": true },
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
  "primaryDevice": { "id": "cmujeom5j000wncgs0ylb00q4", "name": "Galaxy A54", "platform": "ANDROID" }
}
```

| Field | Notes |
|---|---|
| `status` | `protected` (all checks pass on devices that are all online), `attention` (something to fix, or a device offline), `notconfigured` (no devices yet). Design labels: "Protected" / "Attention" |
| `photoUrl?` | Path relative to the host. Load it **with the bearer header**. The `?v=` query changes when the photo changes, so cache by URL |
| `todayLimitMinutes` | The limit that applies today (weekday or weekend) |

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
- `action?` is the alert's button. Route it by `type`:

| `action.type` | Extra fields | Open |
|---|---|---|
| `FIX_SETTING` | `childId`, `key` | That protection's edit screen for the child ([§P4.7](#p47-protections-and-configuration-batches)) |
| `VIEW_DEVICE` | `deviceId` | Device detail |
| `REVIEW_APPS` | `childId` | App Management (Pending tab for requests) |
| `VIEW_SCREEN_TIME` | `childId` | Screen Time |
| `VIEW_HISTORY` | `childId` | Child profile › History |
| `MANAGE_SUBSCRIPTION` | none | Subscription |

#### Batch (configuration progress)

Returned by `PUT /children/{id}/protections/{KEY}`, `POST /children/{id}/setup` (as `progress`), and
`GET /batches/{id}`.

```json
{
  "batchId": "c8ff86dd-2ab7-416b-9295-345280db658a",
  "childId": "cmujesv1y00tlnckonhe1ztou",
  "done": false,
  "summary": { "total": 1, "verified": 0, "failed": 0, "awaitingParent": 1, "inProgress": 0, "cancelled": 0 },
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
          "deviceName": "iPhone 13",
          "platform": "IOS",
          "mode": "GUIDED",
          "status": "AWAITING_PARENT",
          "failureReason": null,
          "offline": false,
          "from": "Off",
          "guide": [
            "Open Settings, tap Screen Time, then Content & Privacy Restrictions.",
            "Tap App Store, Media, Web & Games, then Web Content.",
            "Choose Limit Adult Websites."
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
| 3 | Create Account | `POST /auth/register`, `POST /auth/social` (Continue with Apple/Google), `POST /auth/login` (Sign in) |
| 4 | Add Child | `POST /children` → `PUT /children/{id}/photo` |
| 5 | Protection Profile | `GET /profiles?age=` |
| 6 | Recommended Setup | `GET /children/{id}/recommendations?profile=` |
| 7 | Setup Progress | `POST /children/{id}/pairing-code` ("Set up supervision": Family Sharing on iOS, Family Link on Android; help articles `ios-family-sharing` / `android-family-link`), `POST /children/{id}/setup`, poll `GET /batches/{id}`, `POST /batches/{id}/confirm` |
| 8 | Configuration Health | `GET /health?childId=` ("Fix N settings" uses `toFix`) |
| 9 | Setup Complete | Use the last `GET /batches/{id}` (the verified items) |
| 10 | Dashboard | `GET /dashboard` |
| 11 | Child Profile | `GET /children/{id}` (Overview), `/screen-time`, `/apps`, `/protections`, `/history` |
| 12 | Screen Time | `GET /children/{id}/screen-time?period=today\|7d\|30d` |
| 13 | App Management | `GET /children/{id}/apps?filter=`, `PATCH /apps/{id}`, `POST /children/{id}/apps` (Request to Install App) |
| 14 | Location | `GET /children/{id}/location`, "View All" → `GET /children/{id}/location/visits`, `GET /locations` |
| 15 | Alerts | `GET /alerts?filter=`, `POST /alerts/{id}/read`, `/read-all`, `/dismiss`, `GET /alerts/unread-count` (includes "App blocked") |
| 16 | Settings | `GET /family`, `/me`, `/me/notifications`, `/family/privacy`, `/me/sessions`, `POST /me/password`, `/me/two-factor`, `/me/identities`, `POST /me/export`, `DELETE /me`, `GET /organizations`, `POST /auth/logout` |
| 17 | Subscription | `GET /subscription`. Android upgrade: `GET /subscription/plans` → Play Billing → `POST /subscription/google-play` |
| 18 | Help & Support | `GET /help?q=`, `GET /help/{slug}`, `POST /support/tickets` |
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

##### `POST /auth/register` → `201`

Creates a new family with this parent as `FAMILY_ADMIN` and signs them in.

| Field | Type | Rules |
|---|---|---|
| `name` | string | ≥ 2 chars |
| `email` | string | valid email. Case doesn't matter; it's stored lowercase. One account per mailbox: `randy+kids@…`, and for Gmail `r.andy@gmail.com` / `randy@googlemail.com`, count as `randy@gmail.com` (`409`) |
| `password` | string | ≥ 10 chars |
| `familyName` | string, optional | ≥ 2 chars. Default: last name + " Family" ("Cruz Family"), or "Randy's Family" |
| `guardian` | `true` | Required. The "I'm a parent or legal guardian, 18 or older" checkbox. Children never get accounts; parents add them after sign-up |

Response: `{ token, expiresAt, user }`. Errors: `400` (field message, e.g. `guardian: Confirm you're a parent…`), `409 conflict` (email already registered — also returned to every duplicate of a double-tapped submit, so treat it as "Sign in instead").

The new parent is signed in straight away with `user.emailVerified: false`, and we email them a verification link.

##### Email verification

Parents must verify their email before they can pair a child's device. Everything else works while unverified.

- New sign-ups, parents added by the admin, and anyone who changes their email get a link:
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
passwords in 15 minutes the account is locked for the rest of that window, even with the right password; offer
"Forgot password?", since a reset lifts the lock.

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
| `PATCH /me` | any of `{ name, email, password, timezone }` | `User`. `timezone` (IANA, e.g. `Asia/Manila`) is the family's: only the family admin can change it (`403 forbidden` for another parent sending a different zone). Changing `email` needs the current `password` (`403 wrong_password`, or `403 password_not_set` when `hasPassword` is false). `409` if the email is taken. A new email sets `emailVerified: false`, sends a link to the new address, and unlinks Apple/Google sign-ins |
| `DELETE /me` | `{ password }`, or `{ confirm: "DELETE" }` when `hasPassword` is false ([Confirming deletions](#confirming-deletions)) | `{ ok, deleted: "family" \| "account" }`. **Deletes the account.** The family admin's account deletes the whole family (children, devices, history, other parents). Another parent's account removes only them. Sign out locally afterwards |
| `POST /me/export` | none | The family's data as a JSON file (`Content-Disposition: attachment; filename="eguard-family-export.json"`): parents, children, settings, devices, app rules, screen time, location visits, history, alerts, browsers, support requests and purchases. Never includes passwords or tokens. Save it or hand it to the share sheet. Any parent can export; each export is recorded in the family's audit log. Same file as the website's export |
| `GET /me/identities` | none | `{ identities: [{ id, provider, email, createdAt }] }`: linked Apple/Google sign-ins |
| `DELETE /me/identities/{id}` | none | `{ ok }`. `409` if it's the only way to sign in (no password set) |
| `POST /me/password` | `{ current, next }` | `{ ok, message }`. `403 wrong_password`, `400` if `next` < 10 chars. **Signs out every other session**; this one stays |
| `GET /me/notifications` | none | `{ notifyPush, notifyEmail, notifyApproval, weeklySummary }`. `notifyEmail` emails alerts that need attention; `notifyPush` pushes the same alerts to this parent's phones (plans with `realtimeAlerts`); `notifyApproval` also sends a child's requests for an app or a blocked website, by whichever of email and push is on |
| `PATCH /me/notifications` | any subset of those booleans | Same object, updated |
| `POST /me/push-tokens` | `{ token, platform: "IOS" \| "ANDROID" }` | `201 { ok }`. `token` is an **FCM registration token** on both platforms (iOS: from the Firebase Messaging SDK, not the raw APNs token). Call it after sign-in and whenever FCM rotates the token. Re-registering the same token under another parent moves it. Tokens FCM reports as uninstalled are removed |
| `DELETE /me/push-tokens` | `{ token }` | `{ ok }` |
| `GET /me/sessions` | none | `{ sessions: [{ id, userAgent, createdAt, lastSeenAt, current }] }` |
| `DELETE /me/sessions` | none | `{ signedOut: n }`. Signs out everywhere except this session |
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
  "recentAlerts": [ …Alert (up to 3) ],
  "unreadAlerts": 4
}
```

`summary` is one of:
- "Add your first child to get started." when the family has no children yet (show the Add Child call to action)
- "N children need attention." / "1 child needs attention."
- "Pair Mia's device to start protecting them." or "N children have no paired device yet." when a child has no device
  (show the pairing call to action)
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

##### `POST /children/{id}/setup` → `201`

"Review & Configure". Sends a whole profile in one batch.

```json
{
  "profile": "BALANCED",
  "overrides": [ { "key": "SCREEN_TIME", "dailyMinutes": 150, "weekendMinutes": 200 } ]
}
```

`overrides` holds full config objects (see [§P6](#p6-enums-and-config-reference)) that replace the profile's values,
at most one per key.

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
| `profile` | `BALANCED` \| `PROTECTED` \| `CUSTOM`, optional | Initial settings. Default `PROTECTED` |

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
- `deviceProtection.state` is `healthy`, `issues`, `offline` or `no_devices`.
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
- `capability` says how eGuard can apply this protection on the device (`AVAILABLE`, `GUIDED`, `VERIFY_ONLY` or
  `UNSUPPORTED`).
- A protection the parent turned off passes once the device confirms it's off (as above): it's the parent's choice,
  not something to fix. `NOT_CONFIGURED` means the child has no setting for it and the device has it off.
- `reportedLabel` is `"Not reported"` for a device that hasn't reported this protection yet.

##### `PUT /children/{id}/protections/{KEY}` → `202` (or `200` with no device)

Change one protection. `KEY` is case-insensitive. The body is that protection's config **without** `key`:

```json
PUT /children/{id}/protections/BEDTIME
{ "enabled": true, "start": "21:00", "end": "06:30", "days": "SCHOOL_NIGHTS" }
```

The response is a `Batch`. Poll `GET /batches/{batchId}`.

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
`confirmed` (the number of requests moved).

##### `DELETE /batches/{id}`

Cancels everything in the batch that isn't verified yet. Response: `{ "cancelled": 8 }`. Verified items stay verified.

#### P4.8 Screen time

##### `GET /children/{id}/screen-time?period=today|7d|30d`

`period` defaults to `today`. Any other value returns `400`. `30d` is an advanced report: without
`entitlements.advancedReports` (Family Pro) it returns `403 plan_required`, so lock the 30-day tab on other plans.

```json
{
  "period": "today",
  "from": "2026-09-27",
  "to": "2026-09-27",
  "totalMinutes": 134,
  "averageMinutes": 134,
  "previousAverageMinutes": 187,
  "limitMinutes": 240,
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
| `previousAverageMinutes` | Average for the same length of time just before (for "↓ 12% vs last week") |
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
      "requested": false, "allowed": true, "dailyLimitMinutes": null, "todayMinutes": 42, "installedAt": "2026-09-27T00:56:40.499Z" }
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

##### `PATCH /apps/{id}`

| Field | Type | Notes |
|---|---|---|
| `approval` | `ALLOWED` \| `ALWAYS_ALLOWED` \| `FILTERED` \| `BLOCKED`, optional | Switch on → `ALLOWED`, off → `BLOCKED`. Approving or declining a request also resolves its alert |
| `dailyLimitMinutes` | int 1–1440, or `null` to remove, optional | |

Send at least one field. Response:
`{ id, name, approval, approvalLabel, dailyLimitMinutes }`. The device picks up the change on its next sync (within
about 5 minutes).

##### `POST /children/{id}/apps` → `201`

"Request to Install App": the parent adds an app ahead of time.

```json
{ "name": "Khan Academy", "approval": "ALWAYS_ALLOWED", "dailyLimitMinutes": null }
```

`name` is 1–80 characters; `approval` is any app `approval` value and defaults to `ALLOWED`; `dailyLimitMinutes` is
1–1440 or `null`. Response: `201 { id, name, approval, approvalLabel, dailyLimitMinutes }`, the same shape as
`PATCH /apps/{id}`. Returns `409` if an app with that name is already on the child's list.

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
  pages them), and is empty unless `history.enabled`. The admin turns history on with
  `PATCH /family/privacy { keepLocationHistory: true }`. When it's off, show a prompt instead of the "Today" list.
- A visit with `stayed: false` is a fix taken while passing by (it lasted under about 4 minutes): show it as
  "Passing by", and leave it out of any list of places the child went. A device and another of the child's devices at
  the same place make one visit, not two. `spanLabel` reads "11:00 PM – 7:00 AM next day · 8 h" across midnight.
- `waitingForReport` names the device eGuard is waiting on when `state` is `waiting` only because no device has
  reported yet whether it shares ("Waiting for *Galaxy A54* to report whether location sharing is on"); otherwise
  `null`.
- To turn sharing on or off, change the `LOCATION` protection (`PUT /children/{id}/protections/LOCATION
  { "sharing": true }`). On iOS this is guided setup.

##### `GET /children/{id}/location/visits?limit=50&before=`

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
  "nextBefore": "2026-09-27T06:12:44.031Z"
}
```

With history off, the response is `{ "enabled": false, "visits": [], "nextBefore": null }`. Group sections by
`day.key`, like alerts.

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
manage them; 403 `plan_required` on Free (except `DELETE`).

| Request | Body | Response |
|---|---|---|
| `GET /places` | | `{ places: [{ id, name, lat, lng, radiusM }] }`, by name |
| `POST /places` | `{ name, lat, lng, radiusM? }`: name 1–40 characters, `radiusM` one of 100, 150 (default), 250, 500, 1000 | `201` the place. `400` past 30 places |
| `PATCH /places/{id}` | `{ name?, radiusM? }` (at least one) | the place |
| `DELETE /places/{id}` | | `{ ok: true }`; visits there lose its name unless another saved place covers them |

Offer "Name this place" on the child's current location and on a visit with no `placeId`, using its `lat` and `lng`.

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
| `GET /devices` | none | `{ devices: [ …Device ], limit: 8 }` |
| `GET /devices/{id}` | none | `Device` + `protections: [{ key, name, icon, capability, capabilityLabel, status, reportedLabel, message, lastVerifiedAt }]` (all 10) |
| `PATCH /devices/{id}` | `{ name?, isPrimary? }`: `name` 1–60 chars; `isPrimary: true` makes it its child's primary device (listed first, shown on the child's card; the previous primary stops being one). At least one field. Both are in the audit log | Same as GET |
| `POST /devices/{id}/move` | `{ childId, password }` (or `confirm: "DELETE"` without a password) | Same as GET. Moves the device to another child without pairing again: it gets that child's protections and apps on its next sync. Its reported protections are cleared (`firstCheck: true` until it reports again) and a full report is requested; its last position is cleared; its open configuration requests are cancelled; what it recorded stays with the old child. Becomes the new child's primary only if they have none; the old child's oldest remaining device takes over as primary. The family gets a "Device moved" alert. `400` if it already belongs to that child, `404` for an unknown device or child, `403 wrong_password` |
| `DELETE /devices/{id}` | `{ password }`, or `{ confirm: "DELETE" }` without one ([Confirming deletions](#confirming-deletions)), and optionally `deleteHistory: true` | `{ ok }`. The device is unpaired and its token stops working. `403 wrong_password` / `400 confirm_required` without the confirmation. The family gets a "Device removed" alert, emailed to parents, since eGuard stops verifying the device. By default the screen time, app usage and location visits recorded from the device are kept with the child (until the family's retention period, or the child is deleted); in location history their `deviceName` is `"Removed device"`. With `deleteHistory: true` they're deleted too. Offer this as an "Also delete what it recorded" option in the confirmation, unticked by default |
| `GET /browsers` | none | `{ browsers: [{ id, childId, childName, deviceLabel, browser, browserVersion, extensionVersion, platform, lastSeenAt, connected, createdAt, protectionState, offline }] }`: the eGuard browser extension installs. `connected: false` means eGuard disconnected it for security (its sign-in key was used from two places); remove it and add it again. `protectionState` is the extension's own answer from its latest health check: `PROTECTED`, `NEEDS_ATTENTION`, `ACTION_REQUIRED`, `SYNC_PAUSED` or `UNSUPPORTED`, and `null` before its first check (show "Waiting for first health check"). `offline: true` means it hasn't checked in for a day: show "Not seen for a day" instead of its last state, which can't be confirmed |
| `GET /children/{id}/browser-policy` | none | `{ version, safeBrowsing, safeSearch, blockedCategories[], blockedDomains[], allowedDomains[], unknownSitesPolicy, schedule, updatedBy, updatedAt, categories: [{ key, label, hint }] }`. Created with age-based defaults (`updatedBy: "eGuard defaults"`) the first time it's read. Applies to all of the child's browsers |
| `PUT /children/{id}/browser-policy` | every field: `{ safeBrowsing, safeSearch, blockedCategories: ["ADULT", …], blockedDomains: ["example.com"], allowedDomains: [], unknownSitesPolicy: "ALLOW" \| "WARN" \| "BLOCK", schedule: { enabled, startTime: "21:00", endTime: "06:00" } \| null }` | Same as GET. Sites are normalised (`https://www.x.com/page` → `www.x.com`), sorted and de-duplicated, up to 500 per list. `400` with a parent-readable `error` for a site that isn't an address, a site in both lists, or equal focus-hour times. Saving identical settings keeps the version; any change adds one, which browsers pick up within 5 minutes. `409 conflict` if another parent saved at the same moment. Optional `baseVersion`: the `version` you showed the parent; if the policy changed since (an approved access request, another parent), the save is refused with `409 stale_version` instead of undoing that change. Reload and let the parent redo their edit. Send it from every editor. `unknownSitesPolicy` is for sites on neither list: `ALLOW`, `WARN` (notice first) or `BLOCK` (allowed list only); focus hours block everything not on the allowed list |
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
| `POST /family/members` | `{ name, email }` | `201 { id, name, email, role: "PARENT", pending: true, emailSent, expiresInDays }`. Admin only. **Sends an invitation**: they join once they accept it (see Invitations). A `password` from older apps is ignored. `409` if the email already has an eGuard account; `429` after 10 invitations an hour. `emailSent: false` means the email failed: offer Resend |
| `POST /family/members/{id}/invite` | none | `{ ok }`. Admin only. Sends a pending invitation again with a new 7-day link. `409` if they already accepted, `503 mail_failed` |
| `DELETE /family/members/{id}` | none | `{ ok }`. Admin only. Removes a `PARENT` (not yourself) and signs them out everywhere, or withdraws a pending invitation |
| `GET /family/privacy` | none | `{ keepLocationHistory, shareAnalytics, retentionDays }` |
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
    { "key": "children", "included": true, "label": "Up to 5 children" },
    { "key": "protection", "included": true, "label": "Full protection features" },
    { "key": "verification", "included": true, "label": "Configuration verification" },
    { "key": "alerts", "included": true, "label": "Real-time alerts" },
    { "key": "location", "included": true, "label": "Location sharing" },
    { "key": "support", "included": true, "label": "Priority support" }
  ],
  "entitlements": {
    "childLimit": 5, "deviceLimit": 10, "locationSharing": true, "appMonitoringLimit": null,
    "realtimeAlerts": true, "advancedReports": false, "apiAccess": false
  },
  "usage": { "devicesUsed": 5, "deviceLimit": 10, "children": 3, "childLimit": 5 },
  "canManage": true,
  "billingAvailable": false,
  "store": null,
  "upgrade": { "planId": "PRO", "name": "Family Pro", "googlePlayProductId": "eguard_pro" }
}
```

- Plans are **Free** (1 child), **eGuard Plus** (₱149/month, 5 children) and **Family Pro** (₱249/month, 10 children).
  `upgrade` is the next plan up, or `null` on Family Pro.
- `status` is `ACTIVE` or `EXPIRED`.
- Plan Usage "3 of 5 children" comes from `usage.children` / `usage.childLimit`; devices from `usage.devicesUsed` / `usage.deviceLimit`.
- Use `entitlements` to hide or badge what the plan doesn't include (also on `GET /family`). The server enforces
  them either way:
  - at `childLimit`, `POST /children` → `409 { code: "plan_limit" }`; pairing past `deviceLimit` is refused the same way
  - without `locationSharing`, `/locations` and `/children/{id}/location…` → `403 { code: "plan_required" }`, and
    turning on location history is refused
  - with an `appMonitoringLimit`, `GET /children/{id}/apps` lists that many (apps waiting for approval first, then the
    most used) and `limited: { hidden, message }` says how many more there are; `/children/{id}/screen-time`
    names that many apps too (`hiddenApps`)
  - without `realtimeAlerts`, turning on `notifyPush` → `403 plan_required`
  - without `advancedReports`, `/children/{id}/screen-time?period=30d` → `403 plan_required`
- **Plans are paid for on the web for now** (PayMongo, in Settings › Subscription on the website). The apps show the
  plan and usage but **don't sell it and don't link to the website**: store policies forbid steering users to
  outside payment for digital subscriptions.
- `billingAvailable` is `true` only when the request comes from the Android app (`X-eGuard-Client: android`) **and**
  the server has Google Play configured. It is `false` while payments are web-only. Show an upgrade button only
  when all three hold:
  - `billingAvailable` is true
  - `upgrade` is non-null
  - `canManage` is true (only the family admin can buy)

  Otherwise show no upgrade button.
- `store`, when set, says how the current plan is paid: `{ name, productId, autoRenewing, expiresAt }`.
  - `name` is `PAYMONGO` for a web purchase (a pass, or auto-renew), `VOUCHER` for a sponsor code an organization gave the family (show it as "Sponsored plan"; codes are redeemed on the web), or `GOOGLE_PLAY`.
  - If `autoRenewing` is false (a pass, or auto-renew turned off), `renewsLabel` reads "Ends on …".
  - For a Google Play plan, "Manage Subscription" opens
    `https://play.google.com/store/account/subscriptions?sku={productId}&package={packageName}`.
- The server re-checks purchases on each call: one whose paid period has ended at most every 10 minutes, and an
  active one once a day. It also learns about payments, renewals and refunds from PayMongo webhooks. When the plan
  lapses, the family goes back to Free. Children and devices already added stay, but no new ones can be added over
  the limits.
- Server-side details (payment flows, sync, configuration): [subscriptions.md](subscriptions.md).

##### `GET /subscription/plans`

The upgrade screen: Free, eGuard Plus and Family Pro, in that order. Where Play Billing is available, show the
localized price from `ProductDetails`; `monthlyPesos` is the web price.

```json
{
  "plans": [
    { "id": "FREE", "name": "Free", "blurb": "Get started with essential protection tools.", "monthlyPesos": 0, "current": false,
      "childLimit": 1, "deviceLimit": 2, "entitlements": { "…": "…" },
      "features": [ { "key": "children", "included": true, "label": "Up to 1 child" } ], "googlePlayProductId": null },
    { "id": "PLUS", "name": "eGuard Plus", "monthlyPesos": 149, "current": true, "childLimit": 5, "deviceLimit": 10, "…": "…",
      "googlePlayProductId": "eguard_plus" },
    { "id": "PRO", "name": "Family Pro", "monthlyPesos": 249, "current": false, "childLimit": 10, "deviceLimit": 20, "…": "…",
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

→ `200 { "plan": "Family Pro", "expiresAt": "2026-10-27T…Z", "autoRenewing": true, "test": false }`

`eguard_family`, sold before these plans, is still accepted and grants Family Pro.

The server does the following:
- verifies the token with Google
- checks the purchase was made for this family
- upgrades the plan (Family Pro: 10 children, 20 devices)
- **acknowledges the purchase**, so the app must **not** call `acknowledgePurchase` itself
- raises an INFO alert "Welcome to Family Pro"

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
POST /auth/register | /auth/social        → token
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
| `WEB` | AVAILABLE | GUIDED |
| `DOWNLOADS` | AVAILABLE | VERIFY_ONLY |
| `LOCATION` | AVAILABLE | GUIDED |
| `NOTIFICATIONS` | AVAILABLE | UNSUPPORTED |
| All others | AVAILABLE | AVAILABLE |

| Capability | Meaning for the UI |
|---|---|
| `AVAILABLE` | eGuard applies it directly; just wait for verification |
| `GUIDED` | Show `guide` steps, then "Verify now" (`/confirm`) |
| `VERIFY_ONLY` | Same UI as GUIDED: the parent sets it on the device, eGuard confirms it |
| `UNSUPPORTED` | Show "Not supported on iPhone". It never counts against health |

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
| alert titles you'll see | "Protection setting changed", "Location sharing turned off", "Device hasn't synced in over a day", "New device synchronized", "Device removed", "New app installed", "App approval requested", "App blocked", "Screen time limit reached", "Welcome to eGuard Plus" / "Welcome to Family Pro", "eGuard Plus ended" / "Family Pro ended" |
| app `approval` | `ALLOWED`, `ALWAYS_ALLOWED`, `FILTERED`, `BLOCKED`, `PENDING` |
| child `status` | `protected`, `attention`, `notconfigured` |
| device `state` | `healthy`, `issues`, `offline` |

---

### P7. Known gaps

These parts of the design aren't backed by the API yet. Plan the UI accordingly.

| Design element | Status | Suggested UI for now |
|---|---|---|
| "Gaming time 1 hour/day" (Recommended Setup) | No app categories exist, so there's no per-category limit | Leave it out, or use per-app limits (`PATCH /apps/{id}`) for game apps |
| Push notifications | Sent through Firebase Cloud Messaging once the server has `FCM_SERVICE_ACCOUNT`; alerts go out with the maintenance job (every few minutes), not instantly | Register FCM tokens; still refresh with `/alerts/unread-count` on foreground. A push's `data` has `type: "alert"`, `alertId`, `category` and `childId?`: open the alert |
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
| 429 | Rate limited (`/pair` per IP, `/events` per device). Back off and retry later |
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
| `ALWAYS_ALLOWED` | Usable even after the daily limit and during bedtime |
| `FILTERED` | Treat as `ALLOWED` for now |
| `BLOCKED` | Always shows the block screen. Opening it sends `APP_BLOCKED` |
| `PENDING` | Blocked, with the "Waiting for your parent" screen |
| Not in the list | New app. With App Approval on, block it and send `APP_REQUESTED`; otherwise allow it and send `APP_INSTALLED` |

`ALWAYS_ALLOWED` and `FILTERED` aren't defined on the server yet (gap G5 in
[child-app-spec.md › Server gaps](child-app-spec.md#13-server-gaps)), so these meanings may change.

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
{ "battery": 72, "osVersion": "14", "appVersion": "1.0.0" }
```

All fields are optional (`battery` 0–100 or `null`, `osVersion` ≤ 40, `appVersion` ≤ 20); an empty body is fine.
An invalid body is ignored rather than refused.

```json
{
  "deviceId": "cmujeom5j000wncgs0ylb00q4",
  "policy": [
    { "key": "SCREEN_TIME", "config": { "key": "SCREEN_TIME", "dailyMinutes": 180, "weekendMinutes": 240 } },
    { "key": "BEDTIME", "config": { "key": "BEDTIME", "enabled": true, "start": "21:30", "end": "06:00", "days": "EVERY_DAY" } }
  ],
  "requests": [
    { "id": "cmujesvhf00vnncko3bmhqh76", "key": "BEDTIME",
      "config": { "key": "BEDTIME", "enabled": true, "start": "21:00", "end": "06:30", "days": "SCHOOL_NIGHTS" } }
  ],
  "apps": [
    { "name": "YouTube", "approval": "ALLOWED", "dailyLimitMinutes": 60 },
    { "name": "Roblox", "approval": "BLOCKED", "dailyLimitMinutes": null }
  ],
  "fullReportRequested": false,
  "nextSyncSeconds": 300,
  "timezone": "Asia/Manila",
  "features": { "locationSharing": true },
  "minAppVersion": null
}
```

| Field | Notes |
|---|---|
| `policy` | `PolicyEntry[]`, one per protection. The source of truth for enforcement. Save it locally and reconcile: if the policy says a protection is on and the device doesn't have it, apply it again |
| `requests` | `Request[]`, oldest first. Apply them in order. **A request is sent again in every `/sync` until the device reports that protection**, so a lost response never strands a change. Applying the same config twice must be harmless |
| `apps` | `AppRule[]`: every app rule for the child, from all their devices |
| `fullReportRequested` | A parent ran a check, or the device just paired. Send `POST /report { full: true }` with every supported protection right away: the parent's check waits only **12 seconds** |
| `nextSyncSeconds` | When to call again. 300 today |
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
| `protections` | `[{ key, config }]`, ≤ 20 | `config` is the protection's fields, without `key` (the server adds it) |
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
skipped and the rest of the report still counts. Fix the app; don't retry them.

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
`hourly` once and leaving it out later keeps the earlier hourly values.

#### `POST /location`

The device's current position.

| Field | Type | Rules |
|---|---|---|
| `lat` | number | −90 to 90 |
| `lng` | number | −180 to 180 |
| `accuracyM` | number, optional | 0–100000 metres. Over 200 shows as "approximate" to the parent |
| `placeLabel` | string, optional | ≤ 80 chars. Blank counts as none. Don't reverse-geocode on the device in v1. A saved place the fix falls inside overrides it |

```json
{ "lat": 14.6507, "lng": 121.0494, "accuracyM": 25 }
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
| `APP_INSTALLED` | `app`, `ageRating?` (0–21) | A new app appears and App Approval is off | Adds the app to the child's list; INFO alert "New app installed" the first time the name is seen for this child (from any device) |
| `APP_REQUESTED` | `app` | The child taps Ask, or a new app is installed with App Approval on | Marks the app `PENDING` and raises an ATTENTION "App approval requested". One open request per app |
| `APP_BLOCKED` | `app` | The child opens a `BLOCKED` app | INFO "App blocked", at most once per app per device per hour |
| `LIMIT_REACHED` | `minutes` (0–1440, the limit) | The daily screen-time limit is hit | INFO "Screen time limit reached", at most once per device per 12 hours |

```json
{ "type": "APP_REQUESTED", "app": "Minecraft", "eventId": "4f1c2a9e-6b0d-4c55-9a51-0d7f3f7e2b10" }
```

Response: `{ "ok": true }`.

- `APP_REQUESTED` for an app the parent already allowed (`ALLOWED`, `ALWAYS_ALLOWED`, `FILTERED`) changes nothing
  and returns `{ ok: true, approval }`: unlock it locally. For a `BLOCKED` app it stays blocked, the parent is told
  at most once a day, and the response is `{ ok: true, approval: "BLOCKED" }`. Show "Your parent said no for now".
- **`eventId`** (optional, 8–64 chars, e.g. a UUID): make one per event and send the same one on every retry. A repeat
  from the same device within 7 days returns `{ "ok": true, "duplicate": true }` and does nothing. Without it, a
  retried event counts as new.
- `429` after 120 events an hour from one device. Keep the event queued and retry later.

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
`NOTIFICATIONS`. `UNSUPPORTED` never counts against the child's health.

| KEY | Android | iOS |
|---|---|---|
| `WEB` | AVAILABLE | GUIDED |
| `DOWNLOADS` | AVAILABLE | VERIFY_ONLY |
| `LOCATION` | AVAILABLE | GUIDED |
| `NOTIFICATIONS` | AVAILABLE | UNSUPPORTED |
| All others | AVAILABLE | AVAILABLE |

| Capability | What the device does |
|---|---|
| `AVAILABLE` | Applies requests itself, then reports |
| `GUIDED` / `VERIFY_ONLY` | A parent sets it by hand on the device; the device only reads it back and reports |
| `UNSUPPORTED` | Nothing, and leaves it out of reports |

How each protection is enforced on each platform is in [child-app-spec.md › 6](child-app-spec.md#6-enforcing-the-10-protections).

#### Other enums

| Enum | Values |
|---|---|
| `platform` | `ANDROID`, `IOS` |
| `kind` | `PHONE`, `TABLET` |
| app `approval` | `ALLOWED`, `ALWAYS_ALLOWED`, `FILTERED`, `BLOCKED`, `PENDING` |
| event `type` | `APP_INSTALLED`, `APP_REQUESTED`, `APP_BLOCKED`, `LIMIT_REACHED` |

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
| G1 | No way to wake the device: changes and checks arrive on the next `/sync` | Poll every `nextSyncSeconds`. On iOS, changes can wait hours |
| G3 | iOS may not be able to read back settings made in the Settings app, or send usage from the report extension | Prototype before promising iOS verification and screen-time charts |
| G4 | Apps are keyed by display name only | Send the exact display name everywhere; same-name apps share one rule |
| G5 | `ALWAYS_ALLOWED` and `FILTERED` aren't defined on the server | Follow the spec's section 7 |
| G6 | No rename or unpair from the device | Choose the name before pairing. Only a parent can remove the device |
| G7 | No website access requests from phones | Only the browser extension has them ([browser-extension-api.md](browser-extension-api.md)) |
| G9 | "Offline" takes 24 hours | none |
