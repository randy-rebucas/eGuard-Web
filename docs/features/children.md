# Children

Everything about one child: adding them, their protection health, screen time, apps, browser rules, location,
devices and the history of every change. Children are the centre of eGuard: protections, devices, browsers,
alerts and reports all belong to a child.

**Status:** Built and in use. Feature completeness **100%** of this review (see [§9](#9-completeness)). Written
2026-10-04, updated the same day after the fixes in [§10](#10-issues-found), web photos and tests.
**Routes:** `/children` (list), `/children/new` (add), `/children/[id]?tab=…` (profile, 8 tabs).
**Code:** `src/app/(app)/children/{page,new/page,[id]/page}.tsx`, `src/components/child-forms.tsx`,
`src/app/actions/family.ts` (server actions), `src/lib/family-service.ts` (rules), `src/lib/profiles.ts`
(starting protections), `src/lib/plan-access.ts` (app visibility), `src/lib/health.ts` (scoring).
**Mobile counterpart:** `/api/mobile/v1/children/**`, see [mobile-api.md](../mobile-api.md).
**Related:** [dashboard.md](dashboard.md) (scoring and statuses in full), [browser-extension-api.md](../browser-extension-api.md)
(Browser tab), [subscriptions.md](../subscriptions.md) (plan limits).

## Contents

1. [Pages at a glance](#1-pages-at-a-glance)
2. [Children list](#2-children-list)
3. [Adding a child](#3-adding-a-child)
4. [Child profile](#4-child-profile)
5. [The eight tabs](#5-the-eight-tabs)
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
/children                       /children/new                 /children/[id]
┌───────────────────────────┐   ┌─────────────────────────┐   ┌──────────────────────────────────────┐
│ Children      [Add child] │   │ Add a child             │   │ Children › Mia                       │
│ (plan-limit note)         │   │ Name                    │   │ ┌──────────────────────────────────┐ │
│ ┌─────┐ ┌─────┐ ┌─────┐   │   │ Birth year (≈ age)      │   │ │ (M) Mia · 11 years old  ◯ 8/10   │ │
│ │card │ │card │ │card │   │   │ Starting protections    │   │ │ Needs attention · Phone   2 to   │ │
│ └─────┘ └─────┘ └─────┘   │   │  ○ Protected (recomm.)  │   │ │                           review │ │
│ At a glance (table)       │   │  ○ Balanced             │   │ └──────────────────────────────────┘ │
│ Child│Health│Devices│…    │   │ [Add child]             │   │ Overview|Screen Time|Apps|Protection │
└───────────────────────────┘   └─────────────────────────┘   │ |Browser|Location|Devices|History    │
                                                              └──────────────────────────────────────┘
```

All three pages need a signed-in parent (`requireUser`) and only ever read the parent's own family.

## 2. Children list

`/children` shows every child as a `ChildCard` (avatar, age, status badge, primary device, extra devices and
browsers; see [dashboard.md §3.3](dashboard.md#33-your-children)), then an **At a glance** table:

| Column | Shows | Notes |
|---|---|---|
| Child | name, links to the profile | |
| Protection health | `score / 10`, plus ", *n* offline" | "No phone or tablet yet" with only browsers; "No devices yet" with nothing. Browsers aren't in this score: they report their own health |
| Devices | phones + tablets + browsers, e.g. "3 (1 browser)" | Disconnected browsers aren't counted, as on the Devices page |
| Screen time today | "1h 05m of 2h" | Amber with ", 25m over" past the limit; weekend limit on Sat–Sun |
| Location | Available / Waiting for first location / Sharing off / No device / Not on your plan | |

**Header button:** **Add child**, or **Upgrade to add more** (→ `/settings/subscription`) once the plan is full.
Full on the top plan (Family Pro, 10 children), there's no button and the note only explains ("Family Pro covers
10 children."), with no "See plans" link. `/children/new` does the same.
**Over the limit** (after moving to a smaller plan): a note says "You have 3 children, 2 more than Free covers.
They stay protected; to add more, remove some or upgrade." Nobody is removed.
**Empty:** "No children yet" with Add child.

## 3. Adding a child

`/children/new` → `createChild` action → `family-service.createChild`.

**Form:**

| Field | Rules |
|---|---|
| Name | required, trimmed, 1–40 characters; must not match another child in the family (any case) |
| Birth year | the last 18 years, shown as "2015 (about 11 years old)"; must make the child under 18 |
| Starting protections | **Protected** or **Balanced**; the recommended one follows the age until the parent picks (under 13 → Protected, 13+ → Balanced) |

**What the profiles set** (all 10 protections are always on, so neither lowers the health score):

| Protection | Protected (eGuard's age defaults) | Balanced |
|---|---|---|
| Screen time, weekdays | 2h (under 11), 3h (11–12), 3h 30m (13+) | +1h |
| Screen time, weekends | 4h (under 13), 4h 30m (13+) | +1h |
| Bedtime | 21:30–06:00 (under 13), 22:00–06:00 (13+), every night | starts 1h later |
| App / content rating | 4+ (under 9), 9+ (9–12), 13+ (13+) | one tier higher (4→9→13→16→18) |
| App approval, downloads approval, uninstall protection | on | on |
| Web | filtered | filtered |
| Location sharing, quiet notifications at bedtime | on | on |

**On save:**

1. Refreshes the family's purchases first, so a lapsed or refunded plan is reflected in the limit.
2. Takes a per-family lock, so two parents (or web and app) adding at once can't both pass the limit check.
3. Rejects the add if the plan is full, or the name is already used.
4. Creates the child with a colour (`hue`) and the 10 policies, and copies the screen-time limits onto the child.
5. Writes an audit entry, then redirects to `/children/[id]?added=1`.

The profile then shows "*Mia* is added with age-appropriate protections. Next, pair *Mia*'s phone or tablet…"
with **Pair a device**, until a device is paired.

**Plan full:** the page shows "Your plan is full" with the reason ("Free covers 1 child. Upgrade to eGuard Plus to
add up to 5.") instead of the form.

## 4. Child profile

`/children/[id]`. An unknown id, or a child from another family, gives 404. The page title is the child's name.

**Header:** avatar, name, age ("11 years old", "Under 1 year old"), status badge, primary device and OS, and a
protection **health ring** with one line:

| Condition | Line |
|---|---|
| no devices | "No devices to check yet" (ring empty) |
| verified | "All checks verified" |
| all passing, some offline | "*n* devices offline, last known state" |
| otherwise | "*n* to review" |

**See checks** links to the Protection tab.

**Tabs** are links (`?tab=overview|screen|apps|protection|browser|location|devices|history`); an unknown tab opens
Overview, and the old `?tab=activity` opens Screen Time. Each tab is rendered on the server.

## 5. The eight tabs

### 5.1 Overview (default)

| Card | Shows |
|---|---|
| **Needs your attention** | every check not passing, each with its status, detail and **Fix this** (opens the setup flow on that protection for this child). Otherwise "Everything is configured", "Nothing to fix right now" (offline), or "Pair a device first" |
| **Devices** | the same grid as the Devices tab, with **Pair a device** |
| **Profile** | photo (**Add photo** / **Change photo** / **Remove**), rename, change birth year; **Remove *Mia*…** for the family admin only |
| **Screen time today** | used / limit, bar (amber at ≥ 85%, red past the limit), "Limit reached" / "Over by *x*", top 5 apps + Others (Free: only apps the Apps tab shows), **Manage apps** |
| **Recent alerts** | this child's 4 most important open alerts, most severe first, then newest; **View all** → `/notifications?child=…` |

**Editing the profile:** a changed name is checked against the other children; a birth year that hasn't changed
isn't re-validated, so a child who has turned 18 can still be renamed. Saving never changes protections. When the
birth year changes, `ageReview()` compares eGuard's recommendation for the old and new age, and the confirmation
names the protections where the new recommendation differs from the child's current setting: "Saved. For a
13-year-old, eGuard recommends different Screen Time, Bedtime, App Restrictions and Content Restrictions settings
than Mia has now. Review them on the Protection tab." The parent changes them through the setup flow, so devices
verify them and History records them.

**Child photo:** any parent can add, change or remove it. The browser shrinks the chosen image to 512 px on its
longest side and re-encodes it as JPEG before uploading, so a large phone photo fits the 2 MB limit and its
location metadata (EXIF) is dropped. It then shows wherever the child's avatar does: cards, the dashboard, the
profile header, charts, the activity panel, the location map and lists, Settings, Devices and the setup dialog. The
mobile app uses the same photo. Without one, or with a HEIC photo from the iPhone app (most browsers can't draw
HEIC), the avatar shows the child's initial on their colour.

| Route | Who | Does |
|---|---|---|
| `GET /api/children/{id}/photo?v=…` | signed-in parent of the family (session cookie) | serves the image; `private`, cached for a year (the `v` changes with each upload) |
| `PUT /api/children/{id}/photo` | same; not from another site (`Sec-Fetch-Site: cross-site` → 403) | raw JPEG, PNG or WebP body, up to 2 MB, checked by its bytes; returns `{ photo }` |
| `DELETE /api/children/{id}/photo` | same | removes it |

Another family's child is a 404. The rules (`PHOTO_TYPES`, size, magic-byte check, URL) live in
`src/lib/child-photo.ts`, shared with the mobile route (`/api/mobile/v1/children/{id}/photo`, which also takes
HEIC). Only the photo's version and type are loaded with the family; never the image itself.

**Removing a child** (family admin only): asks for the admin's password, or typing DELETE for accounts without one
(Apple/Google sign-in). It deletes the child's activity, history, devices and unused pairing codes, writes an
audit entry, and raises a "Child removed" alert so the other parents know verification has stopped. Protections
already on the devices stay but are no longer managed.

### 5.2 Screen Time

- **Screen Time, Last 7 Days:** one large chart: bars for this week, ticks for last week, dashed daily limit,
  average and change vs last week, and a table view (see [dashboard.md §3.6](dashboard.md#36-weekly-screen-time-trend-streamed)).
- **Limits:** weekdays (Mon–Fri), weekends (Sat–Sun), bedtime, and **Change limits** (setup flow on Screen
  Time). "Weekdays", not "school days": bedtime's "school nights" are Sunday–Thursday.

### 5.3 Apps

Every app the child's devices have reported, sorted: waiting for approval, blocked, filtered, always allowed,
allowed, then by name.

| Element | Behaviour |
|---|---|
| Header | "New apps need your approval…" with an **App approval on** pill, or **Turn on approval** |
| Waiting banner | "*n* apps waiting for your approval", in amber (it asks for action; green is for confirmations) |
| App row | name, access, "Asked again" (a blocked app the child requested), minutes today, its daily limit |
| Waiting app | **Approve** (→ Allowed) / **Decline** (→ Blocked) |
| Other app | access select (Allowed, Always allowed, Filtered, Blocked) and a daily limit in minutes (0–1440, empty = none) |
| Free plan | 5 apps shown: every app waiting for approval first, then the most used today; "*n* more apps not shown" + upgrade note |

Each change is saved immediately, shown at once in the row, rolled back with an error toast if it fails, logged in
History as "*App* set to Blocked · applies on next sync", and resolves the app's open request alert. Limits are
rounded to whole minutes, capped at 1440, and 0 means no limit.

### 5.4 Protection

The 10 checks for this child (see [dashboard.md §4](dashboard.md#4-how-protection-is-measured)). Each row shows the
check, its status badge, the parent's setting ("9:30 PM – 6:00 AM"), the device detail ("Verified on 2 of 2
devices"), and what each platform supports (Android: Available; iOS: Guided setup, Verification only or
Unsupported). Clicking a row opens the **setup flow**: select protection → review current → choose new → apply to
device → verify → health updated. With no device paired, a banner explains the settings apply once one is.

### 5.5 Browser

Rules for the eGuard browser extension, shared by all of the child's browsers (Chrome, Edge, Firefox):

- **Browser protection** form: Safe Browsing, SafeSearch, blocked categories, blocked and allowed sites, what to do
  with unknown sites (allow, warn, block), and a schedule.
- **Access requests:** sites the child asked to open, with approve (for a duration) or decline; **Allowed for now**
  and **Recently answered** lists.
- **Browsers:** each browser's status pill and last check-in, and **Add a browser**. The status comes from
  `browserStatus()`, the same as the browser cards on Devices and the dashboard (Protected, Needs attention,
  Action required, Sync paused, Not supported, Not seen for a day, Disconnected for security, Connected).
  Browsers apply changes within 5 minutes.
- **Current settings:** policy version, who changed it and when, and a summary.

Details: [browser-extension-api.md](../browser-extension-api.md).

### 5.6 Location

| State | Shows |
|---|---|
| Not on plan (Free) | upgrade note |
| No devices | "No device to locate" + Pair a device |
| Located | place label (or "Current location"), "(approximate)" when accuracy is worse than 200 m, which device and when; **Open map** |
| Waiting | "Waiting for location" (sharing on, no fix yet) |
| Sharing off | names the device where sharing is off; **Turn on location sharing** (setup flow) |

The location comes from the newest fix among the child's devices that share. A footer says whether location
history is on (kept for the family's retention days, link to the child's places) or off (latest location only,
link to Privacy settings).

### 5.7 Devices

Phones and tablets (`DeviceCard`), then browsers (`BrowserCard`, with **Remove**). Empty: "No devices yet" with
Pair a device.

### 5.8 History

Every change to the child's protections, apps and browser settings: what changed, from → to, who and where
("Randy on web · applies on next sync"), and when. Protection changes are logged once a device confirms them;
app and browser changes when they're made. 50 at a time, newest first, with **Show older changes** /
**Back to newest**. Kept for the family's retention period.

## 6. Rules and limits

| Rule | Where |
|---|---|
| Child limit per plan: Free 1, Plus 5, Pro 10 | `childLimitReached` |
| Families over the limit keep their children; they just can't add more | `childLimitReached` |
| Name 1–40 characters, unique in the family (any case) | `ChildSchema`, `createChild`, `assertNameFree` |
| Under 18 (birth year within the last 18 years) | `ChildSchema` |
| Only the family admin removes a child, with password or DELETE | `deleteChild` |
| Any parent can rename, change age, manage apps and protections | actions in `family.ts` |
| App limit 0–1440 minutes, whole minutes, 0 = none | `setAppLimit` |
| Free shows 5 apps; waiting apps always shown | `visibleApps` |
| Every server action re-checks the id belongs to the family | `appFor`, `findFirst({ familyId })` |
| Days, weekends and "today" use the family's timezone | `dayKey`, `limitOn` |

## 7. Status reference

**Child status** (badge on cards, header, hero): **Protected** (has devices, all checks verified, all online) ·
**Needs attention** (a check failing or a device offline) · **Not configured** (no phone or tablet).

**App access:**

| Value | Label | Meaning on the device |
|---|---|---|
| `PENDING` | Waiting for your approval | installed or requested, not usable yet |
| `ALLOWED` | Allowed | usable within screen time |
| `ALWAYS_ALLOWED` | Always allowed | usable even when screen time runs out |
| `FILTERED` | Filtered | usable with content filtering |
| `BLOCKED` | Blocked | not usable; "Asked again" when the child requests it |

**Check statuses, device states, alert severities, location states:** as in
[dashboard.md §5](dashboard.md#5-status-reference).

## 8. Web vs mobile

| | Web | Mobile app |
|---|---|---|
| Add child | name, birth year, Protected / Balanced | same, plus **Custom** (review each setting before saving) and a recommendations step |
| Child photo | add, change, remove; JPEG/PNG/WebP (resized in the browser) | add, change, remove; also HEIC (shown as initials on the web) |
| Tabs | 8 tabs | separate screens: overview, screen time (today, 7 and 30 days, hourly), apps, protections, browser, location, history |
| Screen time history | last 7 days | 7 and 30 days |

## 9. Completeness

| Area | Status | Notes |
|---|---|---|
| List with status and at-a-glance table | Done | |
| Add child with age-based profiles | Done | Race-safe limit, duplicate names caught |
| Plan limits and over-limit families | Done | No upgrade offered on the top plan |
| Profile header and health ring | Done | |
| Overview: what needs attention, with fixes | Done | |
| Edit profile | Done | A new age names the protections to review |
| Remove child | Done | Admin only, confirmed, other parents alerted |
| Screen time tab | Done | |
| Apps: approve, block, limits | Done | No search or filter for long lists |
| Plan-limited app visibility | Done | Tested |
| Protection tab and setup flow | Done | |
| Browser tab | Done | Browser status shared with Devices and the dashboard |
| Location tab | Done | |
| Devices tab | Done | |
| History with paging | Done | |
| Consistency with the dashboard | Done | Same alert order, over-limit bar and browser wording |
| Child photos on web | Done | Upload, show everywhere, remove; shared with the app |
| Tests for web actions and photos | Done | Unit tests for all five child actions and the photo rules; end-to-end check of the photo route |

**Overall: 100%** of what this review set out (18 of 18). Was ~78% at the first review and ~89% after the first
fixes, both on 2026-10-04. The suggestions below are improvements, not gaps. Page rendering still has no automated
test (suggestion 5).

## 10. Issues found

All seven issues from the first review were fixed on 2026-10-04:

| # | Issue | Fix |
|---|---|---|
| 1 | Full on Family Pro, the list still offered "Upgrade to add more" | No button; `UpgradeNote` takes `plans={false}` and drops "See plans" when `nextPlan()` is null (list and `/children/new`) |
| 2 | Overview alerts newest first | `getAlerts(…, { bySeverity: true })`, as on the dashboard |
| 3 | Browser tab wrote its own browser status | Uses `browserStatus()` with the same status pill as the browser cards |
| 4 | Over the limit, the Overview bar stayed amber | Red bar, "Over by *x*" / "Limit reached", `aria-valuetext`, as on the dashboard |
| 5 | "School days" for a Monday–Friday limit | "Weekdays" |
| 6 | Waiting-apps banner in success green | New amber `.form-warn` style |
| 7 | A new age kept old settings without a word | `ageReview()` in `src/lib/profiles.ts`; the save message names the protections to review |

**Open:** none known.

## 11. Suggestions

**Usefulness**

1. Apps tab: search and filters (waiting, blocked, with limits), and bulk approve/decline for long lists.
2. Overview: a one-line "today" summary at the top (screen time left, bedtime tonight, location), the three things
   parents check most.
3. History: filter by type (protections, apps, browser) and by who made the change; log photo changes there too.
4. After an age change, a **Review** button that opens the setup flow on the first protection `ageReview()`
   names, instead of only pointing to the Protection tab.

**Quality**

5. One render test of the profile page per tab (needs a test database or a page-level harness).
6. Share one "app list" component and ordering between web and mobile, so "Asked again" and plan visibility can't
   drift.
7. Convert HEIC photos from the app to JPEG on upload, so they show on the web too.

## 12. Testing

| What | Where | Covered |
|---|---|---|
| Name and birth-year rules | `src/lib/test/child-schema.test.ts` | yes |
| Profiles, recommendations and the age-change review | `src/lib/test/profiles.test.ts` | yes |
| App limits (rounding, cap) | `src/lib/test/app-limit.test.ts` | yes |
| Plan app visibility and naming | `src/lib/test/plan-access.test.ts` | yes |
| Child health and status | `src/lib/test/health.test.ts` | yes |
| Add, rename, apps, delete via the mobile API | `tests/api/mobile-api.test.ts` | yes (needs the test server settings, see [dashboard.md §12](dashboard.md#12-testing)) |
| App requests and approvals | `tests/api/verification.test.ts`, `tests/api/security.test.ts` | yes |
| Web child actions: form rules, family scoping, age review message, delete confirmation, app settings | `src/app/actions/family.test.ts` | yes |
| Photo rules: types, magic bytes, empty, versioned URL, HEIC fallback | `src/lib/test/child-photo.test.ts` | yes |
| Photo route end to end (upload, serve, refuse HEIC/fakes/oversize/cross-site, other family 404, remove) | run by hand against the dev server, 15/15 | not in CI (could move into `tests/api/`) |
| Page render per tab | — | **no** (suggestion 5) |

**Last run (2026-10-04):** unit tests 167/167 (`npm test`), API suite 235/235 (`npm run test:api`, with the
settings in README › API tests), type check and lint clean. The photo upload button was not clicked in a real
browser: the in-browser resize (`createImageBitmap` + canvas) is untested.

**Manual checklist**

- [ ] Free family with one child: header shows **Upgrade to add more**; `/children/new` shows "Your plan is full".
- [ ] Family Pro with 10 children: no header button; the note has no "See plans"; `/children/new` has no See plans.
- [ ] Change a 12-year-old's birth year to make them 13: the save message names Screen Time, Bedtime, App
      Restrictions and Content Restrictions. Change it within the same band (9 → 10): just "Saved."
- [ ] Screen time over the limit on the Overview: red bar, "Over by *x*".
- [ ] A critical alert older than four info alerts: still in the Overview's Recent alerts.
- [ ] Browser tab: a browser silent for a day reads "Not seen for a day", as on Devices.
- [ ] Profile › **Add photo** with a large phone photo: uploads, shows on the card, dashboard, map pin and in the
      app; **Remove** brings back the initial. A HEIC file in Chrome: "eGuard can't read that file…".
- [ ] Upload button reachable by keyboard (Tab shows a focus ring on it; Space opens the picker).
- [ ] Add a 10-year-old: Protected is recommended; switching the year to 14 switches the recommendation to Balanced.
- [ ] Add a second child with the same name (any case): refused with the nickname hint.
- [ ] After adding: lands on the profile with the "Pair a device" banner.
- [ ] Overview of a child with a failing check: **Fix this** opens the setup flow on that protection.
- [ ] Rename and change birth year: saved, other children unaffected; History unchanged (profile edits aren't
      protection changes).
- [ ] Apps: approve a waiting app → Allowed, row updates, History entry, request alert resolved.
- [ ] Set an app limit of 20.4 → saved as 20; 0 → no limit; 2000 → error toast.
- [ ] Free plan with 8 apps: 5 shown, waiting apps first, "3 more apps not shown".
- [ ] Location on Free: upgrade note. On Plus with sharing off on the phone: names the phone.
- [ ] History: more than 50 changes → **Show older changes** pages back; **Back to newest** returns.
- [ ] Remove a child as a non-admin parent: only the explanation shows. As admin: wrong password refused; correct
      one removes the child, redirects to `/children`, other parents get "Child removed".
- [ ] Open `/children/<another family's child id>`: 404.
