# eGuard Child Device API — v1

The API for the **eGuard app on the child's phone or tablet** (child device mode). The device has no parent session:
it pairs once with a code a parent creates, then works with its own device token. Parents manage everything from
the [parent mobile API](mobile-api-parent.md); this page covers only what the device sends and receives.

What the app must do with these calls (screens, enforcement per platform, permissions, background execution,
tamper resistance) is in [child-app-spec.md](child-app-spec.md). This page is the wire reference.

- **Base URL:** `https://www.eguard.family/api/device/v1`
- **Format:** JSON in and out, UTF-8, HTTPS only. Every endpoint is a `POST`.

---

## Contents

1. [Conventions](#1-conventions)
2. [Shared objects](#2-shared-objects)
3. [Endpoints](#3-endpoints)
   - [Pair](#post-pair--201) · [Sync](#post-sync) · [Report](#post-report) · [Usage](#post-usage) ·
     [Location](#post-location) · [Events](#post-events)
4. [Flows](#4-flows)
5. [Enums and config reference](#5-enums-and-config-reference)
6. [What the parent sees](#6-what-the-parent-sees)
7. [Known gaps](#7-known-gaps)

---

## 1. Conventions

### Authentication

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

A parent token doesn't work here and a device token doesn't work in the parent API. In an app that has both modes,
the parent signs out of the parent session after pairing (see [mobile-organizations.md](mobile-organizations.md)).

### Headers

| Header | When | Value |
|---|---|---|
| `Authorization` | every call except `/pair` | `Bearer <device token>` |
| `Content-Type` | every call | `application/json` |

`appVersion`, `osVersion` and `battery` travel in request bodies (`/pair`, `/sync`, `/report`), not headers.

### Errors

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

### Data types

- **IDs** are opaque strings. Don't parse them.
- **Calendar days** in `/usage` are `YYYY-MM-DD` in the **device's local date**.
- **Durations** are integer **minutes**.
- **Times** in configs are `"HH:MM"`, 24-hour.
- **`timezone`** from `/sync` is the family's IANA zone (e.g. `Asia/Manila`). Use it for "today", weekends and
  school nights, so the device agrees with what the parent sees even when its own zone differs.
- **App names** are trimmed display names, 1–80 characters. They are the key that links events, usage and app rules
  (see [Known gaps](#7-known-gaps)).

### Being "seen"

Every authenticated call updates the device's `lastSeenAt`. `/sync` and `/report` also update `battery`,
`osVersion` and `appVersion` when sent. A device that makes no call for **24 hours** shows as offline to parents and
raises "Device hasn't synced in over a day"; the next call resolves it.

---

## 2. Shared objects

### ProtectionConfig

Every protection is a config object with a `key` and that protection's fields. The same shape is used for the
child's `policy` and for configuration `requests`; `/report` sends the same fields without `key`.

```json
{ "key": "BEDTIME", "enabled": true, "start": "21:30", "end": "06:00", "days": "EVERY_DAY" }
```

All 10 shapes and their bounds are in [§5](#5-enums-and-config-reference). The type is `ProtectionConfig` in
[src/lib/protections.ts](../src/lib/protections.ts).

### PolicyEntry

```json
{ "key": "SCREEN_TIME", "config": { "key": "SCREEN_TIME", "dailyMinutes": 180, "weekendMinutes": 240 } }
```

The child's current settings, one per protection. **This is what the device enforces**, including offline.

### Request

```json
{ "id": "cmujesvhf00vnncko3bmhqh76", "key": "BEDTIME",
  "config": { "key": "BEDTIME", "enabled": true, "start": "21:00", "end": "06:30", "days": "SCHOOL_NIGHTS" } }
```

A change a parent made that this device hasn't verified yet. Apply `config`, read the setting back from the OS, and
report it. Only `APPLY` requests are sent; guided setup (the parent changes the setting by hand on the device) never
appears here, but the device's next report verifies it the same way.

### AppRule

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

## 3. Endpoints

### `POST /pair` → `201`

No auth. Called once, on the child's device, after the parent creates a code
(`POST /children/{id}/pairing-code` in the [parent API](mobile-api-parent.md#post-childrenidpairing-code--201)).

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

### `POST /sync`

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

### `POST /report`

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

Configs must have **exactly** the fields in [§5](#5-enums-and-config-reference): an extra or missing field puts the
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

### `POST /usage`

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

### `POST /location`

The device's current position.

| Field | Type | Rules |
|---|---|---|
| `lat` | number | −90 to 90 |
| `lng` | number | −180 to 180 |
| `accuracyM` | number, optional | 0–100000 metres. Over 200 shows as "approximate" to the parent |
| `placeLabel` | string, optional | ≤ 80 chars. Blank counts as none. Don't reverse-geocode on the device in v1 |

```json
{ "lat": 14.6507, "lng": 121.0494, "accuracyM": 25 }
```

Response: `{ "ok": true }`, always, including when the fix is dropped. Send fixes only when all three hold:
- the child's `LOCATION` policy has `sharing: true`
- the OS permission is granted
- `/sync` says `features.locationSharing: true`

The server also drops fixes on plans without location, and while the device's last `LOCATION` report said sharing
was off. Each fix **replaces the previous one whole**: a field you leave out is cleared, not kept. With the family's
location history on, fixes within 150 m of the last visit extend it, and others start a new visit.

At rest, one fix every 15 minutes keeps the parent's map "live" (it shows "Last seen" after 15 minutes).

### `POST /events`

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

## 4. Flows

### 4.1 Pairing

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

### 4.2 The sync cycle

```
POST /sync
  ├─ minAppVersion above ours?  → update screen, stop
  ├─ save policy + apps locally (enforced offline)
  ├─ for each request (in order): apply config ─► read back from the OS
  ├─ POST /report with every key from requests, plus anything else that changed
  └─ fullReportRequested?  → POST /report { full: true, protections: every supported key }
POST /usage (today)
POST /location (if allowed, see §3)
schedule the next run in nextSyncSeconds
```

### 4.3 A parent changes a setting

```
parent:  PUT /children/{id}/protections/BEDTIME            → batch, request PENDING
device:  POST /sync      → request in `requests`            → DELIVERED
device:  apply, read back, POST /report { BEDTIME: … }
            matches   → VERIFIED   (parent sees "Saved and verified")
            different → FAILED     (parent sees "Device reported …")
```

Guided setup (iOS Web, Downloads, Location): the request isn't sent to the device. The parent changes the setting by
hand and taps "Verify now", which sets `fullReportRequested`. The device's full report then verifies it.

### 4.4 Offline and retries

- Queue `/report`, `/usage` and `/events` on disk while offline and send them in order when back.
  Keep at most the newest `/report` per protection and the newest `/location`.
- Retry `5xx` and network errors with backoff (30 s to 15 min, with jitter). Drop items that get `400`.
- `401` at any point: the device was removed. Stop everything.

### 4.5 Removal

A parent removes the device (or the child, or the family). The token stops working at once, and the family gets a
"Device removed" alert. The device finds out on its next call (`401`): stop enforcing, clear stored data and the
token, and show the removal screen. There is no way yet for the device to unpair itself (gap G6).

---

## 5. Enums and config reference

### Protections and their configs

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

### Platform capability

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

### Other enums

| Enum | Values |
|---|---|
| `platform` | `ANDROID`, `IOS` |
| `kind` | `PHONE`, `TABLET` |
| app `approval` | `ALLOWED`, `ALWAYS_ALLOWED`, `FILTERED`, `BLOCKED`, `PENDING` |
| event `type` | `APP_INSTALLED`, `APP_REQUESTED`, `APP_BLOCKED`, `LIMIT_REACHED` |

---

## 6. What the parent sees

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

## 7. Known gaps

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
