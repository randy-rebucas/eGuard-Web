# Dashboard

The parent's home page on the web (`/dashboard`): one screen that answers "is my family protected right now, and
what needs me?" It summarises children, devices, protection health, today's activity, the week's screen time,
recent alerts and the plan, and links into every other feature.

**Status:** Built and in use. Feature completeness **~89%** (see [§9](#9-completeness)). Last updated 2026-10-04,
after the fixes in [§10](#10-issues-found).
**Code:** `src/app/(app)/dashboard/page.tsx` (page), `src/lib/health.ts` (scoring), `src/lib/queries.ts`
(`getFamilyGraph`), `src/lib/views.ts` (activity, weekly series, alert rows), `src/components/{cards,charts,alerts,flow,ui,boundary}.tsx`.
**Mobile counterpart:** `GET /api/mobile/v1/dashboard` (`src/app/api/mobile/v1/dashboard/route.ts`), see [mobile-api.md](../mobile-api.md).
**Related:** [subscriptions.md](../subscriptions.md) (plans and entitlements), [child-app-spec.md](../child-app-spec.md) (what devices report).

## Contents

1. [Layout at a glance](#1-layout-at-a-glance)
2. [Page states](#2-page-states)
3. [Sections and what they do](#3-sections-and-what-they-do)
4. [How protection is measured](#4-how-protection-is-measured)
5. [Status reference](#5-status-reference)
6. [Data loading, freshness and failure](#6-data-loading-freshness-and-failure)
7. [Plan gating](#7-plan-gating)
8. [Web vs mobile](#8-web-vs-mobile)
9. [Completeness](#9-completeness)
10. [Issues found](#10-issues-found)
11. [Suggestions](#11-suggestions)
12. [Testing](#12-testing)

---

## 1. Layout at a glance

```
┌──────────────────────────────────────────────────────────────┬───────────────────┐
│ HERO  greeting · first name · status sentence                │ Current status    │
│       [n children protected] [n devices connected] [action]  │ (up to 4 children)│
├──────────────┬──────────────┬──────────────┬─────────────────┴───────────────────┤
│ Family       │ Children     │ Devices      │ Active Plan                         │
│ Protection   │              │              │                                     │
├──────────────┴──────────────┴──────────────┴──────────────┬──────────────────────┤
│ Your Children (child cards)                               │ Recent Alerts (4)    │
│ Today's Activity  [Screen Time|App Usage|Location|Status] │ Quick Actions        │
│ Device Protection Status (device + browser cards)         │ Promo                │
│ Weekly Screen Time Trend (small multiples / table)        │                      │
└───────────────────────────────────────────────────────────┴──────────────────────┘
```

The page sits inside the app shell (`src/app/(app)/layout.tsx`), which also renders the sidebar, the top header
with the unread-alert badge, and the verify-email banner.

## 2. Page states

The page has two layouts and, inside the full layout, five hero states.

### 2.1 No children (onboarding)

Shown when the family has no children. Only the hero ("Let's set up your family. Start by adding your first child.")
and an empty state with an **Add child** button (`/children/new`). Nothing else is rendered, so no metrics show zeros.

### 2.2 Full dashboard

Rendered once there is at least one child. The hero sentence comes from `familySummary()` in `src/lib/health.ts`
(first match wins):

| # | Condition | Hero sentence |
|---|---|---|
| 1 | No phone or tablet paired in the family | "Your family is almost set. Pair a device to start protecting them." |
| 2a | Failing checks, and any is `ACTION_REQUIRED` | "Your family's digital safety needs your attention." |
| 2b | Failing checks, score ≥ total − 2, every device online, every child paired | "Your family's digital safety looks good today." |
| 2c | Failing checks, otherwise | "Your family's digital safety needs a little attention." |
| 3 | No failing checks, some children have no device | "Every paired device is verified / set, as last reported." + "*Name* has no paired device yet." |
| 4 | No failing checks, all devices online | "Every protection is verified. Your family is set." |
| 5 | No failing checks, some devices offline | "Every protection matched when devices last synced. *n* devices are offline, so we can't verify them now." |

"Failing checks" (`issues`) = Family Protection checks whose status is not `PASS` or `UNSUPPORTED` (always 0 when
nothing is paired). The hero never says "looks good" while a device is offline, a child has no device, or a
protection is turned off.

Action chips, shown side by side when both apply:

| Chip | When | Links to |
|---|---|---|
| **Pair a device** | nothing paired | `/devices#pair` |
| ***n* settings need attention** | failing checks | `/protection` |
| **Pair *Name*'s device** / **Pair a device** | some children have no phone or tablet | `/devices?child=…#pair` |

## 3. Sections and what they do

### 3.1 Hero

| Element | Source | Behaviour |
|---|---|---|
| Greeting | `greeting(tz)` | Good morning / afternoon / evening in the **family's** timezone, not the browser's |
| Name | first word of `user.name` | Falls back to "there" |
| "n children protected" | children with `status === "protected"` | A child is protected only when **every** check passes on **all** their devices and all are online |
| "n devices connected, m offline" | phones + tablets + non-revoked browsers | Offline = no sync for 24 h (`OFFLINE_AFTER_MS`), browsers included |
| Current status card | first 4 children (`HERO_CHILDREN`) | Avatar, primary device name, status pill; "+n more" links to `/children` |
| "Synced …" | newest `lastSeenAt` across phones, tablets and connected browsers | "Not synced yet" when none has synced |

### 3.2 Metric cards

| Card | Value | Visual | Footer | Links to |
|---|---|---|---|---|
| **Family Protection** | `score / total` (e.g. 8 / 10); "– / 10" when nothing is paired | 10-segment meter, one segment per protection | Status pill (see [§5.4](#54-family-protection-pill)) | `/protection` |
| **Children** | number of children | Avatar group (max 6, then "+n") | "View children" | `/children` |
| **Devices** | phones + tablets + browsers (as the plan's device limit counts them) | Up to 8 device icons (`METRIC_DEVICES`), then "+n" | "Pair a device" / "*n* need attention" / "All healthy" | `/devices` (or `#pair`) |
| **Active Plan** | plan name | "Up to *n* children · *m* devices" | "Renews/Ends *date*", or "Upgrade to *next plan*", or "No renewal date" | `/settings/subscription` |

"Need attention" on the Devices card counts phones/tablets whose state is `issues` **or** `offline`, plus browsers
for which `browserNeedsAttention()` is true: disconnected for security, not seen for a day, or reporting
Needs attention / Action required / Sync paused / Not supported.

### 3.3 Your Children

One `ChildCard` per child (all children, no cap): avatar, age, status badge, primary device and OS version,
"+n more" devices, and connected browsers. A browser-only child reads "*n* browser · pair a phone or tablet",
because a browser covers websites only. Each card links to `/children/[id]`.

### 3.4 Today's Activity (streamed)

A tabbed panel (WAI-ARIA tabs: arrow keys, Home, End) with one tile per child, for **today in the family's
timezone**.

| Tab | Shows | Notes |
|---|---|---|
| **Screen Time** | minutes used / today's limit, progress bar, top 3 apps + "Others" | Weekend limit applies Sat–Sun (`limitOn`). Bar turns amber at ≥ 85%. At the limit: "Limit reached". Past it: red bar and "Over by *x*" (the bar itself stops at 100%) |
| **App Usage** | per-app minutes with relative bars | On Free, only the apps the child's Apps tab may name (`nameableApps`, 5-app limit); the rest are folded into "Others" |
| **Location** | last place and "Updated *x* ago" | States: available, waiting, off, no device, not on plan (see [§5.6](#56-location-states)) |
| **Device Status** | each device: Healthy / Offline / *n* issues; each browser with its status pill | |

The panel's date and the weekly chart's "Last 7 days" are plain text, not controls.

### 3.5 Device Protection Status

A grid of `DeviceCard`s, one per phone/tablet: platform chip, name, child, OS, status badge and last sync.
A device that has never reported any protection shows **"Waiting for first check"** instead of "10 issues".
Every browser extension follows as a `BrowserStatusCard` (including one disconnected for security), with the
same status as on the Devices page and a link to the child's Browser tab. Removing a browser stays on the Devices
page. With no devices and no browsers, an empty state explains how to install eGuard from Google Play and pair
with a code.

### 3.6 Weekly Screen Time Trend (streamed)

Small multiples, one chart per child, for the **last 7 days ending today**:

- **Bars**: this week's daily minutes (today drawn faded, "so far").
- **Tick**: same weekday last week.
- **Dashed line**: that day's limit (steps between weekday and weekend limits).
- **Insight line**: "Averaging *h m* a day, *x%* less/more than last week". The average uses the **6 complete
  days** and leaves today out, so a half-finished day doesn't drag it down.
- Hover tooltip per day; a **Table** toggle shows the same numbers as an accessible table.

### 3.7 Recent Alerts (streamed)

The 4 most important **unresolved** alerts: most severe first (Critical, Action required, Attention, Info), then
newest (`getAlerts(…, { bySeverity: true })`), so a critical alert is never pushed out by newer info. Each row shows icon tile coloured by severity,
title, subject, relative time and an unread dot. Clicking runs the alert's action (`alertAction`): open the setup
flow for a protection, the device page, the app or website request, or the plan page. Empty: "You're all caught up".

### 3.8 Quick Actions

| Action | What it does |
|---|---|
| **Run Configuration Check** (or **Pair a Device** when nothing is paired) | Opens the check dialog: asks every device to report now, polls `/api/checks/[id]` every 0.9 s, shows per-device results, times out unreachable devices after 12 s, then refreshes the page |
| **Set Screen Time Limits** | Opens the configuration flow on Screen Time; parent picks the child |
| **Manage Apps** | Configuration flow on App Restrictions |
| **Set Bedtime Schedule** | Configuration flow on Bedtime |
| **View Location** | `/location`; shows a plan badge (e.g. "eGuard Plus") when location isn't included |

Dialog code is lazy-loaded and preloaded on hover/focus, so it doesn't weigh on the first page load.

### 3.9 Promo

Static brand panel: "A Safer Digital World for Their Brighter Tomorrow". No interaction.

## 4. How protection is measured

The **Family Protection** score is a **configuration** measure, not a behaviour score: it says whether the
settings the parent asked for are actually in place on the devices. It does not measure how safely a child
behaves.

### 4.1 The ten checks

One check per protection in `PROTECTIONS` (`src/lib/protections.ts`):

| # | Check | Android | iOS |
|---|---|---|---|
| 1 | Screen Time | Available | Available |
| 2 | Bedtime | Available | Available |
| 3 | App Restrictions | Available | Available |
| 4 | App Approval | Available | Available |
| 5 | Content Restrictions | Available | Available |
| 6 | Web Filtering | Available | Guided setup |
| 7 | Downloads | Available | Verification only |
| 8 | Location | Available | Guided setup |
| 9 | Notification Controls | Available | **Unsupported** (not counted) |
| 10 | Uninstall Protection | Available | Available |

### 4.2 Per device: `evaluate()`

For each device and protection, the child's **policy** (what the parent set) is compared with what the device
**reported** on its last sync:

```
capability is UNSUPPORTED                       → UNSUPPORTED
no policy for it, device reports it on          → PASS
no policy for it, device reports it off         → NOT_CONFIGURED
parent turned it off (whatever the device says) → PASS   (the parent's choice, not something to fix)
policy == reported (key-order independent; Web compares mode only) → PASS
Uninstall Protection / App Approval switched off on device → ACTION_REQUIRED
anything else that differs                      → WARNING
nothing reported for this protection            → NOT_CONFIGURED
```

### 4.3 Per family: `computeHealth()`

1. For each of the 10 checks, take the **worst** status across all devices
   (`ACTION_REQUIRED > WARNING > NOT_CONFIGURED > PASS > UNSUPPORTED`). One failing device fails the check for
   the whole family.
2. **score** = number of checks that are `PASS` or `UNSUPPORTED`. **total** = 10.
3. **offline** = devices with no sync in 24 h (or never synced). An offline device still counts with its **last
   known** state, so the score doesn't collapse when a tablet sits in a drawer.
4. **verified** = at least one device, score = total, and offline = 0. This is the only state allowed to say
   "verified" or "protected".
5. Each check carries a `detail` line ("Verified on 2 of 3 devices; 1 offline, last known state",
   "Turned off on Mia's Tablet and 1 more") and the first failing device/child, so the Protection page can link
   straight to the fix.

The same function runs per child (`getFamilyGraph`), which gives each child their own score and status.

### 4.4 Worked example

Two devices. The phone passes everything. The tablet reports Bedtime differently from the policy (WARNING) and
has Uninstall Protection off (ACTION_REQUIRED). Both are online.

- Bedtime → WARNING, Uninstall Protection → ACTION_REQUIRED, other 8 → PASS.
- Score **8 / 10**, verified = false. Hero: "Your family's digital safety needs your attention." (a protection is
  turned off, so not "looks good" even though 8 ≥ 10 − 2), chip "2 settings need attention". Pill:
  **Good protection**. Child with the tablet: **Needs attention**.

## 5. Status reference

### 5.1 Check status (per protection)

| Status | Label | Tone | Counts as passing |
|---|---|---|---|
| `PASS` | Pass / Verified | green | yes |
| `WARNING` | Warning / Needs review | amber | no |
| `ACTION_REQUIRED` | Action required / Turned off | red | no |
| `NOT_CONFIGURED` | Not configured | grey | no |
| `UNSUPPORTED` | Unsupported | grey | yes (not counted against) |

### 5.2 Child status

| Status | Rule | Badge |
|---|---|---|
| `protected` | has devices and `verified` | green "Protected" |
| `attention` | has devices, not verified (a failing check **or** any device offline) | amber "Needs attention" |
| `notconfigured` | no phone or tablet | grey "Not configured" |

### 5.3 Device state

| State | Rule | Badge |
|---|---|---|
| `healthy` | online and every protection passing | green "Healthy" |
| `issues` | online, *n* protections not passing (unreported ones count) | amber "*n* issues" |
| `offline` | no sync in 24 h | grey "Offline" (plus issues if any) |
| *(first check)* | no protections reported yet | grey "Waiting for first check" |

### 5.4 Family Protection pill

`healthBadge()` in `src/lib/health.ts`. The label comes from `healthLabel()`, the same function the mobile API
uses, so web and app always agree.

| Condition | Label | Tone |
|---|---|---|
| nothing paired | "No devices yet" | grey |
| score = total, all online | "Fully protected" | green |
| score = total, some offline | "Last known: all set" | green |
| score ≥ total − 2 | "Good protection" | green at total − 1, blue at total − 2 |
| score ≥ total / 2 | "Needs attention" | amber |
| otherwise | "Action required" | red |

### 5.5 Alert severity

`INFO` (blue), `ATTENTION` (amber), `ACTION_REQUIRED` (red), `CRITICAL` (red, siren icon).
An alert with a `resolveKey` clears itself when the problem is fixed; Info and notices without one can be
dismissed by the parent. Offline alerts ("Device hasn't synced in over a day") are raised on page load by
`ensureOfflineAlerts` in the app layout.

### 5.6 Location states

| State | Shown |
|---|---|
| available | place label (or "Location available") and "Updated *x* ago" |
| waiting | "Waiting for location" (sharing on, no fix yet) |
| off | "Location unavailable" (sharing off) |
| nodevice | "No device yet" |
| plan | "Not on your plan" + See plans |

### 5.7 Configuration check (dialog)

Per device: Checking… → **All verified** / **n to review** / **Couldn't reach** (no report within 12 s).

## 6. Data loading, freshness and failure

- **Auth:** `requireUser()`; every query is scoped to `user.familyId`.
- **First paint:** family, family graph, current purchase and browsers load in parallel. `getFamily` and
  `getFamilyGraph` are `cache()`d per request, so they reuse what the layout already loaded.
- **Upkeep before reading:** the layout runs simulated heartbeats (`touchSimulated`) and raises missing offline
  alerts before the graph and unread count are read.
- **Streaming:** Today's Activity, Weekly Screen Time and Recent Alerts each sit in `Suspense` with a sized
  skeleton, so the summary appears first.
- **Isolation:** each streamed section has its own `SectionBoundary`. If one fails, it shows "*Section* couldn't
  load · Retry" and the rest of the page keeps working. A whole-page failure uses `error.tsx` with a reference
  digest; production never shows raw server messages.
- **Freshness:** server-rendered per request (`instant = false`). Data updates on navigation, on
  `router.refresh()` after a configuration check, and after actions. **There is no automatic polling** while the
  page stays open.
- **Time:** all "today", day boundaries, weekends and timestamps use `family.timezone`.

## 7. Plan gating

| Entitlement | Free | Plus | Pro | Effect on the dashboard |
|---|---|---|---|---|
| `childLimit` | 1 | 5 | 10 | Active Plan card text |
| `deviceLimit` | 2 | 10 | 20 | Active Plan card text (from `family.deviceLimit`) |
| `locationSharing` | no | yes | yes | Location tab shows "Not on your plan"; View Location shows a plan badge |
| `appMonitoringLimit` | 5 apps | all | all | App names beyond the limit are folded into "Others" |

## 8. Web vs mobile

`GET /api/mobile/v1/dashboard` serves the app's Home tab from the same `getFamilyGraph` and `familyHealth`, so
the score and its label (`healthLabel`) are identical. The summary sentence still differs:

| | Web | Mobile |
|---|---|---|
| Summary | hero states ([§2.2](#22-full-dashboard)) | "n children need attention" / "Pair *Name*'s device…" / "looks good today" |
| Score label | `healthLabel` ([§5.4](#54-family-protection-pill)) | `healthLabel` |
| Recent alerts | 4, most severe first | 3, newest first, plus unread count |
| Activity, weekly chart, quick actions | yes | separate endpoints |

## 9. Completeness

Scored against what a parent needs from a home dashboard. **Done** = built and correct, **Partial** = built with a
gap, **Missing** = not built.

| Area | Status | Notes |
|---|---|---|
| Onboarding (no children) | Done | Clear single next step |
| Unpaired / partially paired guidance | Done | Pair chip shows even when settings also need attention |
| Family Protection score | Done | Well defined, tested in `health.test.ts`, offline-aware |
| Per-child status | Done | |
| Device status and first-check state | Done | |
| Browser extensions on the dashboard | Done | In the device grid, Device Status tab, "need attention" and "Synced" |
| Today's activity | Done | Plan-aware app naming |
| Over-limit signalling | Done | "Limit reached", "Over by *x*", red bar |
| Weekly trend | Done | Chart + table, limits, insight |
| Alerts | Done | Actionable rows, most severe first |
| Quick actions | Done | |
| Plan summary | Done | |
| Error isolation and loading states | Done | |
| Accessibility | Done | Tabs pattern, labelled cards, table alternative, progress bars with value text |
| Hero and score logic tests | Done | `familySummary`, `healthBadge`, `healthLabel`, `browserNeedsAttention` |
| Date range | Partial | Shown honestly as text; no way to pick 14 or 30 days |
| Web/mobile consistency | Partial | Same score and label; the summary sentence still differs |
| Live freshness | Missing | No auto-refresh while open |

**Overall: ~89%** (15 done, 2 partial counted as half, 1 missing, of 18 → 16 / 18). Was ~75% before the fixes
of 2026-10-04.

## 10. Issues found

All seven issues from the first review were fixed on 2026-10-04:

| # | Issue | Fix |
|---|---|---|
| 1 | A child with no device was hidden when settings also needed attention | Hero shows both chips; "looks good" needs every child paired |
| 2 | "Looks good today" while devices were offline or a protection was turned off | `familySummary()`: "needs your attention" for `ACTION_REQUIRED`, "needs a little attention" while anything is offline or unpaired |
| 3 | Browsers counted in totals but missing elsewhere | `BrowserStatusCard` in the grid, browsers in Device Status, `browserNeedsAttention()` in the Devices card, browsers in "Synced" |
| 4 | Web and mobile labelled the score differently | Web pill uses the mobile `healthLabel()` (moved to `health.ts`) via `healthBadge()` |
| 5 | "Last 7 days" and the date chip looked like controls | Plain `.date-chip` text |
| 6 | No over-limit state | "Limit reached" / "Over by *x*", red bar, `aria-valuetext` |
| 7 | Critical alerts could be pushed out by newer info | `getAlerts(…, { bySeverity: true })` |

**Open:**

- The sidebar's attention badge (app layout) still counts phones and tablets only. Counting browsers there would
  add a browser query to every page.
- The mobile Home tab's recent alerts are still newest first.

## 11. Suggestions

**Usefulness**

1. Make the date range selectable (7 / 14 / 30 days, 30 gated to `advancedReports`).
2. Replace the static promo with a contextual tip: the next most valuable setting to turn on, an unused plan
   feature, or "Pair *Name*'s tablet".
3. Add a "What changed since your last visit" line (new alerts, checks that went from Pass to Warning).
4. Use `familySummary()` for the mobile summary sentence too, so web and app say the same thing.

**Freshness and performance**

5. Refresh the summary on window focus and every 60 s while visible (`router.refresh()` behind
   `document.visibilityState`), so an open dashboard doesn't go stale.
6. `todayActivity` calls `nameableApps` once per child; batch it into one query for families with many children.

**Quality**

7. Add one end-to-end test that loads the dashboard for the seed family and checks the score and hero text.

## 12. Testing

| What | Where | Covered |
|---|---|---|
| `evaluate`, `computeHealth`, `deviceState`, offline rules | `src/lib/test/health.test.ts` | yes |
| Hero sentence, score label and tone, browser attention | `src/lib/test/health.test.ts` | yes |
| Mobile dashboard response | `tests/api/mobile-api.test.ts` | yes |
| Plan gating of apps | `src/lib/test/plan-access.test.ts` | yes |
| Page render | — | **no** (suggestion 7) |

**Last run (2026-10-04):** unit tests 167/167 (`npm test`), API suite 235/235 (`npm run test:api`), type check
and lint clean. The API suite needs the settings in README › API tests: the rate-limit allowlist, the cron secret
on both sides, and mail sent to Mailpit. Without them it fails with `429`, `401`, or "No verify-email email
reached …".

**Manual checklist**

- [ ] New family: only the onboarding hero and Add child show.
- [ ] Child added, nothing paired: "– / 10", "No devices yet", Pair a device everywhere.
- [ ] Device just paired: "Waiting for first check" on its card.
- [ ] All passing, all online: "Every protection is verified", "Fully protected".
- [ ] Device unseen > 24 h: offline counts in hero, "Last known: all set", offline alert in Recent Alerts.
- [ ] Turn off Uninstall Protection on a device: "needs your attention", chip links to `/protection`, child
      "Needs attention".
- [ ] One failing setting and a second child with no device: both chips show.
- [ ] Browser connected: card in Device Protection Status and Device Status tab; silent for a day → counted in
      "need attention".
- [ ] Screen time over the limit: red bar, "Over by *x*".
- [ ] A Critical alert older than four Info alerts: still listed first.
- [ ] Free plan: Location tab "Not on your plan", View Location shows plan badge, apps beyond 5 in "Others".
- [ ] Run Configuration Check: results per device, unreachable after 12 s, page refreshes.
- [ ] Break a streamed section (e.g. throw in `weeklySeries`): only that card shows Retry.
- [ ] Family timezone ≠ browser timezone: "Today" and weekend limits follow the family.

