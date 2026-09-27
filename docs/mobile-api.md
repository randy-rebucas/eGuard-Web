# eGuard Parent Mobile API — v1

Everything the eGuard parent app needs to implement the screens in `public/ios.png` and `public/android.png`. The two
designs share one API. The only Android-specific part is Google Play billing for "Upgrade to Family"
([§4.14](#414-subscription)).
All examples on this page are real responses from the API, trimmed for length (arrays show 1–2 items).

- **Base URL:** `https://<host>/api/mobile/v1` (local: `http://localhost:3000/api/mobile/v1`)
- **Format:** JSON in and out, UTF-8. The only exception is child photos (raw image bytes).
- **Tests:** `npm run test:api` exercises every endpoint below against a running server.

---

## Contents

1. [Conventions](#1-conventions)
2. [Shared objects](#2-shared-objects)
3. [Screen → endpoint map](#3-screen--endpoint-map)
4. [Endpoints](#4-endpoints)
   - [Public](#41-public-no-sign-in) · [Auth](#42-auth) · [Me](#43-me-account-and-preferences) · [Dashboard & health](#44-dashboard-and-configuration-health)
   - [Onboarding](#45-onboarding-profiles-recommendations-setup) · [Children](#46-children) · [Protections & batches](#47-protections-and-configuration-batches)
   - [Screen time](#48-screen-time) · [Apps](#49-apps) · [Location](#410-location) · [Alerts](#411-alerts)
   - [Devices & checks](#412-devices-and-configuration-checks) · [Family & privacy](#413-family-members-and-privacy) · [Subscription](#414-subscription) · [Help & support](#415-help-and-support)
5. [Flows](#5-flows)
6. [Enums and config reference](#6-enums-and-config-reference)
7. [Known gaps](#7-known-gaps)

---

## 1. Conventions

### Authentication

Sign in (`/auth/login`, `/auth/register` or `/auth/social`) returns:

```json
{ "token": "<opaque string>", "expiresAt": "2026-10-27T05:59:56.772Z", "user": { …User } }
```

- Send `Authorization: Bearer <token>` on every request except the [public endpoints](#41-public-no-sign-in).
- Store the token in the **Keychain** (iOS) or **EncryptedSharedPreferences** (Android). It lasts **30 days**.
- The token is a normal eGuard session, the same kind the website uses. It is revoked when the parent:
  - signs out (`POST /auth/logout`)
  - changes their password on another device
  - taps "sign out other sessions" anywhere
  - is removed from the family
- **Any `401` means the token is no longer valid.** Clear it and show the sign-in screen.

### Headers

| Header | When | Value |
|---|---|---|
| `Authorization` | every signed-in call | `Bearer <token>` |
| `Content-Type` | requests with a body | `application/json` (photos: the image type) |
| `X-eGuard-Client` | every call (recommended) | `ios` or `android`. Configuration history then reads "Randy Cruz on iOS app" |
| `User-Agent` | automatic | Shown to the parent in the sessions list, so make it readable, e.g. `eGuard/1.0 (iPhone; iOS 18.1)` |

### Errors

Every error has the same shape. `error` is always written for the parent and safe to show as-is.

```json
{ "error": "That email and password don't match an eGuard account.", "code": "invalid_credentials" }
```

| Status | `code` | Meaning / what the app should do |
|---|---|---|
| 400 | `invalid`, `invalid_json` | Validation failed. For body fields, `error` starts with the field path, e.g. `"email: Enter a valid email address."`, so you can highlight the field |
| 401 | `unauthorized`, `invalid_credentials`, `invalid_token` | Session gone (sign out locally), wrong password, or a rejected Apple/Google token |
| 403 | `forbidden`, `wrong_password` | Family-admin-only action, or a password confirmation was wrong |
| 404 | `not_found` | Doesn't exist **or belongs to another family**. The API never reveals which |
| 409 | `conflict`, `unsupported`, `not_dismissible` | Duplicate email/app, device limit reached, protection unsupported on the child's devices, alert can't be dismissed |
| 413 | `too_large` | Photo over 2 MB |
| 415 | `unsupported_media_type` | Photo isn't a JPEG/PNG/WebP/HEIC, or its bytes don't match its declared type |
| 429 | `rate_limited` | 5 failed sign-ins in 10 minutes (per email and IP) |
| 501 | `provider_not_configured` | Apple/Google sign-in isn't enabled on this server (check `/app-info` first) |
| 500 | `server_error` | Unexpected. Show `error` and let the parent retry |

### Data types

- **IDs** are opaque strings (cuid or UUID). Don't parse them.
- **Timestamps** are ISO-8601 UTC (`2026-09-27T05:28:40.136Z`).
- **Calendar days** are `YYYY-MM-DD` in the **family's time zone** (`user.family.timezone`, e.g. `Asia/Manila`).
- **Durations** are integer **minutes**.
- **`…Label` fields** (`timeLabel`, `lastSeenLabel`, `renewsLabel`, `policyLabel`, …) are pre-formatted English strings
  in the family's time zone. Use them as-is, or format the raw value yourself for localization.
- **`icon`** fields are [Lucide](https://lucide.dev/icons) icon names (`moon`, `hourglass`, `map-pin`, …). Map them to
  SF Symbols or Material icons in the app.
- **`hue`** is a child's avatar color as an HSL hue (0–360). The web uses `hsl(hue 70% 45%)`.

### Pagination

Lists that can grow (`/alerts`, `/children/{id}/history`) use a cursor. Each response has `nextBefore`, which is an
ISO timestamp or `null` on the last page. To get the next page, send it back as `?before=<nextBefore>` (URL-encoded).

### Polling

Configuration changes and checks complete asynchronously, because the child's device has to confirm them. Poll
`GET /batches/{id}` or `GET /checks/{id}` every **1–2 seconds** while the screen is visible, stop when `done: true`,
and give up after about 60 seconds with a "Waiting for the device" state. The parent can come back later; batches
keep their state.

---

## 2. Shared objects

These shapes are reused across endpoints. Fields marked `?` may be `null`.

### User

Returned by `/me`, every sign-in, and `dashboard.user`.

```json
{
  "id": "cmujeom240002ncgsonpp12hl",
  "name": "Randy Cruz",
  "firstName": "Randy",
  "email": "randy@example.com",
  "role": "FAMILY_ADMIN",
  "family": { "id": "cmujeoltx0000ncgsox90ftwt", "name": "Cruz Family", "timezone": "Asia/Manila" },
  "notifications": { "notifyPush": true, "notifyEmail": true, "notifyApproval": true, "weeklySummary": true },
  "twoFactor": true,
  "createdAt": "2026-09-27T05:56:40.493Z"
}
```

`role` is `FAMILY_ADMIN` or `PARENT`. Admin-only actions return `403` for a `PARENT`, so hide them in the UI:
- deleting a child
- adding or removing parents
- changing privacy settings and the family time zone

### ChildSummary

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
| `status` | `protected` (all checks pass), `attention` (something to fix), `notconfigured` (no devices yet). Design labels: "Protected" / "Attention" |
| `photoUrl?` | Path relative to the host. Load it **with the bearer header**. The `?v=` query changes when the photo changes, so cache by URL |
| `todayLimitMinutes` | The limit that applies today (weekday or weekend) |

### Device

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
  "issues": 0
}
```

`state` is `healthy`, `issues` (`issues` > 0 protections not passing) or `offline` (no sync for over 24 h). `battery?`
and `appVersion?` may be null.

### Alert

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
| `FIX_SETTING` | `childId`, `key` | That protection's edit screen for the child ([§4.7](#47-protections-and-configuration-batches)) |
| `VIEW_DEVICE` | `deviceId` | Device detail |
| `REVIEW_APPS` | `childId` | App Management (Pending tab for requests) |
| `VIEW_SCREEN_TIME` | `childId` | Screen Time |
| `VIEW_HISTORY` | `childId` | Child profile › History |
| `MANAGE_SUBSCRIPTION` | none | Subscription |

### Batch (configuration progress)

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
      "to": "Filtered, 50 sites blocked",
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
          "from": "Filtered, 42 sites blocked",
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

## 3. Screen → endpoint map

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
| 16 | Settings | `GET /family`, `/me`, `/me/notifications`, `/family/privacy`, `/me/sessions`, `/me/password`, `POST /auth/logout` |
| 17 | Subscription | `GET /subscription`. Android "Upgrade to Family": `GET /subscription/plans` → Play Billing → `POST /subscription/google-play` |
| 18 | Help & Support | `GET /help?q=`, `GET /help/{slug}`, `POST /support/tickets` |
| — | Tab-bar badge | `GET /alerts/unread-count` |
| — | Push registration | `POST /me/push-tokens` after sign-in, `DELETE` / `logout?pushToken=` on sign-out |

---

## 4. Endpoints

### 4.1 Public (no sign-in)

#### `GET /app-info`

Call it on launch. Compare `minimumAppVersion` with the app's version and block with "Please update" if the app is
older. Show the Apple/Google buttons only when enabled.

```json
{
  "name": "eGuard",
  "apiVersion": "1",
  "minimumAppVersion": "1.0.0",
  "signIn": { "password": true, "apple": false, "google": false },
  "supportEmail": "support@eguard.example"
}
```

#### `GET /help?q=&category=`

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
  "contact": { "email": "support@eguard.example", "replyTime": "Replies within 1 business day" }
}
```

#### `GET /help/{slug}`

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

### 4.2 Auth

#### `POST /auth/register` → `201`

Creates a new family with this parent as `FAMILY_ADMIN` and signs them in.

| Field | Type | Rules |
|---|---|---|
| `name` | string | ≥ 2 chars |
| `email` | string | valid email. Case doesn't matter; it's stored lowercase |
| `password` | string | ≥ 10 chars |
| `familyName` | string, optional | ≥ 2 chars. Default: last name + " Family" ("Cruz Family"), or "Randy's Family" |

Response: `{ token, expiresAt, user }`. Errors: `400` (field message), `409` (email already registered).

#### `POST /auth/login` → `200`

```json
{ "email": "randy@example.com", "password": "ChangeMe123!" }
```

Response: `{ token, expiresAt, user }`. Errors: `401 invalid_credentials`, `429 rate_limited`.

#### `POST /auth/social` → `200` (existing account) / `201` (new account)

"Continue with Apple / Google". Send the **ID token** (JWT) from the native SDK, not an authorization code.

| Field | Type | Notes |
|---|---|---|
| `provider` | `"apple"` \| `"google"` | |
| `idToken` | string | iOS: `ASAuthorizationAppleIDCredential.identityToken` (UTF-8). Google: `GIDGoogleUser.idToken.tokenString` / Android `GoogleIdTokenCredential.idToken` |
| `name` | string, optional | Apple only gives the name on the **first** authorization. Forward `fullName` so the account gets a name |

Response: `{ token, expiresAt, user, isNew }`. Continue with onboarding when `isNew` is true.

- If the provider account is already linked, the parent is signed in.
- Otherwise, an existing eGuard account with the same **verified** email gets linked.
- Otherwise, a new family is created.

Errors: `400 email_required` (no verified email; Apple "Hide my email" relay addresses are fine),
`401 invalid_token`, `501 provider_not_configured`.

> Server setup: the ID token's audience must be listed in `APPLE_CLIENT_IDS` (the iOS bundle ID) or
> `GOOGLE_CLIENT_IDS` (the iOS and Android OAuth client IDs). Send these IDs to the backend team.

#### `POST /auth/logout[?pushToken=<token>]` → `200`

Ends this session only. Pass the device's push token so this phone stops receiving pushes for this parent. Response:
`{ "ok": true }`.

### 4.3 Me (account and preferences)

| Method & path | Body | Response |
|---|---|---|
| `GET /me` | none | `User` |
| `PATCH /me` | any of `{ name, email, timezone }` | `User`. `timezone` (IANA, e.g. `Asia/Manila`) is applied only for the family admin. `409` if the email is taken |
| `POST /me/password` | `{ current, next }` | `{ ok, message }`. `403 wrong_password`, `400` if `next` < 10 chars. **Signs out every other session**; this one stays |
| `GET /me/notifications` | none | `{ notifyPush, notifyEmail, notifyApproval, weeklySummary }` |
| `PATCH /me/notifications` | any subset of those booleans | Same object, updated |
| `POST /me/push-tokens` | `{ token, platform: "IOS" \| "ANDROID" }` | `201 { ok }`. Call it after sign-in and whenever APNs/FCM rotates the token. Re-registering the same token under another parent moves it |
| `DELETE /me/push-tokens` | `{ token }` | `{ ok }` |
| `GET /me/sessions` | none | `{ sessions: [{ id, userAgent, createdAt, lastSeenAt, current }] }` |
| `DELETE /me/sessions` | none | `{ signedOut: n }`. Signs out everywhere except this session |

### 4.4 Dashboard and Configuration Health

#### `GET /dashboard`

One call for the whole Home tab.

```json
{
  "user": { …User },
  "greeting": "Good afternoon,",
  "summary": "1 child needs attention.",
  "health": { "score": 8, "total": 10, "label": "Good protection" },
  "children": [ …ChildSummary ],
  "deviceCount": 5,
  "recentAlerts": [ …Alert (up to 3) ],
  "unreadAlerts": 4
}
```

`summary` is "Your family's digital safety looks good today.", "N children need attention." or, when the family has
no children yet, "Add your first child to get started." (show the Add Child call to action).

#### `GET /health[?childId=]`

Configuration Health. There are 10 checks, one per protection, and each shows the least healthy device's status.
`UNSUPPORTED` never counts against the score. The score measures **configuration, not the child's behavior**.

```json
{
  "score": 8,
  "total": 10,
  "label": "Good protection",
  "checks": [
    { "key": "SCREEN_TIME", "name": "Screen Time", "icon": "hourglass", "status": "PASS",
      "detail": "Verified on 5 of 5 devices (1 offline, last known state)" },
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
- `label`: 10/10 "Fully protected", 8–9 "Good protection", 5–7 "Needs attention", below 5 "Action required".
- With `?childId=`, the score covers that child only and `children` is omitted.
- Check statuses and suggested colors: `PASS` green, `WARNING` amber, `ACTION_REQUIRED` red, `NOT_CONFIGURED` grey,
  `UNSUPPORTED` grey (with the label "Not supported").

### 4.5 Onboarding: profiles, recommendations, setup

#### `GET /profiles?age=12`

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

#### `GET /children/{id}/recommendations?profile=`

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

`settings` always has all 10 protections (see [§6](#6-enums-and-config-reference)). The design shows 6; pick the ones
you want and keep the rest as they are. `devices` is empty until a device is paired.

#### `POST /children/{id}/setup` → `201`

"Review & Configure". Sends a whole profile in one batch.

```json
{
  "profile": "BALANCED",
  "overrides": [ { "key": "SCREEN_TIME", "dailyMinutes": 150, "weekendMinutes": 200 } ]
}
```

`overrides` holds full config objects (see [§6](#6-enums-and-config-reference)) that replace the profile's values,
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

### 4.6 Children

#### `GET /children`

Returns `{ "children": [ …ChildSummary ] }`, in the order the children were added.

#### `POST /children` → `201`

| Field | Type | Rules |
|---|---|---|
| `name` | string | 1–40 chars |
| `age` | int | 0–17 (or send `birthYear` instead) |
| `profile` | `BALANCED` \| `PROTECTED` \| `CUSTOM`, optional | Initial settings. Default `PROTECTED` |

Response: `ChildSummary`, with `status: "notconfigured"` and `health.score: 0` until a device is paired.

#### `GET /children/{id}`

Child Profile › Overview.

```json
{
  "child": { …ChildSummary },
  "health": { "score": 10, "total": 10, "label": "Fully protected", "checks": [ …same as /health checks ] },
  "today": { "minutes": 134, "limitMinutes": 240, "appsUsed": 3, "topApps": [ { "name": "YouTube", "minutes": 54 } ] },
  "bedtime": { "enabled": true, "start": "21:30", "end": "06:00", "days": "EVERY_DAY", "label": "9:30 PM – 6:00 AM" },
  "location": { "sharing": true, "placeLabel": "Home", "updatedAt": "2026-09-27T05:28:40.136Z", "label": "Sharing enabled" },
  "deviceProtection": { "state": "healthy", "label": "Healthy" },
  "pendingApprovals": 0,
  "devices": [ …Device ],
  "recentChanges": [
    { "id": "…", "key": "BEDTIME", "title": "Weekend bedtime changed", "actor": "Ana Cruz (Parent) on Galaxy A54",
      "fromValue": "9:30 PM – 6:00 AM", "toValue": "10:30 PM – 6:30 AM", "createdAt": "2026-09-25T03:56:42.757Z" }
  ]
}
```

- `location.label` is "Sharing enabled", "Sharing off" or "Waiting for location".
- `deviceProtection.state` is `healthy`, `issues`, `offline` or `no_devices`.
- `pendingApprovals` counts app requests waiting for the parent (use it for a badge on the Apps tab).

#### `PATCH /children/{id}`

Body: any of `{ name, age }` (or `birthYear`). Returns the same shape as `GET /children/{id}`.

#### `DELETE /children/{id}`

Family admin only. Body: `{ "password": "…" }` (the admin's own password). This permanently deletes the child, their
devices and all their data. Errors: `403 wrong_password`, `403 forbidden`.

#### Photo: `PUT` / `GET` / `DELETE /children/{id}/photo`

- **Upload:** `PUT` with the **raw image bytes** as the body (not multipart, not base64).
  - `Content-Type` must be `image/jpeg`, `image/png`, `image/webp` or `image/heic`, and must match the actual bytes.
  - Maximum 2 MB. Resize to about 512×512 before uploading.
  - Response: `{ "photoUrl": "/api/mobile/v1/children/…/photo?v=1790488799782" }`
  - Errors: `413` (too big), `415` (wrong type or content).
- **Download:** `GET` with the bearer header. The response is the image, cacheable forever per URL.
- **Remove:** `DELETE` returns `{ "ok": true }`. After that, `photoUrl` is `null`; show an initial on `hue`.

#### `GET /children/{id}/history?limit=30&before=`

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

#### `POST /children/{id}/pairing-code` → `201`

"Set up supervision" / "Add device". Show the code large; the parent types it into the eGuard app on the child's
device, which calls `POST /api/device/v1/pair`.

```json
{ "code": "FJZM7J7H", "expiresAt": "2026-09-27T06:14:58.928Z", "childName": "Mia" }
```

The code is 8 characters, single-use, and valid for 15 minutes. `409` means the plan's device limit has been reached.
After pairing, `GET /children/{id}` shows the device, and a first full check runs automatically.

### 4.7 Protections and configuration batches

#### `GET /children/{id}/protections`

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
      "status": "NOT_CONFIGURED",
      "openBatchId": null,
      "devices": [
        {
          "deviceId": "cmujeonbc00d5ncgs3k2m4glb",
          "deviceName": "iPhone 13",
          "platform": "IOS",
          "capability": "AVAILABLE",
          "status": "NOT_CONFIGURED",
          "reported": { "key": "BEDTIME", "enabled": false, "start": "22:00", "end": "06:00", "days": "EVERY_DAY" },
          "reportedLabel": "Not configured",
          "message": "Not configured on Sophie's iPhone 13",
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

#### `PUT /children/{id}/protections/{KEY}` → `202`

Change one protection. `KEY` is case-insensitive. The body is that protection's config **without** `key`:

```json
PUT /children/{id}/protections/BEDTIME
{ "enabled": true, "start": "21:00", "end": "06:30", "days": "SCHOOL_NIGHTS" }
```

The response is a `Batch`. Poll `GET /batches/{batchId}`.

- Any open change for the same protection is cancelled and replaced.
- `400` for an invalid config.
- `409 unsupported` if none of the child's devices support it (e.g. Notifications on an iOS-only child). Hide or
  disable that control when every device's `capability` is `UNSUPPORTED`.

#### `GET /batches/{id}`

Poll until `done: true`. Returns a `Batch`.

#### `POST /batches/{id}/confirm`

Guided setup: the parent taps "I've done this, verify now" after following `guide`. The request moves from
`AWAITING_PARENT` to `DELIVERED`, and the device is asked for a full report. The response is a `Batch` plus
`confirmed` (the number of requests moved).

#### `DELETE /batches/{id}`

Cancels everything in the batch that isn't verified yet. Response: `{ "cancelled": 8 }`. Verified items stay verified.

### 4.8 Screen time

#### `GET /children/{id}/screen-time?period=today|7d|30d`

`period` defaults to `today`. Any other value returns `400`.

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
| `apps` | Most used first. `appId` / `approval` are `null` for apps without a rule (e.g. `Others`) |

### 4.9 Apps

#### `GET /children/{id}/apps?filter=all|installed|blocked|pending`

- `installed` means everything that isn't blocked (the design's "Installed" tab).
- `pending` means requests waiting for the parent's approval.

```json
{
  "counts": { "all": 4, "blocked": 0, "pending": 0, "installed": 4 },
  "apps": [
    { "id": "cmujeom2c0008ncgsgn8kylmz", "name": "Roblox", "approval": "ALLOWED", "approvalLabel": "Allowed",
      "allowed": true, "dailyLimitMinutes": null, "todayMinutes": 42, "installedAt": "2026-09-27T00:56:40.499Z" }
  ]
}
```

- `allowed` drives the on/off switch. It's false for `BLOCKED` and `PENDING`.
- The design's subtitle maps as follows:
  - `ALWAYS_ALLOWED` → "Always allowed"
  - `dailyLimitMinutes` → "1 hour/day"
  - `PENDING` → "Ask parent"
  - `BLOCKED` → "Blocked"

#### `PATCH /apps/{id}`

| Field | Type | Notes |
|---|---|---|
| `approval` | `ALLOWED` \| `ALWAYS_ALLOWED` \| `FILTERED` \| `BLOCKED`, optional | Switch on → `ALLOWED`, off → `BLOCKED`. Approving or declining a request also resolves its alert |
| `dailyLimitMinutes` | int 1–1440, or `null` to remove, optional | |

Send at least one field. Response:
`{ id, name, approval, approvalLabel, dailyLimitMinutes }`. The device picks up the change on its next sync (within
about 5 minutes).

#### `POST /children/{id}/apps` → `201`

"Request to Install App": the parent adds an app ahead of time.

```json
{ "name": "Khan Academy", "approval": "ALWAYS_ALLOWED", "dailyLimitMinutes": null }
```

`approval` defaults to `ALLOWED`. Returns `409` if an app with that name is already on the child's list.

### 4.10 Location

#### `GET /children/{id}/location`

```json
{
  "childId": "cmujeom2c0006ncgsd9tlg8pp",
  "sharing": true,
  "current": {
    "deviceId": "cmujeom5j000wncgs0ylb00q4", "deviceName": "Galaxy A54",
    "lat": 14.6507, "lng": 121.0494, "accuracyM": 25, "placeLabel": "Home",
    "locatedAt": "2026-09-27T05:28:40.136Z", "updatedLabel": "Today, 1:28 PM"
  },
  "devices": [ { "id": "cmujeom5j000wncgs0ylb00q4", "name": "Galaxy A54", "sharing": true, "hasLocation": true } ],
  "history": {
    "enabled": true,
    "visits": [
      { "id": "…", "deviceName": "Galaxy A54", "lat": 11.29, "lng": 125.07, "placeLabel": "Babatngon Central School",
        "arrivedAt": "…", "lastSeenAt": "…", "timeLabel": "Today, 2:32 PM", "day": { "key": "2026-09-27", "label": "Today" } }
    ]
  }
}
```

- `current` is `null` when sharing is off or no location has arrived yet.
- The banner at the top of the screen reads "Location sharing Enabled" when `sharing` is true.
- `history.visits` covers today and yesterday, newest first, and is empty unless `history.enabled`. The admin turns
  history on with `PATCH /family/privacy { keepLocationHistory: true }`. When it's off, show a prompt instead of the
  "Today" list.
- To turn sharing on or off, change the `LOCATION` protection (`PUT /children/{id}/protections/LOCATION
  { "sharing": true }`). On iOS this is guided setup.

#### `GET /children/{id}/location/visits?limit=50&before=`

"View All" under Today's visits: every visit kept, up to the family's retention period, newest first. `limit` is 1–100,
and pages use `nextBefore` (the `arrivedAt` of the last item).

```json
{
  "enabled": true,
  "retentionDays": 90,
  "visits": [
    { "id": "…", "deviceName": "Galaxy A54", "lat": 11.32, "lng": 125.06, "placeLabel": "Park",
      "arrivedAt": "…", "lastSeenAt": "…", "timeLabel": "Today, 2:32 PM", "day": { "key": "2026-09-27", "label": "Today" } }
  ],
  "nextBefore": "2026-09-27T06:12:44.031Z"
}
```

With history off, the response is `{ "enabled": false, "visits": [], "nextBefore": null }`. Group sections by
`day.key`, like alerts.

#### `GET /locations`

The family map, one entry per child:

```json
{
  "children": [
    { "childId": "…", "name": "Mia", "hue": 205, "photoUrl": null, "sharing": true, "state": "located",
      "location": { "deviceId": "…", "deviceName": "Galaxy A54", "lat": 14.6507, "lng": 121.0494, "accuracyM": 25,
                    "placeLabel": "Home", "locatedAt": "…", "updatedLabel": "Today, 1:28 PM" } }
  ]
}
```

`state` is `located`, `waiting` (sharing on, no location yet), `sharing_off` or `no_devices`.

### 4.11 Alerts

#### `GET /alerts`

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
| `POST /alerts/{id}/dismiss` | `{ ok }` | Only when `dismissible` (INFO alerts). Others return `409 not_dismissible` |

### 4.12 Devices and configuration checks

| Method & path | Body | Response |
|---|---|---|
| `GET /devices` | none | `{ devices: [ …Device ], limit: 8 }` |
| `GET /devices/{id}` | none | `Device` + `protections: [{ key, name, icon, capability, capabilityLabel, status, reportedLabel, message, lastVerifiedAt }]` (all 10) |
| `PATCH /devices/{id}` | `{ name }` (1–60 chars) | Same as GET |
| `DELETE /devices/{id}` | none | `{ ok }`. The device is unpaired and its token stops working |
| `POST /checks` | `{ deviceId? }` (omit for all devices) | `202 { runId }` |
| `GET /checks/{runId}` | none | See below. Poll until `done` |

```json
{
  "status": "RUNNING",
  "done": false,
  "health": { "score": 10, "total": 10 },
  "results": [
    { "deviceId": "…", "deviceName": "iPhone 13", "childName": "Mia", "reachable": null, "issues": null, "reported": false }
  ]
}
```

- Devices report back on their next sync. A check finishes when every device has reported, or after 12 seconds.
- Devices that didn't answer end with `reachable: false`; show "Couldn't reach".
- `issues` is the number of protections not passing on that device.

### 4.13 Family, members and privacy

#### `GET /family`

Settings › Family.

```json
{
  "id": "cmujeoltx0000ncgsox90ftwt",
  "name": "Cruz Family",
  "timezone": "Asia/Manila",
  "members": [
    { "id": "…", "name": "Randy Cruz", "email": "randy@example.com", "role": "FAMILY_ADMIN", "createdAt": "…", "you": true },
    { "id": "…", "name": "Ana Cruz", "email": "ana@example.com", "role": "PARENT", "createdAt": "…", "you": false }
  ],
  "children": [ …ChildSummary ],
  "deviceCount": 5,
  "deviceLimit": 8,
  "canManage": true
}
```

| Method & path | Body | Response / notes |
|---|---|---|
| `POST /family/members` | `{ name, email, password }` (temporary password, ≥ 10 chars) | `201 { id, name, email, role: "PARENT" }`. Admin only. `409` if the email exists. Tell the admin to share the password so the other parent can sign in and change it |
| `DELETE /family/members/{id}` | none | `{ ok }`. Admin only. Removes a `PARENT` (not yourself) and signs them out everywhere |
| `GET /family/privacy` | none | `{ keepLocationHistory, shareAnalytics, retentionDays }` |
| `PATCH /family/privacy` | any of `{ keepLocationHistory, shareAnalytics }` | Same object. Admin only. **Turning `keepLocationHistory` off deletes all stored visits**, so confirm with the parent first |

### 4.14 Subscription

#### `GET /subscription`

```json
{
  "plan": "eGuard Plus",
  "status": "ACTIVE",
  "renewsAt": "2026-10-11T16:00:00.000Z",
  "renewsLabel": "Renews on Oct 12, 2026",
  "features": [
    { "key": "children", "included": true, "label": "Unlimited children" },
    { "key": "devices", "included": true, "label": "Up to 8 devices" },
    { "key": "health_checks", "included": true, "label": "Configuration health checks" },
    { "key": "alerts", "included": true, "label": "Protection alerts" },
    { "key": "reports", "included": true, "label": "Advanced reports" },
    { "key": "priority_support", "included": false, "label": "Priority support" }
  ],
  "usage": { "devicesUsed": 5, "deviceLimit": 8, "children": 3 },
  "canManage": true,
  "billingAvailable": false,
  "store": null,
  "upgrade": { "planId": "FAMILY", "name": "eGuard Family", "googlePlayProductId": "eguard_family" }
}
```

- `status` is `ACTIVE` or `EXPIRED`.
- Plan Usage "3 of 5 devices used" comes from `usage.devicesUsed` / `usage.deviceLimit`.
- `billingAvailable` is `true` only when the request comes from the Android app (`X-eGuard-Client: android`) **and**
  the server has Google Play configured. Show "Upgrade to Family" when all three hold:
  - `billingAvailable` is true
  - `upgrade` is non-null
  - `canManage` is true (only the family admin can buy)

  Otherwise hide the button, or route it to Contact Support.
- `store`, when set (`{ name: "GOOGLE_PLAY", productId, autoRenewing, expiresAt }`), means the plan was bought through
  Google Play. If `autoRenewing` is false, `renewsLabel` reads "Ends on …". For "Manage Subscription", open
  `https://play.google.com/store/account/subscriptions?sku={productId}&package={packageName}`.
- Each call re-checks a Play subscription whose paid period has ended (at most every 10 minutes), so renewals,
  cancellations and expiry show up here. When it lapses, the family goes back to eGuard Plus. Devices already added
  stay, but no new ones can be paired over the limit.

#### `GET /subscription/plans`

The upgrade screen. Prices aren't returned: show the localized price from Play Billing `ProductDetails`.

```json
{
  "plans": [
    { "id": "PLUS", "name": "eGuard Plus", "deviceLimit": 8, "current": true,
      "features": [ { "key": "devices", "included": true, "label": "Up to 8 devices" } ], "googlePlayProductId": null },
    { "id": "FAMILY", "name": "eGuard Family", "deviceLimit": 15, "current": false,
      "features": [ { "key": "priority_support", "included": true, "label": "Priority support" } ], "googlePlayProductId": "eguard_family" }
  ],
  "googlePlay": { "packageName": "app.eguard.android", "obfuscatedAccountId": "9f2c…(64 hex chars)" },
  "canManage": true
}
```

`googlePlay` is `null` when the server has no Play billing configured.

#### `POST /subscription/google-play` (Android, family admin)

Send the purchase to eGuard after Play Billing reports it.

```json
{ "productId": "eguard_family", "purchaseToken": "<Purchase.getPurchaseToken()>" }
```

→ `200 { "plan": "eGuard Family", "expiresAt": "2026-10-27T…Z", "autoRenewing": true, "test": false }`

The server does the following:
- verifies the token with Google
- checks the purchase was made for this family
- upgrades the plan (device limit 15)
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

### 4.15 Help and support

The public help endpoints are in [§4.1](#41-public-no-sign-in).

| Method & path | Body | Response |
|---|---|---|
| `POST /support/tickets` | `{ category?, subject, message }` | `201 { id, status: "OPEN", createdAt, message }`. Show `message` as the confirmation |
| `GET /support/tickets` | none | `{ tickets: [{ id, category, subject, message, status, createdAt }] }` (this parent's, newest first) |

- `category`: `SETUP`, `DEVICE`, `BILLING`, `ACCOUNT` or `OTHER` (the default).
- `subject`: 3–120 characters.
- `message`: 10–5000 characters.

---

## 5. Flows

### 5.1 App launch

```
GET /app-info ── app too old? ──► "Please update"
      │
token in Keychain? ── no ──► Welcome / Create Account
      │ yes
GET /dashboard ── 401 ──► clear token ──► Sign in
      │ 200
Home  (+ POST /me/push-tokens if the APNs token changed)
```

### 5.2 Onboarding (screens 3 → 9)

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

### 5.3 Changing one setting

```
GET /children/{id}/protections             → policy, capabilities, openBatchId
PUT /children/{id}/protections/BEDTIME {…} → Batch (PENDING / AWAITING_PARENT)
poll GET /batches/{batchId}
  VERIFIED        → "Saved and verified", refresh the screen
  FAILED          → show failureReason, offer "Try again"
  AWAITING_PARENT → show guide steps + "Verify now" → POST /batches/{id}/confirm
  offline: true   → "Waiting for {device} to come online"; the parent can leave and come back
```

### 5.4 Approving an app request

```
push/alert "App approval requested" (action.type = REVIEW_APPS)
GET  /children/{id}/apps?filter=pending
PATCH /apps/{appId} { "approval": "ALLOWED" }  or  { "approval": "BLOCKED" }
→ the alert resolves automatically; the device applies the rule on its next sync
```

---

## 6. Enums and config reference

### Protections (`KEY`) and their config bodies

| KEY | Config (body for `PUT`, or an entry in `overrides` with `key`) | Example label |
|---|---|---|
| `SCREEN_TIME` | `dailyMinutes` 15–1440, `weekendMinutes` 15–1440 | "3h / day" |
| `BEDTIME` | `enabled` bool, `start` "HH:MM", `end` "HH:MM" (24 h), `days` `EVERY_DAY` \| `SCHOOL_NIGHTS` | "9:30 PM – 6:00 AM" |
| `APP_RESTRICTIONS` | `maxAgeRating` 4–18 | "Apps rated 9+ and under" |
| `APP_APPROVAL` | `enabled` bool | "Approval required" |
| `CONTENT` | `maxAgeRating` 4–18 | "Rated 13+ and under" (the design's "Explicit content") |
| `WEB` | `mode` `OFF` \| `FILTER` \| `ALLOWLIST`, `blockedSites` int ≥ 0 | "Filtered, 42 sites blocked" |
| `DOWNLOADS` | `requireApproval` bool | "Parent approval" (the design's "App downloads · Ask parent") |
| `LOCATION` | `sharing` bool | "Sharing" |
| `NOTIFICATIONS` | `quietDuringBedtime` bool | "Quiet during bedtime" |
| `UNINSTALL_PROTECTION` | `enabled` bool | "On" |

Age-rating tiers used by the profiles: 4, 9, 13, 16, 18.

### Platform capability per protection

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

### Other enums

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
| alert titles you'll see | "Protection setting changed", "Location sharing turned off", "Device hasn't synced in over a day", "New device synchronized", "New app installed", "App approval requested", "App blocked", "Screen time limit reached", "Welcome to eGuard Family", "eGuard Family ended" |
| app `approval` | `ALLOWED`, `ALWAYS_ALLOWED`, `FILTERED`, `BLOCKED`, `PENDING` |
| child `status` | `protected`, `attention`, `notconfigured` |
| device `state` | `healthy`, `issues`, `offline` |

---

## 7. Known gaps

These parts of the design aren't backed by the API yet. Plan the UI accordingly.

| Design element | Status | Suggested UI for now |
|---|---|---|
| "Gaming time 1 hour/day" (Recommended Setup) | No app categories exist, so there's no per-category limit | Leave it out, or use per-app limits (`PATCH /apps/{id}`) for game apps |
| Push notifications | Tokens are stored (`/me/push-tokens`), but nothing sends pushes yet | Register tokens anyway; refresh with `/alerts/unread-count` on foreground |
| Manage Subscription / "Upgrade to Family" on **iOS** | Only Google Play billing exists; App Store (StoreKit) purchases aren't verified yet, so iOS always gets `billingAvailable: false` | Hide the button on iOS or link to Contact Support |
| Play subscription changes between app opens | No Real-time Developer Notifications (Pub/Sub) webhook yet. Renewals and expiry are picked up when `GET /subscription` is called after the paid period ends | Call `GET /subscription` on app launch |
| Password for Apple/Google accounts | Social accounts have no password, so they can't change one or confirm deleting a child | Hide "Change password" for social sign-ins; route child deletion to support |
| Two-step verification | `twoFactor` is a stored flag only | Show "Coming soon" |
| Realtime updates | No WebSocket/SSE | Poll as described in [Polling](#polling) |
| Location history on the web | Visits are available only through this API | none |
