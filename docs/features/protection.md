# Protection

The family-wide view of the ten protections (`/protection`): whether each one is set up and **verified** on the
children's devices, what each child's setting is, and the way in to change one. It also owns the two workflows that
every other page borrows: the **setup flow** (change a protection for a child, send it to their devices, wait for
them to confirm it) and the **configuration check** (ask devices to report now).

**Status:** Built and in use. Feature completeness **100%** of this review (see [§9](#9-completeness)). Written
2026-10-04, updated the same day after the fixes in [§10](#10-issues-found) and the remaining open items.
**Route:** `/protection` (cards have anchors such as `/protection#bedtime`, used by search).
**Code:** `src/app/(app)/protection/{page,loading}.tsx`, `src/components/flow.tsx` (provider, buttons, toasts),
`src/components/flow-dialogs.tsx` (setup flow and check dialogs), `src/app/actions/config.ts` (server actions),
`src/lib/config-service.ts` (requests, batches, guided setup), `src/lib/engine.ts` (`deviceSync`, `processReport`,
check runs), `src/lib/health.ts` (`evaluate`, `computeHealth`), `src/lib/protections.ts` (catalogue, config shapes,
`describeConfig`), `src/app/api/flow/[batchId]/route.ts` and `src/app/api/checks/[id]/route.ts` (polling).
**Mobile counterpart:** `GET /children/{id}/protections`, `PUT /children/{id}/protections/{key}`,
`POST /children/{id}/setup`, `GET /batches/{id}`, `POST /batches/{id}/confirm`, `POST /checks`, `GET /checks/{id}`,
see [mobile-api.md](../mobile-api.md).
**Related:** [dashboard.md](dashboard.md) (§4 scoring and §5 statuses, which this page uses), [children.md](children.md)
(the child's Protection tab and starting protections), [devices.md](devices.md) (protections per device),
[child-app-spec.md](../child-app-spec.md) (what devices apply and report).

## Contents

1. [Page at a glance](#1-page-at-a-glance)
2. [Configuration Health](#2-configuration-health)
3. [Protection settings cards](#3-protection-settings-cards)
4. [The setup flow](#4-the-setup-flow)
5. [Configuration check](#5-configuration-check)
6. [How a change is verified](#6-how-a-change-is-verified)
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
│ Protection                                                [Run Configuration Check]      │
│ Configuration Health tells you whether each protection is set up and verified …          │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ (8/10)  CONFIGURATION HEALTH                                                             │
│  ring   2 protections need review                                                        │
│         3 devices, last checked Today, 9:12 AM. Mia's Tablet is offline …  Pair a device →│
│         [Pass] [Warning] [Action required] [Unsupported] [Not configured]   (legend)     │
│ ──────────────────────────────────────────────────────────────────────────────────────── │
│ Uninstall Protection  [Action required]  Uninstall Protection turned off on …  Fix this →│
│ Bedtime               [Warning]          Bedtime on Mia's Tablet doesn't match …         │
│ Screen Time           [Pass]             Verified on 3 of 3 devices                       │
│ …                                                                                        │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Protection settings                                                                      │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐              │
│ │ Screen Time    │ │ Bedtime        │ │ Apps           │ │ …  (10 cards)  │              │
│ │ 2h / day …     │ │ Varies by child│ │                │ │                │              │
│ │ Android · iOS  │ │ Mia: … · Leo: …│ │                │ │                │              │
│ │ Last checked   │ │ 1 device to    │ │                │ │                │              │
│ │      [Manage]  │ │ review [Review]│ │                │ │                │              │
│ └────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘              │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ How platform support works: Available · Guided setup · Verification only · Unsupported   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Needs a signed-in parent (`requireUser`); everything is read from the parent's own family through `getFamily` and
`getFamilyGraph` (the same per-request cache the app layout fills). Browsers aren't in the score: they follow their
own rules (the child's Browser tab, [children.md](children.md)) and report their own health. The Web card lists them
with their status.

## 2. Configuration Health

The score and checks come from `computeHealth()` over the family's phones and tablets, exactly as on the dashboard
(see [dashboard.md §4](dashboard.md#4-how-protection-is-measured)): one check per protection, the worst device wins,
`PASS` and `UNSUPPORTED` count as passing, and an offline device counts with its last known state.

**Header button:** **Run Configuration Check** ([§5](#5-configuration-check)), or **Pair a device** (`/devices#pair`)
when nothing is paired.

**Ring:** `score / 10`, empty when nothing is paired.

**Headline** (first match wins):

| Condition | Headline |
|---|---|
| no phone or tablet paired | "No devices to check yet" |
| `verified`, every child paired | "Every protection is verified" |
| `verified`, some child has no device | "Verified on every paired device" |
| score = 10, some device offline | "Every protection is set, as last reported" |
| one check failing | "One protection needs review" |
| otherwise | "*n* protections need review" |

**Line under it:** "*n* devices, last checked *time*" (newest `lastVerifiedAt` of any protection on any device, or
"not checked yet"); then the offline devices by name (up to 3, then "and *n* more") "keep the last known state"; then
"*n* changes are waiting for a device to confirm" when any are open; then children with no paired device, "so nothing is checked for them yet", with **Pair a device** (preselecting the child
when there's only one). With nothing paired: "Pair a child's device to start verifying protections. **Add a device**".

**Legend:** the five check statuses as badges (a labelled group for screen readers).

A protection the parent turned **off** passes once the device confirms it (or is stricter): it's their choice, not
something to fix. Only a child with no setting for it at all reads "Not configured" (see
[dashboard.md §4.2](dashboard.md#42-per-device-evaluate)).

**Check list:** the 10 checks, failing ones first, each with an icon toned by status, the check name and badge, and
the `detail` line ("Verified on 2 of 3 devices; 1 offline, last known state", or the first failing device's own
message "and *n* more"). A failing check is a button with **Fix this**: it opens the setup flow on that protection
**for the child who owns the first failing device** (`fixChildId`). Passing checks are plain rows.

## 3. Protection settings cards

One card per protection, in catalogue order, with anchor `id={slug}`:

| Part | Shows |
|---|---|
| Pill | "No devices" (nothing paired) · "Verified" · "Last known: verified" (passing, but an offline device counts) · "Not applicable" (unsupported on every device) · "*n* device(s) to review" (devices not passing) |
| Value | the children's setting via `describeConfig`: one value when all children agree, "Varies by child" plus "Mia: … · Leo: …" when not, "No children yet" |
| Waiting change | per child with a change no device has confirmed yet (`getOpenChanges`): "*Mia*: changing to **9:00 PM – 6:30 AM**, waiting for Galaxy A54 to confirm" ("to come online" when every target is offline; "waiting for you to finish the setup steps" for guided setup), with **Check progress** (opens the flow, which offers to resume it). The value above only changes once a device confirms |
| Browsers | Web card only, when the family has any: "Browsers follow their own rules and aren't counted here", then each one ("Chrome on Mia's MacBook", with the child's name when there are several children) with its status pill (`browserStatus`, as on Devices), linking to the child's Browser tab |
| Plan note | Location on Free: "Location sharing isn't on your plan…" (the device may share, but the server drops it) |
| Capabilities | Android and iOS chips: Available, Guided setup, Verification only, Unsupported |
| Last checked | newest report of this protection from any device, "Never" when none |
| Button | **Review** when a device isn't passing (opens the flow for the failing child), else **Manage** (the flow asks which child) |

The last card explains the four capabilities (`CAPABILITY_META`):

| Capability | Meaning | Where it applies |
|---|---|---|
| Available | eGuard applies the setting and verifies it | everything on Android; most on iOS |
| Guided setup | the parent follows steps on the device, then eGuard verifies | iOS: Web, Location |
| Verification only | the parent sets it on the device; eGuard confirms it's on | iOS: Downloads |
| Unsupported | the platform doesn't allow it; not counted in health | iOS: Notifications |

## 4. The setup flow

`ConfigFlow` in `flow-dialogs.tsx`, opened from this page, the dashboard's Quick Actions, the child's Overview and
Protection tabs, the device page's **Manage**, and the Location pages. It's lazy-loaded and preloaded on hover or
focus. Six steps, shown as a stepper ("Step *n* of 6 · *name*"):

| # | Step | What happens |
|---|---|---|
| 0 | Select protection / child | Only when not given. A child without a device reads "No device yet · applied once one is paired"; with no children, **Add a child** |
| 1 | Review current configuration | Each of the child's devices: name, platform, capability, what it reported (`currentLabel`, "Not reported" before its first report) and its badge; then "Your setting for *Mia*: …". With no device: "You can change the setting now; eGuard applies and verifies it once a device is paired" + **Pair a device** (preselecting the child). Blocks only with "*Protection* isn't supported on *Mia*'s devices". If a change is already open: "A change is already waiting for verification. **Check progress**" (resumes it) |
| 2 | Choose new configuration | The form for that protection (below). Problems are explained inline (`draftProblem`, mirroring `ConfigSchema`) and disable the button. The button reads **Save** with no device, **Continue to setup** when any device needs guided setup, else **Apply to device** |
| – | Confirm | "Change Protection Settings" alert dialog: which devices, "Once it's applied, the change shows in eGuard on *Mia*'s device", Now → New, **Continue**. With no device: "This is saved as *Mia*'s setting and applied when a device is paired", **Save** → toast "Saved. It applies once *Mia*'s device is paired." and the dialog closes |
| 3 | Apply to device | `submitConfig` → a batch of requests ([§6](#6-how-a-change-is-verified)). Guided devices show their steps, "I've done these steps on the device", **Verify now** (`confirmGuided`) or **Cancel change** (`cancelBatch`: "Change cancelled. Nothing was changed on the device.") |
| 4 | Verify | Polls `/api/flow/{batchId}` every 1.2 s; one row per device ([§7](#7-status-reference)). After 20 s: "Some devices haven't answered yet. eGuard keeps the change waiting…"; after 4 failed polls: "Can't reach eGuard right now". **Continue in background** closes it with a toast |
| 5 | Configuration Health updated | "Verified on *devices*", "*n* device(s) didn't confirm" (with each reason), or "Not applied"; the child's score; Before → After; **View history** (`/children/{id}?tab=history`) and **Done**; the page refreshes |

**Forms:**

| Protection | Fields | Rules |
|---|---|---|
| Screen Time | school days and weekend minutes | whole minutes, 15–1440 |
| Bedtime | on/off, start, end, Every day / School nights | start ≠ end when on |
| Apps, Content | maximum age rating: 4, 9, 12, 13, 16, 17, 18 (a value set elsewhere is kept in the list) | 4–18 |
| Web | Filter adult and unsafe sites / Allowed sites only / Off | only the mode counts: `blockedSites` is optional (default 0), not shown and not compared, since a device reports the size of its own list |
| App Approval, Downloads, Location, Notifications, Uninstall Protection | one switch each | — |

Server actions validate everything again: an unknown protection or a malformed id is a 404, the config must pass
`ConfigSchema`, and the child must be in the parent's family.

## 5. Configuration check

**Run Configuration Check** (this page, dashboard, device page for one device) opens `CheckDialog`:

1. `startCheck` → `startCheckRun`: a run with one result per device, `checkRequestedAt` set on each, an audit entry
   `check.started`. With no devices: "Pair a child's device before running a check." At most 30 checks per parent
   per hour (`LIMITS.checkUser`, web and mobile): "You've run several checks. Wait a few minutes; devices keep
   reporting on their own."
2. Each device's next `/sync` says a full report is wanted; its full report fills its result (`reachable`, `issues`).
3. The dialog polls `/api/checks/{runId}` every 0.9 s. A poll finalizes the run once every device answered or
   **12 s** passed (`CHECK_TIMEOUT_MS`); silent devices become "Couldn't reach".
4. Result: per device **All verified** / ***n* to review** / **Couldn't reach**, then "Configuration Health: *s* / 10"
   for **the devices this run covered**, with the same wording as the page ("Every protection is verified", "…set,
   as last reported", "*n* protections still need review", and "Devices that didn't answer keep their last known
   state").

**Continue in background** closes the dialog; device reports still update the page. A run nobody polled is
finished by the maintenance job after 10 minutes (`closeStaleWork`), so it's purged with the rest.

## 6. How a change is verified

The rule is "never report success unless the device confirms it": saving a change does **not** change the child's
policy. Only a device report can.

1. **Request** (`requestConfigs`, shared by web and mobile): for each device whose platform supports the protection,
   one `ConfigRequest` in a new batch: `APPLY` / `PENDING` on Available devices, `GUIDED` / `AWAITING_PARENT` on
   Guided and Verification-only ones. The device's last report is kept as `previous`. Older open requests for the
   same child and protection are **cancelled**. Audit `config.requested` ("Bedtime for Mia: 9:00 PM – 6:30 AM").
   A child with **no device** gets the config saved straight into their policy (no batch), applied when a device
   pairs. In the single-setting flow (`strict`), a child whose devices all lack support is a 409; the mobile `setup`
   endpoint instead saves such protections straight into the policy.
2. **Deliver** (`deviceSync`): each sync returns the open `APPLY` requests (new and already-delivered ones, in case a
   response was lost) and marks new ones `DELIVERED`. Guided requests become `DELIVERED` when the parent taps
   **Verify now**, which also asks the device for a report.
3. **Report** (`processReport`): for each protection the device reports:
   - an open request whose desired config **matches** (key order ignored) → `VERIFIED`; the child's policy becomes
     that config (and the screen-time mirror on `Child`); a history entry "*Protection* updated" (or "verified" when
     nothing changed) "· verified on *device*";
   - a delivered `APPLY` request that doesn't match → `FAILED` "Device reported …";
   - then the protection is evaluated against the (possibly new) policy (`evaluate`, see
     [dashboard.md §4.2](dashboard.md#42-per-device-evaluate)) and stored with the device's message.
4. **Tampering:** a protection that goes from passing to failing raises an alert, once (under a lock), and a history
   entry "*Protection* changed on device". "Protection setting changed" is Attention; turning off Uninstall
   Protection or App Approval is Action required; turning off location is "Location sharing turned off" (Action
   required). The alert is held back while a parent's change is in flight, but only for **6 hours**
   (`CHANGE_GRACE_MS`), so a stuck request can't silence tampering. A passing report resolves it.

A change sent to two devices updates the policy when the **first** confirms; the second then reads as not matching
until it confirms too.

5. **Expiry:** a request no device confirmed within **7 days** (`OPEN_CHANGE_DAYS`: a guided setup never finished,
   a device that never came back) is cancelled by the maintenance job with "No device confirmed it within 7 days".
   The policy stays as it was. The parent gets one **Info** notice per change: "*Bedtime* change wasn't confirmed",
   "*Galaxy A54* didn't confirm the change within 7 days, so eGuard stopped waiting. *Mia*'s earlier setting stays in
   place. Try again once the device is online.", with the requested value and **Review setting** (opens the flow).
   It isn't emailed, can be dismissed, and is purged like other Info alerts.

Comparison ignores key order, and Web filtering compares `mode` only.

## 7. Status reference

**Check statuses, child and device states, capabilities:** as in [dashboard.md §5](dashboard.md#5-status-reference).

**Configuration request** (per device, in the flow's progress list):

| Status | Shown |
|---|---|
| `PENDING` | "Sending to device", or "Waiting for the device to come online" when it's offline |
| `AWAITING_PARENT` | "Waiting for you to finish the steps" |
| `DELIVERED` | "Waiting for the device to confirm" (or "Checking the device" for guided setup) |
| `VERIFIED` | "Verified" |
| `FAILED` | the reason, e.g. "Device reported 1h / day" |
| `CANCELLED` | "Cancelled" (by the parent, a newer change, removing or moving the device, or unconfirmed for 7 days) |

**Batch** (mobile `GET /batches/{id}`): per protection, the worst request status
(`FAILED > AWAITING_PARENT > PENDING > DELIVERED > CANCELLED > VERIFIED`), a summary and `done` once nothing is open.

**Check result:** Checking… → All verified / *n* to review / Couldn't reach.

## 8. Web vs mobile

| | Web | Mobile app |
|---|---|---|
| Family-wide view | `/protection` (health, checks, 10 cards) | `GET /dashboard` (score and checks); no per-protection cards across children |
| One child | child's Protection tab | `GET /children/{id}/protections`: policy, per-device status, reported value, message, guide, open batch |
| Change one protection | setup flow (`strict`) | `PUT /children/{id}/protections/{key}` (`strict`), returns the batch |
| Child with no device | saved as the setting; toast | `200 { batchId: null, saved: [key] }` |
| Whole profile at once | at child creation (children.md) | `POST /children/{id}/setup` with overrides; protections no device can verify are saved directly |
| Progress | `/api/flow/{batchId}` | `GET /batches/{id}`, `POST /batches/{id}/confirm` |
| Configuration check | dialog | `POST /checks`, `GET /checks/{id}` (same 12 s rule, same 30 per hour, health of the covered devices) |
| Unreported protection | "Not reported" | "Not reported" everywhere |
| Pending changes | on each card and in the health line | `openBatchId` per protection in `/children/{id}/protections` |

## 9. Completeness

| Area | Status | Notes |
|---|---|---|
| Configuration Health summary | Done | Offline and unpaired children named, never "verified" while offline |
| Check breakdown with **Fix this** | Done | Opens the flow for the first failing child |
| Protection settings cards | Done | Value per child, device count to review, last checked, capabilities |
| Platform support explanation | Done | |
| Setup flow (select → verify → result) | Done | Inline problems, confirm step, resumable, cancellable |
| Guided setup and verification-only | Done | Steps per platform, nothing marked done until verified |
| Verification engine | Done | Request → deliver → report; policy changes only on confirmation |
| Tamper alerts | Done | Once per transition, 6 h grace, tested |
| Configuration check | Done | Per-device result, timeout, health of covered devices |
| Plan gating | Done | Location note on Free |
| Accessibility of the flow | Done | Focus trap, Escape, alertdialog for confirm, labelled switches |
| Pending changes visible on the page | Done | On each card and in the health line, with **Check progress** |
| Setting a protection before pairing | Done | Saved as the child's setting, applied when a device pairs (web and mobile) |
| Turning a protection off on purpose | Done | Passes once the device confirms it |
| Web filtering verification | Done | Compares the mode, not the device's list size |
| Browsers | Done | Listed on the Web card with their status; not in the score |
| Loading state | Done | Skeleton in the page's shape |
| Web/mobile consistency | Done | Same engine, scoring, labels ("Not reported") and check limit |
| Housekeeping of requests and checks | Done | Stale runs finished, week-old open changes cancelled |
| Tests | Done | Engine, web actions, mobile endpoints and maintenance; `/api/flow` through its mobile twin |

**Overall: 100%** of what this review set out (20 of 20). Was ~73% at the first review and ~95% after the fixes, both
on 2026-10-04. The suggestions below are improvements, not gaps. Page rendering still has no automated test.

## 10. Issues found

All ten issues from the first review were fixed on 2026-10-04:

| # | Issue | Fix |
|---|---|---|
| 1 | A protection the parent turned off counted as failing forever (`NOT_CONFIGURED`), so the score dropped, "Fix this" showed, and the family could never read "verified" | `evaluate()`: a policy that's off passes, whatever the device reports; only a child with **no** policy for it stays `NOT_CONFIGURED` when the device has it off. Dashboard doc §4.2 and the mobile-api.md example updated |
| 2 | Web filtering never verified on a real device: `blockedSites` (the device's loaded list size) was compared with the policy's 42, which parents saw and couldn't set | `configMatches` compares `WEB` on everything but `blockedSites`; the label is "Adult and unsafe sites filtered"; `blockedSites` is optional in `ConfigSchema` (default 0). child-app-spec.md and mobile-api.md updated |
| 3 | A change waiting on a device was invisible on this page | `getOpenChanges()` in `queries.ts`; each card says "changing to *x*, waiting for *device*" (to confirm / to come online / for you to finish the steps) with **Check progress**; the health line counts waiting changes |
| 4 | No way to set a protection before a device was paired | `requestConfigs`: with no device, the config is saved as the child's policy, even in strict mode (still 409 when devices exist but none supports it). The flow lets such a child be picked and says **Save**; mobile `PUT` answers `200 { batchId: null, saved }` |
| 5 | "Unknown" for an unreported protection in the flow and mobile `/children/{id}/protections` | "Not reported" in both |
| 6 | Check runs closed early stayed `RUNNING` and weren't purged; open requests never expired | `closeStaleWork()` in the maintenance job: finishes runs older than 10 minutes and cancels open requests older than 7 days, with a reason |
| 7 | No rate limit on starting a check | `LIMITS.checkUser` (30 per parent per hour) in `startCheckRun`, so web and mobile share it; documented in mobile-api.md |
| 8 | The loading skeleton was two blocks | Rebuilt in the page's shape: ring and text, 10 checks, 10 cards, platform card |
| 9 | The confirm step promised the child "a notice", which the child app spec doesn't have | "Once it's applied, the change shows in eGuard on *Mia*'s device" |
| 10 | The legend's `aria-label` was ignored on a plain `div` | `role="group"` |

**Follow-ups, also done on 2026-10-04:**

| Open item | Done |
|---|---|
| Statuses stored before fix 1 and 2 stayed wrong until each device reported again | Migration `20261004120000_reevaluate_protection_rules` (data only): rows for a protection the parent turned off, and Web rows that differ only in `blockedSites`, become Pass, and their open alerts resolve. Applied locally: one Bedtime row changed |
| A change cancelled after 7 days wasn't announced | An Info notice per change with **Review setting** ([§6](#6-how-a-change-is-verified)) |

**Open:** none known.

## 11. Suggestions

**Usefulness**

1. A per-child matrix (children × protections) with each cell's status, so "Varies by child" can be read at a glance
   and every failing child is reachable, not only the first one.
2. "Apply to all children" in the flow, for families who want one bedtime.
3. Show the last configuration check (time and result) under the health line, and its result after the dialog was
   closed early.
4. Let the parent edit the Web filter's allow and block lists for phones, as for browsers.
5. Show the device's loaded blocklist size ("81,244 sites") on the device page, now that it's reported but not compared.

**Quality**

6. A page render test for `/protection` (needs a page-level harness, as for children and devices).
7. A test of `/api/flow/{batchId}` itself (today covered through `GET /batches/{id}`, which reads the same requests).

## 12. Testing

| What | Where | Covered |
|---|---|---|
| `evaluate`, `computeHealth`, offline rules, labels; off by the parent passes, no policy stays not configured; Web compares the mode only | `src/lib/test/health.test.ts` | yes |
| Stale check runs finished, week-old open changes cancelled (only while still open), one dismissible, un-emailed notice per change | `src/lib/test/maintenance.test.ts` | yes |
| Web actions: made-up protection, child, batch and device ids refused; "Not reported", age default and guided steps in the flow context; `ConfigSchema` before sending; strict web request; no-device save (`batchId: null`); optional `blockedSites`; check per family or one device, audited, rate-limit refusal passed on | `src/app/actions/config.test.ts` | yes |
| Against the server: App Approval turned off passes (`reportedLabel` "Off"); a Web change verifies with 81,244 sites loaded; a child with no device gets a Bedtime saved (`200`, `batchId: null`) that their iPad receives in its first `/sync` policy | `tests/api/mobile-api.test.ts` | yes |
| `ConfigSchema` and `ReportedConfigSchema` (times, bounds, extra fields) | `src/lib/test/config-schema.test.ts` | yes |
| `bedtimeActive`, school nights | `src/lib/test/device-rules.test.ts` | yes |
| Change a protection on mobile: verified, failed, bad input, guided setup + confirm, unsupported (409) | `tests/api/mobile-api.test.ts` | yes |
| Configuration check on one device, health of the covered devices | `tests/api/mobile-api.test.ts` | yes |
| Tamper alert held back during a fresh change, not by an old one | `tests/api/verification.test.ts` | yes |
| Moving or removing a device cancels its open requests | `src/lib/test/devices.test.ts` | yes |
| `/api/flow/{batchId}` and `/api/checks/{id}` | — | through their mobile twins (suggestion 7) |
| The data migration | dry run in a rolled-back transaction, then applied locally | by hand |
| Page render | — | **no** (suggestion 6) |

**Last run (2026-10-04, after the open items):** unit tests 212/212 (`npm test`), API suite 247/247
(`npm run test:api`, with the settings in README › API tests, against a dev server started from PowerShell), type
check clean, lint clean on the changed files. During the fixes, one API run failed an invitation test because
Docker's clock had drifted about 45 minutes, so Mailpit's timestamps fell before the test's start time. It passed
once the clock caught up; nothing in the code was involved. Nothing on this page was opened or clicked in a browser:
the waiting-change line, the browser list, the no-device **Save** path, the skeleton and the confirm wording are
checked by type and tests only. The maintenance job wasn't run against the database; `closeStaleWork` is checked by
its unit test and the type check.

**Manual checklist**

- [ ] Nothing paired: "No devices to check yet", empty ring, **Pair a device** in the header, cards say "No devices".
- [ ] All passing, all online, every child paired: "Every protection is verified", cards "Verified".
- [ ] One child without a device: "Verified on every paired device" and "*Leo* has no paired device… Pair a device".
- [ ] A device offline a day: named in the health line, cards "Last known: verified", headline "…as last reported".
- [ ] Two children with different bedtimes: Bedtime card "Varies by child" and both values.
- [ ] Turn off Uninstall Protection on a device: red check first, **Fix this** opens the flow for that child.
- [ ] Bedtime flow on Android: Now → New, Apply, "Verified on *phone*", score, Before → After, **View history**.
- [ ] Same with the device offline: "Waiting for the device to come online", after 20 s the "keeps the change
      waiting" note; close; the card shows "changing to …, waiting for *Tablet* to come online" with **Check
      progress**, and the health line counts it.
- [ ] Web on an iPad: guided steps, **Verify now** disabled until ticked; **Cancel change** → toast, nothing changed.
- [ ] Open the flow again during a pending change: "A change is already waiting… Check progress" resumes it.
- [ ] Bedtime with equal start and end: inline message, button disabled. Screen time 10 minutes: same.
- [ ] Turn Bedtime off and let the device confirm: the check stays Pass, the card reads "Off · Verified".
- [ ] Child with no device: their row in the flow says "applied once one is paired"; **Save** → toast; the card
      shows the new value; after pairing, the device gets it on its first sync.
- [ ] Web filtering on an Android phone that loads a large blocklist: the change verifies.
- [ ] Family with a browser: the Web card lists "Chrome on *computer*" with the same status as on Devices; the link
      opens the child's Browser tab.
- [ ] A change left unconfirmed for 7 days (set `createdAt` back in the database, run the maintenance job): it reads
      Cancelled, an Info alert "*Protection* change wasn't confirmed" appears with **Review setting**, no email.
- [ ] Run Configuration Check 31 times in an hour: the 31st is refused with the "several checks" message.
- [ ] Slow network (DevTools throttling): the skeleton has the page's shape.
- [ ] Change a setting on the device itself: "Protection setting changed" alert, history "changed on device".
- [ ] Run Configuration Check with one device off: "Couldn't reach" after 12 s, the rest verified.
- [ ] Free plan: Location card shows the plan note.
- [ ] Search "Bedtime": the result opens `/protection#bedtime`.
- [ ] Keyboard only: Tab stays inside the flow, Escape closes it, focus returns to the button.
