# Devices

Every phone, tablet and browser that eGuard protects: pairing them to a child, seeing whether each one is healthy,
checking what a single device reported for each protection, choosing a child's primary device, moving a device to
another child, and renaming or removing it. A device is how a child's protections reach the real world; without
one, nothing the parent sets can be verified.

**Status:** Built and in use. Feature completeness **100%** of this review (see [§9](#9-completeness)). Written
2026-10-04, updated the same day after the fixes in [§10](#10-issues-found), primary choice, moving devices and tests.
**Routes:** `/devices` (list, pairing, browsers; `?child=…#pair` preselects a child), `/devices/[id]` (one phone or tablet).
**Code:** `src/app/(app)/devices/{page,[id]/page,loading,[id]/loading}.tsx`, `src/components/device-forms.tsx`
(pairing, rename, primary, move, remove), `src/components/{cards,browser-card}.tsx`, `src/app/actions/family.ts`
(server actions), `src/lib/family-service.ts` (`createPairingCode`, `pairingCodeStatus`, `renameDevice`,
`setPrimaryDevice`, `moveDevice`, `removeDevice`), `src/lib/device-slots.ts` (plan limit and the per-family device
lock), `src/lib/browser-service.ts` (browsers), `src/app/api/device/v1/{pair,sync}/route.ts` (the device's side).
**Mobile counterpart:** `/api/mobile/v1/devices/**`, `/api/mobile/v1/browsers/**`,
`POST /api/mobile/v1/children/{id}/pairing-code`, see [mobile-api.md](../mobile-api.md).
**Related:** [dashboard.md](dashboard.md) (scoring, device states), [children.md](children.md) (a child's Devices
and Browser tabs), [browser-extension-api.md](../browser-extension-api.md), [child-app-spec.md](../child-app-spec.md)
(what devices report), [subscriptions.md](../subscriptions.md) (device limits).

## Contents

1. [Pages at a glance](#1-pages-at-a-glance)
2. [Devices list](#2-devices-list)
3. [Pairing](#3-pairing)
4. [Device page](#4-device-page)
5. [Renaming, primary, moving and removing](#5-renaming-primary-moving-and-removing)
6. [Rules and limits](#6-rules-and-limits)
7. [Status reference](#7-status-reference)
8. [Web vs mobile](#8-web-vs-mobile)
9. [Completeness](#9-completeness)
10. [Issues found](#10-issues-found)
11. [Suggestions](#11-suggestions)
12. [Testing](#12-testing)

---

## 1. Pages at a glance

```
/devices                                        /devices/[id]
┌───────────────────────────────────────────┐   ┌──────────────────────────────────────────────────┐
│ Devices                                   │   │ Devices › Galaxy A54                             │
│ 3 of 10 devices on your plan, counting …  │   │ ┌──────────────────────────────────────────────┐ │
│ (M) Mia's devices                         │   │ │ [icon] Galaxy A54        [Run Configuration  │ │
│ ┌──────┐ ┌──────┐ ┌──────────┐            │   │ │ Mia's device · 14 · SM-A546   Check]         │ │
│ │phone │ │tablet│ │browser + │            │   │ │ Healthy · Android                            │ │
│ └──────┘ └──────┘ │ Remove   │            │   │ └──────────────────────────────────────────────┘ │
│                   └──────────┘            │   │ (offline banner)                                 │
│ (L) Leo's devices                         │   │ Last sync │ Screen time │ Bedtime │ Location │…  │
│ [No devices for Leo]                      │   │ ┌───────────────────────────┐ ┌────────────────┐ │
│ Pair a device   [child ▾] [Get code]      │   │ │ Protections on this device│ │Recent requests │ │
│ Add a browser   [child ▾] [name] [Get…]   │   │ │ 10 rows · badge · Manage  │ │Device settings │ │
└───────────────────────────────────────────┘   │ └───────────────────────────┘ └────────────────┘ │
                                                └──────────────────────────────────────────────────┘
```

Both pages need a signed-in parent (`requireUser`) and only read the parent's own family. Browsers have no page of
their own: they live on the list, on the dashboard and on the child's Browser tab.

## 2. Devices list

`/devices` loads the family, the family graph (`getFamilyGraph`) and the browsers (`listBrowsers`) in parallel.

**Header text:**

| Condition | Text |
|---|---|
| within the plan | "*n* of *limit* devices on your plan, counting browsers. Each device reports its configuration back to eGuard when it syncs." |
| over the plan (after moving to a smaller one) | "*n* devices, more than the *limit* your plan covers now. They stay protected; remove some or change your plan to add more." On the top plan, "or change your plan" is left out |

"Devices" here counts phones + tablets + browsers that aren't disconnected for security, the same count the plan
limit uses (`usedDeviceSlots`).

**One section per child**, in the family's child order, titled with the child's avatar and "*Name*'s devices":

- each phone or tablet as a `DeviceCard` (platform chip, name, child, OS version, status badge, last sync), linking
  to `/devices/[id]`. Within a child, the primary device comes first, then by pairing date;
- then each browser as a `BrowserCard` (computer name, child, browser and major version, extension version, status
  pill, last check-in, a note, **Browser settings** → the child's Browser tab, and **Remove**). A browser disconnected for security still shows, with
  "Disconnected for security";
- or, with neither, "No devices for *Name*": get a code below and enter it in the app or the browser extension.

**No children:** both pairing forms are replaced by one card, "Add a child first", with **Add child**.

## 3. Pairing

Two forms side by side, both `PairDevice`:

| Form | Anchor | Fields | The code is entered in |
|---|---|---|---|
| **Pair a device** | `#pair` | child | the eGuard Android app: **Pair with parent** |
| **Add a browser** | `#add-browser` | child, computer name (1–60 characters, e.g. "Mia's MacBook") | the eGuard extension for Chrome, Edge or Firefox: **Get started** |

The card says the iPhone and iPad app is coming soon; only Android is offered.

**Getting a code** (`createPairingCode` → `family-service.createPairingCode`):

1. Refreshes the family's purchases, so a lapsed or refunded plan is reflected in the limit.
2. Checks the child belongs to the family (404 otherwise) and that the parent's **email is verified**.
3. Refuses if every slot is used: "*Plan* covers *n* devices. Remove a device or upgrade to *next plan* to add
   another." (no upgrade offered on the top plan).
4. Rate limit: 20 codes per parent per hour.
5. Makes an 8-character code from an alphabet without look-alikes (no 0/O, 1/I), valid **15 minutes**
   (`PAIRING_CODE_TTL_S`). It returns `expiresInSeconds` as well as `expiresAt`: screens count down from the
   moment the answer arrived, so a computer or phone whose clock is off still shows the right time left.
6. Deletes the child's earlier unused code **of the same kind**, so at most one phone code and one browser code per
   child are ever live.

**While the code is on screen** the form shows the code (large, read out letter by letter to screen readers),
**Copy**, a countdown, and instructions. Every 3 s it asks `pairingStatus`:

| Answer | Shows |
|---|---|
| waiting | the code and countdown |
| paired, phone or tablet | "*Device* is paired with *Mia*. eGuard is checking its protections now. **View device**"; the page refreshes |
| paired, browser | "*Chrome on Mia's MacBook* is paired with *Mia*. It now appears under their devices."; the page refreshes |
| expired (or the countdown reached 0) | "This code expired. Get a new code and enter it within 15 minutes." |
| replaced | "This code was replaced by a newer one (another parent or tab). Get a new code." |

Changing the child or the computer name clears the code. A network blip doesn't stop the polling.

**Full plan:** the form says "*n* of *limit* devices on your plan used. Remove a device or change your plan to add
another." (on the top plan just "Remove a device to add another.") and disables its fields and button.

**On the device** (`POST /api/device/v1/pair`): the code may be typed with spaces, dashes or in lower case. The
endpoint is limited to 20 attempts per IP per 15 minutes. A browser code entered in the phone app is refused with
a hint. The code is **claimed atomically** first, so two devices using the same code can't both pair; then the
device is created under a per-family lock (`withDeviceSlot`), so two devices pairing at once can't both take the
last slot. If the plan is full (409) or anything fails, the code is released so the parent can use it again. The
first device of a child becomes its **primary** (listed first, shown on the child's card). When the primary is
removed, the child's oldest remaining device takes over (`ensurePrimary`, under the same lock). A new device raises an Info alert "New device synchronized" and is
asked for a full report at once. Browsers follow the same pattern in `browser-service.pairBrowser`.

## 4. Device page

`/devices/[id]`. An unknown id, or a device from another family, gives 404. The page title is the device name.

### 4.1 Header

Breadcrumb **Devices › *name***, the device icon, name, "*Mia*'s device · *OS* · *model*" (the child links to their
profile), and pills:

| Pill | When |
|---|---|
| Healthy / Offline | device state (see [§7](#7-status-reference)) |
| Waiting for first check | nothing reported yet |
| *n* issues | otherwise, when protections aren't passing |
| Android / iOS | always |
| Simulated | driven by the development device simulator |

**Run Configuration Check** asks this device to report now and shows the result (see
[dashboard.md §5.7](dashboard.md#57-configuration-check-dialog)). It's disabled while the device is offline, with
"Available when the device is back online".

### 4.2 Offline banner

When the device hasn't synced in 24 h: "This device hasn't synced since *time*" (or "hasn't synced yet"), and that
its protections keep working offline and the details below are what it last reported. The key facts are marked as
described by this note for screen readers.

### 4.3 Key facts

| Fact | Shows |
|---|---|
| Last sync | day and time in the family's timezone |
| Screen time today | the **child's** total across all devices vs today's limit (weekend limit on Sat–Sun); "*x* over *Mia*'s limit" in amber past it; "*y* on this device" when the child has more than one device |
| Bedtime | what the device reported, or Not reported / Not supported / Not configured |
| Location | Not on your plan (Free) / Not reported (the device hasn't reported location yet) / Sharing / Off |
| App approval | Required, or what was reported |
| Battery | percentage, or Unknown |

### 4.4 Protections on this device

All 10 protections, each with: an icon tile toned by status, the platform's capability (Available, Guided setup,
Verification only, Unsupported), what the device reported, when it was last checked, and, when it isn't passing,
the device's own message (the same text the mobile app shows). Then a check badge and **Manage**, which opens the
setup flow on that protection **for the child**: a protection is set per child and applies to all their devices.
Unsupported protections have no Manage.

### 4.5 Recent requests

The device's last 6 configuration requests: "*Protection*: *status*" (a failure gives the device's reason), who
asked and whether it was applied remotely or by guided setup, the time, and the requested value. With 6 shown, a
link to all of the child's changes (History tab). Below: "Last configuration check *time*: *n* to review / no issues
found". Empty: "No configuration requests yet."

### 4.6 Device settings

Rename form, eGuard app version, date added, then (see [§5](#5-renaming-primary-moving-and-removing)):

- the primary line: "*Mia*'s primary device: listed first and shown on their card", or **Make primary** when the
  child has another phone or tablet (nothing when this is their only one);
- **Move to another child**, when the family has another child;
- **Remove device**.

## 5. Renaming, primary, moving and removing

| Action | Who | How | Effect |
|---|---|---|---|
| **Rename** a phone or tablet | any parent | device page, 1–60 characters (`DeviceName`) | name updated everywhere; "Saved."; audit entry `device.renamed` ("Mia's Galaxy A54 → Mia's phone"). Web and app share `family-service.renameDevice` |
| **Make primary** | any parent | device page | this device becomes the child's only primary (listed first, on their card); toast "Now *Mia*'s primary device."; audit `device.primary` |
| **Move to another child** | any parent | device page: choose the child; password or DELETE | see below; "Moved to *Leo*. *Tablet* gets *Leo*'s protections on its next sync." |
| **Remove** a phone or tablet | any parent | device page; password, or typing DELETE for accounts without one; optional **Also delete what it recorded** | see below; redirects to `/devices` |
| **Remove** a browser | any parent | its card on `/devices`; same confirmation | the extension is disconnected and its tokens stop working; its open browser alerts resolve; "Browser removed" alert |

**Removing a phone or tablet** (`family-service.removeDevice`):

1. Confirms the password or DELETE (`confirmDestructive`).
2. In one transaction: if asked, deletes the screen time, app usage and places it recorded (first, while those rows
   still carry its id); deletes the device (its token, protections, requests and check results go with it); and
   resolves its open alerts.
3. If it was the child's primary device, their oldest remaining device becomes primary.
4. Unticked, its recorded history stays with the child (the rows' device becomes empty) until the family's
   retention period.
5. Writes an audit entry (`device.removed` or `device.removed_with_history`) and raises an Attention alert "Device
   removed" (emailed), saying who removed it, that its protections stay on the device unverified, and what happened
   to its history.
6. Another parent removing it at the same moment, or a second tab, gets "This device was already removed." with a
   link back to Devices.

**Primary device.** Each child has at most one. The first device paired becomes primary. The parent can make another
one primary (`setPrimaryDevice`). When the primary is removed or moved away, the child's oldest remaining device takes
over. All of this runs under one per-family database lock (`withDeviceLock` in `device-slots.ts`), the same one
pairing takes, so two parents (or pairing and a change) can't leave a child with two primaries or none.

**Moving a phone or tablet** (`family-service.moveDevice`): for a hand-me-down, or a device paired to the wrong
child. Pairing again would cost a code, a trip to the device and its link to its history.

1. Checks the device and the new child are in the family (404 otherwise), and that it's a different child (400).
2. Confirms the password or DELETE: moving a device to a child with looser rules would otherwise quietly lift its
   protections.
3. Under the family's device lock, re-reads the device: if another parent removed or moved it meanwhile, it's a 404
   and nothing changes. Then, in one transaction:
   - **what it recorded stays with the old child**: its screen time, app usage and places are detached from the
     device (as when it's removed), so its next usage starts new rows under the new child;
   - its **reported protections are cleared** (they were checked against the old child's settings), so it reads
     "Waiting for first check", and a full report is requested;
   - its **last position is cleared**, so the old child's whereabouts aren't shown as the new child's;
   - its **unfinished configuration requests are cancelled**, and its open alerts resolved;
   - it moves to the new child, as their primary only if they have none; if it was the old child's primary, their
     oldest remaining device takes over.
4. Writes an audit entry (`device.moved`, "Tablet: Mia → Leo") and raises an Attention alert "Device moved" on the
   new child, saying who moved it and that its history stays with the old child.

On its next sync the device gets the new child's policy and apps, and `childName` in the `/sync` response, so the
child app can show the right name. Today's usage that the device already counted before the move arrives in its next
total, so the new child's first day can include some minutes from before the move.

## 6. Rules and limits

| Rule | Where |
|---|---|
| Device limit per plan: Free 2, Plus 10, Pro 20; browsers count, ones disconnected for security don't | `usedDeviceSlots` |
| Families over the limit keep their devices; they just can't pair more | `createPairingCode`, `withDeviceSlot` |
| Only a verified email can make pairing codes | `requireVerifiedEmail` |
| Codes: 8 characters, 15 minutes, one live per child per kind, 20 per parent per hour | `createPairingCode` |
| Pairing: 20 attempts per IP per 15 minutes; one device per code, even when two race | `/api/device/v1/pair` |
| Device and computer names 1–60 characters | `renameDevice`, `PairingOptions`, pair route |
| Removing and moving need the password or DELETE; any parent may do either | `confirmDestructive` |
| One primary device per child, decided under the family's device lock | `withDeviceLock`, `makePrimary`, `promoteOldest` |
| Offline = no sync for 24 h | `OFFLINE_AFTER_MS` |
| Every action re-checks the id belongs to the family | `findFirst({ familyId })`, `updateMany({ familyId })` |

## 7. Status reference

**Device state** (cards, header):

| State | Rule | Badge |
|---|---|---|
| healthy | online, every protection passing | green "Healthy" |
| issues | online, *n* protections not passing (unreported count) | amber "*n* issues" |
| offline | no sync for 24 h | grey "Offline", plus issues if any |
| first check | nothing reported yet (`deviceState().firstCheck`) | grey "Waiting for first check" (replaces "10 issues"), also in the dashboard's Device Status tab and as `firstCheck` in the mobile API |

**Browser status** (`browserStatus`, the same on Devices, the dashboard and the child's Browser tab): Protected ·
Needs attention · Action required · Sync paused · Not supported · Not seen for a day · Disconnected for security ·
Connected (waiting for its first health check). Each has a one-line note on the card.

**Configuration request:** Waiting for device · Waiting for guided setup · Delivered, not yet verified · Verified ·
Didn't match (with the reason) · Cancelled.

**Check statuses and capabilities:** as in [dashboard.md §4–5](dashboard.md#4-how-protection-is-measured).

## 8. Web vs mobile

| | Web | Mobile app |
|---|---|---|
| List | grouped by child, phones/tablets then browsers | `GET /devices` (flat, primary first per child) and `GET /browsers` |
| Just-paired device | "Waiting for first check" | `firstCheck: true` (with `issues: 10`), for the app to say the same |
| Unreported protection | "Not reported" | "Not reported" |
| Pairing code | both kinds, with live status; countdown from `expiresInSeconds` | `POST /children/{id}/pairing-code` (`expiresInSeconds` too); no status endpoint |
| Rename | audited | audited (same service function) |
| Rename, remove (with history choice), run check | yes | yes |
| Primary device | shown and set on the device page | `isPrimary` flag; `PATCH /devices/{id}` with `isPrimary: true` |
| Move to another child | device page | `POST /devices/{id}/move` |

## 9. Completeness

| Area | Status | Notes |
|---|---|---|
| List grouped by child, with browsers | Done | |
| Plan usage and over-limit families | Done | No "change your plan" on the top plan |
| Pair a phone or tablet | Done | Verified email, rate limits, race-safe |
| Add a browser | Done | |
| Live pairing status | Done | Countdown doesn't depend on the device's clock |
| Device header, states, first check | Done | First check shared with the dashboard and the app |
| Offline handling | Done | Banner, check disabled, last-known wording |
| Key facts | Done | Location says "Not reported" until the device reports it |
| Protections per device | Done | Capability, reported value, device message, Manage |
| Recent requests and last check | Done | |
| Run a check on one device | Done | |
| Rename | Done | Audited, web and app |
| Remove with history choice | Done | Tested |
| Remove a browser | Done | |
| Primary device | Done | Parent chooses it (web and app); handed on when the primary is removed or moved; one per child under a lock |
| Move a device to another child | Done | Password-confirmed; history stays with the old child; re-checked against the new child's settings |
| Browser settings from Devices | Done | **Browser settings** link on each browser card |
| Loading states | Done | Skeletons shaped like each page |
| Web/mobile consistency | Done | `firstCheck`, "Not reported", `expiresInSeconds`, audited rename, primary and move in both |
| Tests | Done | Services, web action wrappers, and the primary and move rules against the real database |

**Overall: 100%** of what this review set out (20 of 20). Was ~73% at the first review and ~90% after the fixes,
both on 2026-10-04. The suggestions below are improvements, not gaps. Page rendering still has no automated test.

## 10. Issues found

All eight issues from the first review were fixed on 2026-10-04:

| # | Issue | Fix |
|---|---|---|
| 1 | On the top plan, a full or over-limit family was told to "change your plan" | The list header and `PairDevice` (new `upgrade` prop, from `nextPlan()`) leave it out when there's no bigger plan |
| 2 | Removing a child's primary device left them with none; the next device paired jumped ahead of older ones | `removeDevice` calls `ensurePrimary()` (`src/lib/device-slots.ts`): the oldest remaining device becomes primary, under the pairing lock |
| 3 | The Location fact read "Off" before the device had reported location | "Not reported" when there's no location record yet |
| 4 | Browser cards on `/devices` didn't link to the child's Browser tab | **Browser settings** link on every `BrowserCard` (Devices page, child Overview and Devices tabs) |
| 5 | Renaming a device wasn't audited | `family-service.renameDevice` writes `device.renamed`; the web action and mobile `PATCH /devices/{id}` both use it, with one `DeviceName` rule |
| 6 | The countdown trusted the browser's clock | The service returns `expiresInSeconds`; the form counts down from when the code arrived. Mobile gets the field too (documented in mobile-api.md) |
| 7 | Loading skeletons didn't match the pages | Both rebuilt in the shape of their page (no phantom header button; crumbs, header, facts, two columns) |
| 8 | Mobile showed a just-paired device as 10 issues and unreported protections as "Unknown" | `deviceState()` returns `firstCheck`, used by the web cards, the device page, the dashboard's Device Status tab (which also said "10 issues") and mobile `deviceJson`; mobile says "Not reported" |

**Open:** none known.

## 11. Suggestions

**Usefulness**

1. A summary line at the top of `/devices`: "2 need attention · 1 offline", linking to the first one.
2. On the device page, a short **battery and last-location time** history, so "Offline" can be explained ("battery
   was at 3%").
3. Show the browser's own detail (its last health report, checks failing) somewhere: a `/devices/browser/[id]`
   page, or an expandable card.
4. Move browsers between children too (today only phones and tablets move; a browser is removed and added again).
5. In the child's History tab, note "Tablet moved here from Mia" so the gap in its data has an explanation.

**Quality**

6. A `pairingCode` status endpoint for the mobile app, so it can say "Paired" without polling the device list.
7. Page render tests for `/devices` and `/devices/[id]` (needs a page-level harness, as for children).

## 12. Testing

| What | Where | Covered |
|---|---|---|
| Removing a device: history kept or deleted (and in which order), 404 on a race, audit, primary handed on only when the primary goes | `src/lib/test/devices.test.ts` | yes |
| Renaming: family scoping, audit, unchanged name is a no-op, 404 on a race, name rule | `src/lib/test/devices.test.ts` | yes |
| Make primary: under the lock, audit, no-op when already primary, 404s | `src/lib/test/devices.test.ts` | yes |
| Moving: what's detached, cleared and cancelled, primary on both sides, password first, same child 400, other family 404, a race changes nothing | `src/lib/test/devices.test.ts` | yes |
| Web device actions: pairing code input and `expiresInSeconds`, pairing status, rename, remove (history choice, already removed, wrong password), remove browser, make primary, move (removed device vs removed child) | `src/app/actions/family.test.ts` | yes |
| Against the database: first device primary; make primary leaves one; move keeps Mia's minutes and puts the device's new usage under Leo; device's next sync has Leo's name and policy and asks for a full report; `firstCheck` until it reports; primary on both sides; removing the primary hands it on | `tests/api/devices.test.ts` | yes |
| Device states, offline rule, `firstCheck` | `src/lib/test/health.test.ts` | yes |
| Codes replace each other, expire, other family can't read them, rate limit | `tests/api/verification.test.ts` | yes |
| One device per code when two race | `tests/api/security.test.ts` | yes |
| Verified email before pairing; new device gets policy and a full-report request; rename; remove with password | `tests/api/mobile-api.test.ts` | yes |
| Browser pairing, removal, slots (Free 2), a disconnected browser frees its slot | `tests/api/browser.test.ts` | yes |
| Page render | — | **no** (suggestion 7) |

**Last run (2026-10-04, after primary and moving):** unit tests 193/193 (`npm test`, run from PowerShell), API
suite 245/245 (`npm run test:api`, with the settings in README › API tests, against a dev server started from
PowerShell), type check and lint clean. No page was opened or clicked in a browser: the **Make primary** button,
the move form, the skeletons, the **Browser settings** link and the countdown are checked by type and tests only.

**Manual checklist**

- [ ] No children: only "Add a child first" shows, no pairing forms.
- [ ] Child without devices: "No devices for *Name*"; from their profile, **Pair a device** preselects them.
- [ ] Get a phone code: code, Copy, countdown; enter it in the app → "paired", **View device**, card appears.
- [ ] Get a second code for the same child: the first one's screen says "replaced".
- [ ] Wait 15 minutes: "This code expired".
- [ ] Add a browser without a computer name: button disabled. With one: code; pair the extension → card appears.
- [ ] Free plan with 2 devices: forms disabled, "Remove a device or change your plan"; the app gets 409 if it
      tries anyway, and the code still works after removing one.
- [ ] Family Pro with 20 devices: "Remove a device to add another.", no plan link.
- [ ] Set the computer's clock 10 minutes ahead, get a code: the countdown still starts at 15:00.
- [ ] Remove a child's primary phone when they also have a tablet: the tablet is now first on their card.
- [ ] Device that hasn't reported location: Location reads "Not reported", not "Off".
- [ ] Browser card: **Browser settings** opens the child's Browser tab.
- [ ] Rename a device: an entry "device.renamed" appears in the audit log.
- [ ] Slow network (DevTools throttling): the skeletons have the same shape as the loaded pages.
- [ ] Child with a phone and a tablet: the tablet's page shows **Make primary**; after it, the tablet is first on
      their card and the phone's page says "Not *Mia*'s primary device".
- [ ] A child's only device: says it's their primary, no button. A family with one child: no move option.
- [ ] Move the tablet from Mia to Leo with the wrong password: refused. With the right one: "Moved to Leo…", the
      tablet reads "Waiting for first check", Mia's reports keep today's minutes, Leo gets a "Device moved" alert.
- [ ] After the move, the tablet's child app shows Leo's name and Leo's bedtime on its next sync.
- [ ] Unverified email: getting a code is refused with the verify message.
- [ ] Device just paired: "Waiting for first check" on its card and page.
- [ ] Device unseen for a day: offline banner, check button disabled, "Offline" badge.
- [ ] Child over their limit across two devices: amber "over *Mia*'s limit" and "on this device".
- [ ] A protection that doesn't match: amber tile with the device's message; **Manage** opens the flow for the child.
- [ ] Rename: "Saved.", new name on the list and dashboard.
- [ ] Remove with the wrong password: refused. With **Also delete what it recorded** unticked: the child's reports
      keep the screen time; ticked: it's gone. Other parents get "Device removed".
- [ ] Remove in two tabs: the second says "already removed".
- [ ] Remove a browser: card disappears, slot freed, "Browser removed" alert.
- [ ] `/devices/<another family's device id>`: 404.
