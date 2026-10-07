# Location

Where each child is, or was last seen, on a family map (`/location`), and the places a child's devices stayed at
(`/location/[childId]`) when the family keeps location history. Location is a paid feature (eGuard Plus and above):
on Free both pages show an upgrade note and the server drops every fix.

**Status:** Built and in use. Feature completeness **~97%** of this review (see [§9](#9-completeness)). Written
2026-10-04, updated the same day after the fixes in [§10](#10-issues-found).
**Routes:** `/location` (family map), `/location/[childId]` (one child's places, `?before=` pages back).
**Code:** `src/app/(app)/location/{page,loading,lazy-map}.tsx`, `src/app/(app)/location/[childId]/page.tsx`,
`src/components/family-map.tsx` (Leaflet map), `src/lib/location.ts` (`childLocation`, `deviceSharing`,
`recordLocation`, `visitsPage`, `recentVisits`, `placeFor`, `stayed`, `visitSpan`), `src/lib/places.ts` and
`src/app/actions/places.ts` (saved places), `src/components/place-forms.tsx` (**Name this place**, the places list),
`src/app/api/device/v1/location/route.ts` (fixes from devices),
`src/lib/engine.ts` (`processReport`: sharing on/off from the `LOCATION` report), `src/app/api/tiles/[z]/[x]/[y]/route.ts`
(tile proxy), `src/lib/plan-access.ts` (`requireLocationSharing`, `clearCurrentLocations`), `src/lib/maintenance.ts`
(retention purge).
**Mobile counterpart:** `GET /locations`, `GET /children/{id}/location`, `GET /children/{id}/location/visits`,
`GET|POST /places`, `PATCH|DELETE /places/{id}`, `PATCH /family/privacy`, see [mobile-api.md › P4.10](../mobile-api.md#p410-location).
**Related:** [protection.md](protection.md) (the `LOCATION` protection and its setup flow), [children.md §5.6](children.md#56-location)
(the child's Location tab), [dashboard.md §5.6](dashboard.md#56-location-states) (location in Today's activity),
[devices.md](devices.md) (the Location fact per device), [child-app-spec.md §9](../child-app-spec.md#9-screen-time-location-and-events)
(what devices send).

## Contents

1. [Page at a glance](#1-page-at-a-glance)
2. [Family map](#2-family-map)
3. [Children list](#3-children-list)
4. [Recent places and the history card](#4-recent-places-and-the-history-card)
5. [A child's places](#5-a-childs-places)
6. [How location is recorded and kept](#6-how-location-is-recorded-and-kept)
7. [Status reference](#7-status-reference)
8. [Web vs mobile](#8-web-vs-mobile)
9. [Completeness](#9-completeness)
10. [Issues found](#10-issues-found)
11. [Suggestions](#11-suggestions)
12. [Testing](#12-testing)

---

## 1. Page at a glance

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Family Location                                                                          │
│ Where your children are, or were last seen, when they share their location. Updates …   │
├──────────────────────────────────────────────┬───────────────────────────────────────────┤
│                                              │ Children                                  │
│        (M) Mia · Home                        │ (M) Mia   Home · 2 min ago · Galaxy A54   │
│            2 min ago      ┌╌╌╌╌┐ saved place │                                  [● Live] │
│                     ◯ accuracy circle        │ (L) Leo   Current location · 3 hours ago  │
│   (L) Leo · Current location (faded)         │           · iPad          [⟲ Last seen]   │
│       Last seen 3 hours ago                  │           ⌖ Name Leo's place              │
│                                              │ (S) Sam   Sharing is off on Pixel 7       │
│   [+/-]                       © OSM          │                                [Turn on]  │
│                                              ├───────────────────────────────────────────┤
│                                              │ Saved places                              │
│                                              │ ⌂ Home  Within 150 m       [Edit][Remove] │
│                                              ├───────────────────────────────────────────┤
│                                              │ Recent places   (history on only)         │
│                                              │ (M) Mia  Home (2 min ago) · School (…)    │
│                                              │                               View all    │
│                                              ├───────────────────────────────────────────┤
│                                              │ ⊘ Location history is on                  │
│                                              │   Places … kept for 90 days      Privacy  │
└──────────────────────────────────────────────┴───────────────────────────────────────────┘
```

Needs a signed-in parent (`requireUser`); data comes from `getFamily` and `getFamilyGraph` (each device with its
`location` row and protections). Before anything else the page checks the plan: without `locationSharing` it shows
only "Location sharing isn't on your plan" with the upgrade line. With no children: "No children yet" and **Add
child**.

The page refreshes itself every **30 s** while the tab is visible, and once when the tab becomes visible again
(`LocationRefresh`, a `router.refresh()`), so the map keeps the parent's zoom and position.

## 2. Family map

`FamilyMap` (Leaflet, client-only, loaded through `LazyMap` with a skeleton):

| Part | Behaviour |
|---|---|
| Pin | the child's photo or initial in their colour, with a label "*Mia* · *place*" and the age ("2 min ago", or "Last seen 3 hours ago") |
| Place | the saved place the fix falls inside, else the device's label, else "Current location"; "(approximate)" when accuracy is worse than **200 m** (`APPROXIMATE_M`) |
| Saved places | a dashed circle of the place's radius, with its name on hover (`.map-place`, themed) |
| Accuracy | a faint circle of `accuracyM` metres around the pin, so a rough fix doesn't read as a street address |
| Stale | the pin is faded (`map-pin stale`) when the fix isn't fresh ([§7](#7-status-reference)) |
| Framing | one child: zoom 15 on them; several: fit all with padding; none: a neutral world view. It reframes only when the set of children on the map changes, so a refresh never undoes the parent's zoom |
| Scroll | scroll-wheel zoom is off (the page scrolls); buttons and pinch zoom work |
| Screen readers | the map is a `region` whose label lists every child ("Mia at Current location, 2 min ago. Leo: no location") |
| Tiles | `/api/tiles/{z}/{x}/{y}`: fetched by the server, so the tile provider never sees the parent's IP or which area they look at. Signed-in parents only (not an open proxy), zoom 0–18, a 1,500-tile in-memory cache for 24 h, `MAP_TILE_URL` to use a commercial provider (its key never reaches the browser; MapTiler today), `MAP_TILE_REFERER` for a key limited to allowed websites. The corner credit follows the provider. A refused key is logged as "[tiles] The tile provider answered 403" |

Children without a location aren't drawn; they're only named in the map's label and in the list beside it.

## 3. Children list

One row per child, from `childLocation(c.devices)`: the **newest** fix among the child's devices that share
(a phone 30 minutes ago loses to a tablet 3 minutes ago).

| State | Line | Right side |
|---|---|---|
| `located` | "*place* · *2 min ago* · *device*"; outside every saved place, **Name *Mia*'s place** | **Live** (green) when fresh, else **Last seen** (amber, tooltip with the time) |
| `waiting` | "Sharing is on. Waiting for the first location from the device.", or "Waiting for *Pixel 7* to report whether location sharing is on." before any device has reported | **Waiting** |
| `no_devices` | "No device paired yet" | **Pair a device** (`/devices?child=…#pair`) |
| `sharing_off` | "Sharing is off on *Pixel 7*" (the first device that reported it off), else "Location sharing is off" | **Turn on**: the setup flow on `LOCATION` for that child ([protection.md §4](protection.md#4-the-setup-flow)) |

Whether a device shares (`deviceSharing`): its `DeviceLocation.sharing` when it has a row, else what its `LOCATION`
protection last reported, else unknown. A child is `waiting` when some device shares but none has sent a fix, or
when no device has reported yet and the parent's `LOCATION` setting isn't off (`unreported`). They're `sharing_off`
when a device reported sharing off, or nothing shares and the parent's setting is off.

## 4. Saved places, recent places and the history card

**Saved places** (always): the family's named places, by name, each "Within 150 m" with **Edit** (name and radius)
and **Remove** (confirmed inline: "Visits at Home lose its name…"). Empty: "Name the places your children go, like Home
or School…". A place is made with **Name *Mia*'s place** under a child who's outside every saved place, or **Name
this place** on a visit in their places: a name (1–40 characters) and a radius (100, 150, 250, 500 m or 1 km). Any
parent can manage them; up to 30 per family; on Free only removing works ([§6](#6-how-location-is-recorded-and-kept)).

**Recent places** (only when the family keeps history): one row per child who has a device, with the last **3**
places they **stayed at** in the past 24 hours (`recentVisits`, fetched per child so a busy child can't crowd out the
others; spots passed on the way are left out): "*Home* (2 min ago) · *School* (3 hours ago)", or "No places in the
last day", and **View all** (`/location/{childId}`). The time is when the child arrived.

**History card** (always): "Location history is on: places your children visit are kept for *90* days, then
deleted", or "off: only each device's latest location is kept, and it's deleted when sharing is turned off", with a
**Privacy** link (`/settings/privacy`).

## 5. A child's places

`/location/[childId]`: title "*Mia*'s places", breadcrumb back to Location, the child's avatar. A child of another
family is a 404; the tab title uses the child's name only for a parent of that family.

| Situation | Shows |
|---|---|
| Plan without location | the upgrade note |
| History off | "Location history is off. Turn it on in Privacy settings to see where *Mia* has been." (+ "Only the family admin can change it." for other parents), **Privacy settings** |
| No visits | "No places yet: places appear here once *Mia*'s device shares its location" |
| Visits | grouped by day in the family's time zone (Today, Yesterday, then dates); each row: place (or "Unnamed place"), "*device* · 14.6507, 121.0494" ("Removed device" once the device is gone), and "9:10 AM – 3:40 PM · 6 h 30 min" ("11:00 PM – 7:00 AM next day · 8 h" across midnight). A place they stayed at with no saved name offers **Name this place** |
| Passing by | a visit of a single fix (under `STAY_MS`, 4 minutes): route icon, "Passing by" (or "Passed by *School*"), one time |
| Paging | 50 at a time, newest first; **Show older places** (`?before=` the last row's `arrivedAt`), **Back to newest**; past the end "No older places: that's everything eGuard has kept" |

Two views, as tabs: **By day** (the default) and **All places** (`?view=all`, the list above).

| By day | Shows |
|---|---|
| Day | `?day=YYYY-MM-DD` in the family's time zone, today by default; a day before the retention period or in the future falls back to today. Previous and next buttons (disabled past either end) and a date picker (`min`/`max` the same bounds) |
| Map | the day's route: a dashed line through its visits in order, each stay as a numbered pin, passing-by fixes as small dots, saved places as dashed circles. Framed on the whole route |
| Visits | oldest first, stays numbered as on the map ("1. School"). A visit spanning midnight is on both days. At most 300 a day (`DAY_VISITS_MAX`) |
| Show on map | on every row (also in All places, where it opens that visit's day): `?day=…&focus=<visitId>` centres the map on it and enlarges its pin |
| No visits | "No places this day" |

In All places, each day heading links to **Map of the day**.

## 6. How location is recorded and kept

**Sharing on or off** is the `LOCATION` protection, never a fix arriving:

1. The parent changes it with the setup flow (Android: Available; iOS: Guided setup).
2. The device reports `LOCATION { sharing }` (`true` only when the permission is granted **and** the policy has
   sharing on). `processReport` upserts `DeviceLocation.sharing`. Turning it **off** also deletes the stored
   position (lat, lng, accuracy, place, time), so no stale position is kept, shown or exported.
3. A device that turns sharing off while the parent's policy says on raises **"Location sharing turned off"**
   (Action required), once, and a passing report resolves it (see [protection.md §6](protection.md#6-how-a-change-is-verified)).

**A fix** (`POST /api/device/v1/location { lat, lng, accuracyM?, placeLabel? }`, device token):

- At most **240 per device per hour** (`LIMITS.deviceLocation`), then `429`.
- Validated: lat −90…90, lng −180…180, accuracy 0…100 km, label trimmed to 80 characters, a blank label is none.
- Dropped silently when the device reported sharing off, or the family's plan has no location sharing.
- **Named** by the nearest saved place it falls inside (`placeFor`), which wins over a label from the device; the
  row keeps the place's id, so renaming the place renames it.
- Stored as the device's one `DeviceLocation` row, **replacing** the last one whole (a fix without a label clears
  the old label). Also marks the device seen.
- With history on, also a **visit**. It extends (moves `lastSeenAt` to now) the first of: this device's last visit,
  or a visit another of the child's devices was at in the last 30 minutes, that's the same saved place, or within
  **150 m** (`SAME_PLACE_M`) with labels that don't disagree. A phone and a tablet at home make one visit. Otherwise
  a new visit starts. Then visits past the retention period are deleted for that child.
- A visit that lasted at least **4 minutes** (`STAY_MS`: two fixes a sync apart) is a place the child **stayed
  at**; a shorter one is **passing by**, shown as such and left out of Recent places.

Devices send a fix every sync while moving or after moving 150 m, and every 15 minutes at rest
([child-app-spec.md §9](../child-app-spec.md#location-location)). They don't name places in v1, so names come from
saved places.

**Saved places** (`src/lib/places.ts`): naming one labels the family's unnamed visits and current locations inside
it (`relabelAround`, a bounding-box query and then exact distances). Renaming changes the label everywhere it's
used; resizing takes the name off and labels again with the new radius; removing takes it off, and another saved
place covering the same spot names those visits instead. Creating and editing need location sharing on the plan
(another family's place is a 404 first); removing works on any plan. Each change is in the audit log
(`place.created|updated|deleted`).

**Keeping and deleting:**

| Event | What happens |
|---|---|
| History turned off (Settings › Privacy, admin only, confirmed) | every child's visits are deleted at once; current locations keep working |
| History turned on | needs a plan with location sharing |
| Retention (Settings › Privacy, default 90 days) | visits older than it are deleted on each fix and by the maintenance job |
| Plan loses location sharing | current locations are cleared (`clearCurrentLocations`); history is kept but hidden, and purged by retention |
| Device moved to another child | its position is cleared; its visits stay with the old child, without the device |
| Device removed | its visits stay with the child ("Removed device") unless the parent ticks delete history |
| Child deleted | their visits go with them |
| Family deleted | their saved places go with it |
| Account export | current location per device (with accuracy and when it was taken, `locatedAt`), every visit, the saved places |

## 7. Status reference

**Child location state** (`childLocation`, shared by web and mobile):

| State | Meaning | Web list | Child's tab | Dashboard |
|---|---|---|---|---|
| `located` | a sharing device has a fix | place · age · device, Live / Last seen | place, "From *device* · updated *x*", **Open map** | place and "Updated *x* ago" |
| `waiting` | a device shares, no fix yet; or no device has reported yet and the parent's setting isn't off | "Waiting for the first location" / "Waiting for *device* to report…", Waiting | "Waiting for location" (naming the device in the second case) | "Waiting for location" |
| `sharing_off` | a device reported sharing off, or the parent's setting is off | "Sharing is off on *device*", Turn on | "Location unavailable", **Turn on location sharing** | "Location unavailable" |
| `no_devices` | nothing paired | "No device paired yet", Pair a device | "No device to locate", **Pair a device** | no device |
| (plan) | Free | upgrade note | upgrade note | "Not on your plan" |

**Fresh vs last seen:** a fix is **live** when it's under **20 minutes** old (`FRESH_MS`, a margin over the
15-minute fixes at rest) **and** its device has synced in the last 24 hours (not offline). Otherwise it's "Last seen
*x*" and the pin is faded.

**Visit:** stayed (a place, with its duration) or passing by (one fix).

**Approximate:** accuracy over 200 m.

## 8. Web vs mobile

| | Web | Mobile app |
|---|---|---|
| Family map | `/location` | `GET /locations` (same states, `fresh`, `approximate`, `waitingForReport`, the saved `places`) |
| One child now | child's Location tab | `GET /children/{id}/location`: current fix (with `placeId`), per-device `sharing` and `hasLocation` |
| Recent visits | last 3 places stayed at per child from the past 24 h, on `/location` | today's and yesterday's visits in `GET /children/{id}/location`, up to 100 (`more`), each with `stayed`, `durationMinutes`, `spanLabel` |
| All visits | `/location/{childId}`, 50 per page | `GET /children/{id}/location/visits?limit=1–100&before=` (same visit fields) |
| Saved places | Saved places card, **Name this place** | `GET` and `POST /places`, `PATCH` and `DELETE /places/{id}` |
| History setting | Settings › Privacy (admin) | `PATCH /family/privacy { keepLocationHistory }` (admin) |
| Turn sharing on/off | setup flow on `LOCATION` | `PUT /children/{id}/protections/LOCATION` |
| Free plan | upgrade note | `403 plan_required` |
| Auto refresh | every 30 s while visible | the app's own polling |

## 9. Completeness

| Area | Status | Notes |
|---|---|---|
| Family map | Done | Photo pins, accuracy circles, faded stale pins, keeps zoom on refresh |
| Map privacy | Done | Tiles proxied, parents only, cached |
| Children list | Done | Waits for a device's first report instead of calling sharing off |
| Auto refresh | Done | 30 s while visible, and on return to the tab |
| Recent places | Done | Named, only places stayed at, one per place across devices |
| A child's places page | Done | Day groups, durations, passing by, midnight spans, paging, removed devices, empty states; a day's route on a map with numbered stays, Show on map |
| Arrive and leave alerts | Done | Per saved place, off by default; edge margin, one per child, place and direction per 30 min; emailed and pushed; web and mobile |
| Visit recording | Done | Stays vs passing by; one visit per place across the child's devices |
| Place names | Done | Saved places, named from the list, a child's location or a visit; relabels what's kept |
| Saved places management | Done | Rename, resize, alerts, remove; drawn on the map; web and mobile |
| Live vs last seen | Done | 20-minute window over 15-minute fixes |
| Sharing on/off | Done | Through the `LOCATION` protection; off clears the position; tamper alert |
| Privacy controls | Done | History off deletes, retention purge, export (now with `locatedAt`, accuracy, places), device move and removal |
| Plan gating and downgrade | Done | Pages, tab, mobile, device fixes, places; current locations cleared on downgrade |
| Device endpoint | Done | Validated, gated, 240 per hour |
| Child's Location tab and dashboard | Done | Same `childLocation` rules, with the parent's setting |
| Web/mobile consistency | Done | Same states and rules; mobile's today/yesterday list capped at 100 |
| Loading state | Done | Map and side column |
| Accessibility | Done | Map region describes every child; pills have text, not just colour; place buttons are labelled |
| Tests | Partial | Recording, places, stays and states covered; downgrade clearing, the tile proxy and page render aren't |

**Overall: ~97%** (19 done, 1 partial, of 20; **Saved places management** was added with the fixes, **Arrive and leave alerts** on 2026-10-07). Was ~72% at
the first review on 2026-10-04.

## 10. Issues found

All ten issues from the first review were fixed on 2026-10-04:

| # | Issue | Fix |
|---|---|---|
| 1 | **No place names**: devices don't send a label in v1, so everything read "Current location" / "Unnamed place" | **Saved places** (`Place`: name, point, radius 100 m–1 km, up to 30 per family). The server labels a fix inside one, nearest first, over any device label. Named from **Name *Mia*'s place** (current location) or **Name this place** (a visit); managed in a **Saved places** card (rename, resize, remove) and drawn on the map as dashed circles. Visits and current locations keep the place's id, so naming, renaming, resizing or removing relabels what's kept. Mobile `GET` and `POST /places`, `PATCH` and `DELETE /places/{id}`; `places` in `GET /locations`; exported. No third-party geocoding. Migration `20261004130000_saved_places` |
| 2 | **Every fix was a "place"**: a drive filled Recent places with points on the road | A visit counts as a stay once it spans 4 minutes (`STAY_MS`); a shorter one reads "Passing by" with a route icon and is left out of Recent places. The history page shows each stay's duration. Mobile visits carry `stayed`, `durationMinutes`, `spanLabel` |
| 3 | **Two devices, two visits** | A fix extends this device's last visit **or** a visit another of the child's devices was at in the last 30 minutes, if it's the same place |
| 4 | **"Sharing is off" before any report** | `childLocation` takes the parent's `LOCATION` setting (`locationPolicy`): with no device reported yet and the setting not off, it's `waiting`, "Waiting for *Pixel 7* to report whether location sharing is on." (web list, child tab, dashboard, mobile `waitingForReport`) |
| 5 | **Live flickered to Last seen** between 15-minute fixes | `FRESH_MS` is 20 minutes; mobile-api.md and child-app-spec.md say so |
| 6 | **No rate limit on `POST /device/v1/location`** | `LIMITS.deviceLocation`: 240 per device per hour, then `429`; documented for the child app |
| 7 | Mobile today/yesterday visits uncapped | Up to 100, with `more: true` when there were more |
| 8 | Loading skeleton the wrong shape | Map and a side column of three cards |
| 9 | Overnight visits had no date or duration | `visitSpan`: "11:00 PM – 7:00 AM next day · 8 h" (or "…, 2 days later") |
| 10 | Export lacked when the current location was taken | `locatedAt` and `accuracyM` exported, plus the saved places |

Along the way: clearing a position (sharing off, device moved, plan downgrade) also clears its place.

**Open:** none known.

## 11. Suggestions

**Usefulness**

1. ~~Arrive and leave notices for saved places~~ Done 2026-10-07: **Notify when a child arrives / leaves** on each saved place (`Place.notifyArrive` / `notifyLeave`, migration `20261007140000_place_alerts`). `placeMove` in `src/lib/location.ts` decides; a fix within 50 m (or its accuracy) past the edge of the place the device was at keeps it there, so wobble isn't a leave. The device's first fix is never an arrival. INFO alerts with `resolveKey` `PLACE:<placeId>:ARRIVE|LEAVE`, emailed (`isPlaceNotice` in `worthEmail`) and pushed, action **View places** (mobile `VIEW_LOCATION`).
2. **Locate now**: ask a device for a fresh fix on its next sync (like a configuration check), for when the last
   one is old.
3. ~~Focus one child on the map~~ Done 2026-10-07: `/location?child=…`, used by the child tab's **Open map**.
4. ~~"Show on map" for a visit, and a day's trail~~ Done 2026-10-07: the **By day** view (§5); mobile `GET /children/{id}/location/visits?day=`.
5. The device's battery on the pin or in the list, so "Last seen 3 hours ago" can be explained.
6. Name a place by clicking the map, not only from where a child is or was.

**Quality**

7. A test for `clearCurrentLocations` on a downgrade, and one for the tile proxy (signed out 401, bad tile 404).
8. A page render test for `/location` and `/location/[childId]` (needs a page-level harness, as for the other pages).

## 12. Testing

| What | Where | Covered |
|---|---|---|
| `placeFor` (inside, outside, nearest of overlapping places), `stayed`, `durationLabel`, `visitSpan` (passing by, same day, next day); `childLocation` with the parent's setting (unreported → waiting, setting off or reported off → off), `waitingText`, 16 minutes still live, `locationPolicy` | `src/lib/test/location.test.ts` | yes |
| `childLocation`: live only when recent and syncing, newest fix across devices, waiting / off / no devices, off reported before any fix, approximate | `tests/api/verification.test.ts` | yes |
| Sharing follows the `LOCATION` report, off clears the position, fixes while off are dropped | `tests/api/verification.test.ts` | yes |
| One visit across a phone and a tablet at the same place; drive-by fixes are passing by; Recent places keeps only stays | `tests/api/verification.test.ts` | yes |
| Saved places: naming labels kept visits and current locations; a new fix inside is named (over the device's label); rename, resize and remove relabel; another family's place is a 404; bad name and radius refused | `tests/api/verification.test.ts` | yes |
| `visitsPage` pages newest first with no gaps or repeats | `tests/api/verification.test.ts` | yes |
| Mobile overview location: plan, newest fix, waiting vs off, no devices | `src/lib/test/mobile-views.test.ts` | yes |
| Mobile: current location with history off; visits once history is on; `/locations`; history off deletes visits; `/visits` paging; Free gets `403` | `tests/api/mobile-api.test.ts` | yes |
| Mobile places: create (`201`, bad radius `400`), the visit's `placeId`, `stayed` and `durationMinutes`, `more`, `places` in `/locations`, rename relabels, delete; another family gets `404` on `PATCH` and `DELETE` | `tests/api/mobile-api.test.ts` | yes |
| Moving a device clears its position and keeps its visits with the old child | `src/lib/test/devices.test.ts` | yes |
| Downgrade clearing, tile proxy | — | **no** (suggestion 7) |
| Page render | — | **no** (suggestion 8) |

**Last run (2026-10-04, after the fixes):** unit tests 222/222 (`npm test`), API suite 251/251 (`npm run test:api`,
with the settings in README › API tests, against a dev server started from PowerShell), type check clean, lint clean
on the changed files. The migration was applied locally. Nothing on these pages was opened or clicked in a browser:
the Saved places card, **Name this place**, the dashed circles on the map, "Passing by" rows and the skeleton are
checked by type and tests only.

**Manual checklist**

- [ ] Free plan: `/location` and a child's places show the upgrade note; the map isn't loaded.
- [ ] No children: "No children yet" and **Add child**.
- [ ] Child with no device: "No device paired yet", **Pair a device** preselects them.
- [ ] Phone sharing, fix 2 minutes old: pin with photo, "Live", accuracy circle.
- [ ] Same fix 18 minutes later: still "Live". At 21 minutes: "Last seen", pin faded.
- [ ] Device offline a day with a recent-looking fix: "Last seen", never "Live".
- [ ] Fix with 1.5 km accuracy: "(approximate)" and a large circle.
- [ ] Two children far apart: the map fits both; zoom in, wait 30 s: the zoom stays.
- [ ] Turn sharing off on the phone: "Sharing is off on *phone*", **Turn on** opens the flow, the pin disappears,
      a "Location sharing turned off" alert appears.
- [ ] Newly paired device before its first report: "Waiting for *device* to report whether location sharing is on."
- [ ] **Name Mia's place** under Mia: name "Home", 150 m → toast; the row, pin and Recent places say "Home"; a dashed
      circle appears on the map; the button is gone while she's there.
- [ ] Saved places: **Edit** to "Our house" → every label changes; **Remove** → confirm text, labels go back to
      "Unnamed place".
- [ ] History on: a drive with several fixes shows "Passing by" rows with one time, and Recent places skips them.
- [ ] A visit across midnight: "11:00 PM – 7:00 AM next day · 8 h".
- [ ] Phone and tablet both at home: one visit, not two.
- [ ] **Name this place** on a visit in a child's places: the visit and others there take the name.
- [ ] History off: no Recent places; the card says off; a child's places page shows the off state and the admin
      note for a non-admin parent.
- [ ] More than 50 visits: **Show older places**, then **Back to newest**; at the end "No older places".
- [ ] Turn history off: confirm dialog; every visit is gone.
- [ ] Remove a device without deleting history: its visits read "Removed device".
- [ ] Another family's child id in `/location/{id}`: 404, tab title doesn't name the child.
- [ ] Switch tabs away and back: the page refreshes once.
- [ ] Slow network (DevTools throttling): the skeleton has the map and a side column.
- [ ] Dark mode: saved-place circles are visible.
- [ ] Screen reader: the map's label names every child and where they are; Edit and Remove name the place.
- [ ] Network tab: tiles load from `/api/tiles/…`, never from the tile provider; signed out, `/api/tiles/1/0/0` is 401.
