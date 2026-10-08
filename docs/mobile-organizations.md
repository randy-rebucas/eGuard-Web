# Mobile app: one app for parents and children, with organizations

The spec for two things in the eGuard Android and iOS app:

1. **One app for everyone.** The same install works as a parent's app (parent mode) or as the app on a child's
   device (child device mode). There is no separate parent app or child app. How the app picks a mode, moves
   between modes safely, and what the two modes share now live in [mobile-api.md › Part A](mobile-api.md#part-a-one-app-for-parents-and-children).
2. **Organizations in parent mode.** Families join and leave schools, community groups and businesses; organization
   admins manage their organization from their phone. Phase 1 of [organizations.md](organizations.md), brought to
   the app.

**Status:** draft, 2026-10-01. The organization service is built on the server (`src/lib/organizations.ts`); the
mobile endpoints for it are not (section 7). The native app isn't built yet. Prompts to build this with Claude Code
are in [mobile-organizations-prompts.md](mobile-organizations-prompts.md).

**Related:** [organizations.md](organizations.md) (the feature and its privacy rule),
[mobile-api.md](mobile-api.md) (one app with both modes, the parent API and the child device API),
[child-app-spec.md](child-app-spec.md) (child device mode),
[app-listing.md](app-listing.md) (store listing, permissions, privacy forms).

Anything that needs a choice is marked **Decide** and collected in [section 11](#11-decisions). Anything the server
doesn't do yet is marked **Server gap** and collected in [section 7.3](#73-server-gaps).

## Contents

1. [Summary](#1-summary)
2. [Who uses the app](#2-who-uses-the-app)
3. [Modes](#3-modes)
4. [Moving between modes](#4-moving-between-modes)
5. [What the two modes share](#5-what-the-two-modes-share)
6. [Organizations in parent mode](#6-organizations-in-parent-mode)
7. [API](#7-api)
8. [Store policy](#8-store-policy)
9. [Privacy](#9-privacy)
10. [Acceptance criteria](#10-acceptance-criteria)
11. [Decisions](#11-decisions)

---

## 1. Summary

| | Parent mode | Child device mode |
|---|---|---|
| Who | A parent or guardian, signed in | Nobody signs in. The device is paired to one child |
| Credential | Parent session token (`/api/mobile/v1`, 30 days) | Device token (`/api/device/v1`, until removed) |
| Does | Everything in [mobile-api.md](mobile-api.md#part-b-parent-api) §P3, plus **Organizations** | Everything in [child-app-spec.md](child-app-spec.md), over [mobile-api.md › Part C](mobile-api.md#part-c-child-device-api) |
| Sensitive permissions | None (photo picker only) | Usage access, location, VPN, device admin, Screen Time… |
| Organizations | Join, leave, see sponsored plan; manage organizations you admin | Never shown |
| Switch away | Any time, from Settings ([mobile-api.md › A4](mobile-api.md#a4-moving-between-modes)) | Only after a parent removes the device |

## 2. Who uses the app

- **Parents and guardians (18+).** They create the account, add children, and run parent mode on their own phone.
  Some parents are also **organization admins** (a teacher, a barangay officer, an HR person). They use the same
  account; managing an organization is an extra role, not a different app or login.
- **Children.** Children never get accounts ([mobile-api.md › Part B](mobile-api.md#part-b-parent-api) › `POST /auth/register` requires
  `guardian: true`). They use the app only in child device mode, on a device a parent paired. They see their own
  protections and can ask for apps; they never see parent screens, other children, or organizations.

The store user is still the parent in both modes (app-listing.md: target age 18+, not the Families program).

## 3. Modes

Moved to [mobile-api.md › A2. Choosing a mode](mobile-api.md#a2-choosing-a-mode) and
[A3. Rules that keep the two modes apart](mobile-api.md#a3-rules-that-keep-the-two-modes-apart). Organizations add
nothing to child device mode: in Phase 1 they never push anything to a child's device, and in Phase 2
school-approved sites and homework schedules will arrive through the child's existing protections (`WEB`,
`BEDTIME`, the browser policy), so the child app still won't need an organizations screen.

## 4. Moving between modes

Moved to [mobile-api.md › A4. Moving between modes](mobile-api.md#a4-moving-between-modes) ("Set up this device for
a child", and reusing the install after removal).

## 5. What the two modes share

Moved to [mobile-api.md › A5. One codebase, two modes](mobile-api.md#a5-one-codebase-two-modes).

## 6. Organizations in parent mode

Everything here follows the privacy rule from [organizations.md](organizations.md) §1: **an organization never sees
an individual family's data.** The server enforces it; the app must never add anything that weakens it (no family
names in organization screens, no logging of who joined).

### 6.1 Where it lives

Settings gets a new row, **Organizations**, between Family and Subscription. Every parent sees it.

```
Settings › Organizations
├─ Your family's organizations        (joined list · Join with a code)
│    └─ Join with a code ─► Confirm ─► Joined
└─ Organizations you manage           (list · Create an organization)
     └─ {Organization}                (admin screen, 6.4)
          ├─ Join code
          ├─ Sponsor codes ─► Batch ─► Code
          └─ Admins
```

### 6.2 For families: joined organizations

| Element | Behavior |
|---|---|
| List | Each organization the family joined: name, kind ("School"), "Joined Sep 30, 2026". Empty: *"Schools, community groups and businesses can give your family a code to join. They'll only see that your family joined, never anything about your children."* |
| **Join with a code** | Family admin only. Other parents see *"Only {admin's first name} can join or leave organizations."* in its place |
| **Leave** | Family admin only. Confirm: *"Leave {org}? {org} will no longer count your family. Any sponsored plan you already have keeps running."* Then `DELETE /organizations/{id}/membership` |
| Limit | At 5 joined, the button reads *"You can join up to 5 organizations"* and is disabled |

**Join flow:**

1. Code field: 8 characters, shown as `XXXX-XXXX`. Auto-uppercase, ignore spaces and dashes, accept paste. Same
   alphabet as pairing codes (no `I`, `O`, `0`, `1`).
2. **Continue** → `POST /organizations/join/preview { code }`.
3. Confirm sheet:
   - Title: the organization's name, kind underneath.
   - **What {org} will see:** *"That your family joined. You're counted together with other families."*
   - **What {org} never sees:** *"Your name, your children, devices, settings, activity or location."*
   - Buttons: **Join** · Cancel. If `alreadyJoined`: *"Your family already joined {org}."* and only **Done**.
4. **Join** → `POST /organizations/join { code }` → back to the list with the new row and a toast
   *"Joined {org}."* The other parents get the "Joined {org}" alert and email from the server.

| Response | Show |
|---|---|
| `400 invalid` | The server's message (*"That code doesn't match an organization…"*). Keep the typed code |
| `403 forbidden` | The server's message. Shouldn't happen if the button is hidden for non-admins |
| `409 conflict` | The server's message (limit of 5) |
| `429 rate_limited` | The server's message (*"You've tried several codes…"*). Disable Continue for a minute |
| Network | Retry button, keep the code |

### 6.3 For families: sponsored plans

- Settings › Subscription shows a sponsored plan as **"Sponsored plan · {org}"** with *"Ends on {date}"*, when
  `store.name` is `VOUCHER`. The org name needs **Server gap S2**; until then show "Sponsored plan" only.
- The app **does not redeem sponsor codes** and does not tell people where to redeem them (section 8, decision M1).
  A family redeems on the web; the app shows the result after its next `GET /subscription`.
- The "{plan} sponsored by {org}" and "Joined / Left {org}" alerts arrive in Alerts as `SYSTEM` / `INFO` alerts with
  no action. They need no special handling.

### 6.4 For organization admins

Any parent can manage organizations; it's tied to their account, not their family role. A `PARENT` (not family
admin) can be an organization owner.

**Organizations you manage** lists each with name, kind, the role badge (Owner / Admin) and *"{n} families"*.
**Create an organization** asks for the name (2–80 characters) and kind (School / Community group / Business), then
opens the new organization. It needs a verified email: on `403 email_unverified` show the verify banner with
**Resend link** (mobile-api.md §P4.2). At 10 organizations, show *"You can manage up to 10 organizations."*

**Organization screen** (`GET /organizations/{id}`):

| Section | Shows | Actions |
|---|---|---|
| Header | Name, kind, your role | none |
| **Join code** | `XXXX-XXXX`, large | **Copy**; **Share** (system share sheet, text below); **Replace code** (confirm: *"The old code stops working. Families who already joined stay."*) → `POST /organizations/{id}/join-code` |
| **Families** | *"{n} families joined"*. A count only, never a list | none |
| **Sponsor codes** | Totals: bought, redeemed, available. Then batches, newest first: *"eGuard Plus · 3 months · 20 codes"*, paid date, state | Open a batch |
| **Admins** | Name, email, role, "You"; then waiting invitations (email, *"Invited · until {date}"*) | Owners: **Invite admin** (by email), **Cancel** an invitation, **Remove**, **Make owner**. Anyone: **Stop managing** on their own row |

**Inviting** always answers *"Invitation saved. If {email} has an eGuard account, they'll get an email and become
an admin once they accept."*, whether or not the email has an account. The invited person sees the invitation at
the top of **Organizations you manage**, with **Accept** (needs a verified email) and **Decline** (tells no one).

**Share text for the join code:** *"Join {org} on eGuard with the code {XXXX-XXXX}. In eGuard, open Settings ›
Organizations › Join with a code. {org} only sees how many families joined, never anything about your children."*

**Batch screen:**

| Batch state | Shows |
|---|---|
| `PAID` | Every code with its status chip: Available, Redeemed {date}, Cancelled, Expired. Redeem-by date |
| `PENDING` | *"Waiting for payment."* No codes yet. Pull to refresh |
| `VOIDED` | *"Refunded. Unused codes were cancelled; plans already redeemed keep running."* |

Code actions: **Copy**, **Share** (one code: *"Your eGuard sponsor code from {org}: {code}. Redeem by {date}."*),
**Share all available** (one code per line), and **Cancel code** on an available code (confirm: *"This code will
stop working. There's no refund for it."*) → `POST /organizations/{id}/codes/{codeId}/cancel`.

**Not in the app** (web only, see section 8): buying codes, API keys, the CSV download. The admin screen has no
button or text pointing to them. With no batches, the codes section reads *"Codes your organization buys appear
here."*

**Admin errors** all come back as `{ error, code }` with a message safe to show: `403 forbidden` (owner-only
action), `404 not_found` (you no longer manage it: go back to the list and refresh), `409 conflict` (last owner,
already an admin, limits), `400 invalid` (not an email address), `429 rate_limited` (10 invitations an hour).

### 6.5 Refresh

Nothing about organizations is real-time. Reload a screen when it opens and on pull to refresh. After a change,
use the response, then reload the list behind it.

## 7. API

### 7.1 New parent API endpoints

Base `https://www.eguard.family/api/mobile/v1`, the conventions in [mobile-api.md](mobile-api.md#part-b-parent-api) §P1 (bearer token,
error shape, IDs, ISO timestamps). Each endpoint is a thin route over `src/lib/organizations.ts`, using `authed()`
and `body()` from `src/lib/mobile-api.ts`, like the other mobile routes. The service already does every check.

| Method & path | Body | Response | Service |
|---|---|---|---|
| `GET /organizations` | none | `{ joined: [Joined], managed: [Managed], canJoin, limits: { join: 5, manage: 10 } }` | `familyOrganizations`, `managedOrganizations`; `canJoin` = family admin |
| `POST /organizations` | `{ name, kind }` | `201` `OrgView` | `createOrganization`, then `organizationView` |
| `POST /organizations/join/preview` | `{ code }` | `Preview` | `previewJoin` |
| `POST /organizations/join` | `{ code }` | `200` `Joined` | `joinOrganization` (**S3**: return `id`, `kind`, `joinedAt`) |
| `DELETE /organizations/{id}/membership` | none | `{ ok, name }` | `leaveOrganization` |
| `GET /organizations/{id}` | none | `OrgView` | `organizationView` |
| `POST /organizations/{id}/join-code` | none | `{ joinCode }` | `replaceJoinCode` |
| `POST /organizations/{id}/codes/{codeId}/cancel` | none | `{ ok }` | `cancelCode` |
| `POST /organizations/{id}/invites` | `{ email }` | `201 { email }` (the same whether or not it has an account) | `inviteOrgAdmin` |
| `DELETE /organizations/{id}/invites/{inviteId}` | none | `{ ok }` | `cancelOrgInvite` |
| `GET /organizations/invitations` | none | `{ invitations: [{ id, orgId, org, kind, by, expiresAt }] }` | `invitationsFor` |
| `POST /organizations/invitations/{id}/accept` | none | `{ orgId, name }` | `acceptOrgInvite` |
| `POST /organizations/invitations/{id}/decline` | none | `{ ok }` | `declineOrgInvite` |
| `DELETE /organizations/{id}/admins/{userId}` | none | `{ ok }` | `removeOrgAdmin` (your own id = stop managing) |
| `POST /organizations/{id}/admins/{userId}/owner` | none | `{ ok }` | `makeOrgOwner` |

`GET /subscription` gains `store.sponsor` (**S2**).

There is deliberately **no** mobile endpoint for buying codes, redeeming codes, API keys or the CSV (section 8).

### 7.2 Shapes

```json
// Joined: an organization the family joined
{ "id": "cmuorg001", "name": "Babatngon Central School", "kind": "SCHOOL", "kindLabel": "School", "joinedAt": "2026-09-30T02:11:09.000Z" }

// Managed: an organization the user manages
{ "id": "cmuorg001", "name": "Babatngon Central School", "kind": "SCHOOL", "kindLabel": "School", "role": "OWNER", "families": 42 }

// Preview: POST /organizations/join/preview
{ "name": "Babatngon Central School", "kind": "SCHOOL", "kindLabel": "School", "alreadyJoined": false }

// OrgView: GET /organizations/{id}
{
  "id": "cmuorg001",
  "name": "Babatngon Central School",
  "kind": "SCHOOL",
  "kindLabel": "School",
  "joinCode": "K7PQ-2M9X",
  "role": "OWNER",
  "families": 42,
  "totals": { "bought": 50, "redeemed": 31, "available": 17 },
  "batches": [
    {
      "id": "b1c2…", "plan": "eGuard Plus", "months": 3, "quantity": 50, "amount": 2235000,
      "state": "PAID", "paidAt": "2026-09-01T03:00:00.000Z", "createdAt": "2026-09-01T02:58:00.000Z",
      "codes": [
        { "id": "cmuv001", "code": "ABCD-EFGH-JKLM", "expiresAt": "2027-09-01T03:00:00.000Z", "redeemedAt": null, "status": "AVAILABLE" }
      ]
    }
  ],
  "admins": [ { "id": "cmuusr1", "name": "Randy Cruz", "email": "randy@example.com", "role": "OWNER", "you": true } ]
}
```

- Every shape has `kind` (`SCHOOL`, `COMMUNITY`, `BUSINESS`) and `kindLabel` ("School", "Community group",
  "Business", from `ORG_KINDS`). The service returns the label in some places and the enum in others; the mobile
  routes normalize it (M7).
- `amount` is in centavos. `status` is `AVAILABLE`, `REDEEMED`, `CANCELLED` or `EXPIRED`.
- Batches in `EXPIRED` state (checkout never paid) aren't returned.
- `OrgView` never contains a family, a child, or who redeemed a code. API tests must check this (section 10).

### 7.3 Server gaps

| # | Gap | Fix |
|---|---|---|
| S1 | No organization endpoints in the parent API | Add the routes in 7.1, document them in mobile-api.md (new §P4.16 and screen-map row), add API tests |
| S2 | `GET /subscription` doesn't say who sponsors a `VOUCHER` plan | Add `store.sponsor` (org name or `null`) using `sponsorOf()` |
| S3 | `joinOrganization` returns only `{ name }` | Return the `Joined` shape (`id`, `name`, `kind`, `joinedAt`) so the app can add the row without reloading |
| S4 | Join codes can only be typed | **Later** (M6): `https://www.eguard.family/join/{code}` as an app link / universal link that opens the join confirm sheet, with a web fallback page |
| S5 | No mode-reuse after removal in the child spec | Update child-app-spec §5 "Removal" (mobile-api.md A4). No server change |

## 8. Store policy

Both stores require their own billing for digital goods sold or unlocked inside the app, and forbid steering users
to pay elsewhere. That decides what organizations can do in the app:

| Action | In the app? | Why |
|---|---|---|
| Join or leave an organization | **Yes** | Not a purchase. Joining grants nothing |
| See a sponsored plan | **Yes** | Showing the plan is fine; mobile-api.md already shows `VOUCHER` plans |
| Redeem a sponsor code | **No** (M1) | A code unlocks a paid plan. Apple guideline 3.1.1 forbids unlocking features with codes outside In-App Purchase; Google Play's payments policy treats it the same way |
| Buy sponsor codes | **No** (M2) | A purchase of digital subscriptions |
| Point to the web for either | **No** | Anti-steering rules. No "Redeem at eguard.family" text or link |
| Create and manage an organization, share codes, cancel a code | **Yes** | No payment involved |

**Review notes** (add to app-listing.md's reviewer notes): *"Organizations: schools and community groups can give
families a code to join. Joining is free and shares only a count with the organization. Plans are not sold or
unlocked in the app."*

**Privacy forms:** organizations add no new data types. An organization admin's account email is already collected.
Confirm the Data safety and App Privacy answers still hold, and say in the privacy policy that joined organizations
see only counts.

## 9. Privacy

| Data | Who sees it | Where |
|---|---|---|
| That a family joined an organization | The family; the organization as a **count** | `GET /organizations` (family), `families` (organization) |
| Which code a family redeemed | The family (as its plan); support | Never in any organization response |
| Organization admins' names and emails | Other admins of the same organization | `OrgView.admins` |
| Children, devices, settings, activity, location | The family only | Never in any organization response |

The app adds nothing: it doesn't cache organization screens beyond the session, doesn't log codes, and never shows
a family name on an organization screen.

## 10. Acceptance criteria

One app, two modes

- [ ] First launch asks "Who's using this device?"; backing out before sign-in or pairing leaves `mode` unset.
- [ ] A signed-in parent never has a device token stored, and a paired device never has a parent token stored
      (check storage after every switch).
- [ ] **Set up this device for a child** pairs the device, signs the parent out on the server, and continues at the
      permissions step. A failed pairing leaves the parent signed in.
- [ ] After a parent removes a child's device, that device shows the removed screen; **Set up eGuard again** returns
      to "Who's using this device?" with no data from before.
- [ ] No parent screen is reachable in child device mode (deep links, notifications, back stack).
- [ ] The release build has no analytics, ads or tracking SDKs (dependency list in the audit).

Organizations: families

- [ ] The family admin can join with a code typed in any case, with or without the dash or spaces.
- [ ] The confirm sheet names the organization and says exactly what it will and won't see, before joining.
- [ ] Joining twice shows "already joined" and makes no second membership.
- [ ] A parent who isn't the family admin sees the list but no Join or Leave.
- [ ] Leaving removes the row and the organization's count drops by one.
- [ ] Wrong codes show the server's message; after several, the rate-limit message.
- [ ] A sponsored plan shows "Sponsored plan · {org}" and its end date.
- [ ] There is no field, button or text for redeeming or buying codes anywhere in the app.

Organizations: admins

- [ ] Creating an organization needs a verified email and opens the new organization.
- [ ] The join code can be copied, shared and replaced; the old code stops working right away.
- [ ] Codes show the right status; an available code can be copied, shared and cancelled; a redeemed one can't be
      cancelled.
- [ ] Owners can invite, remove and promote admins; an invited person is an admin only after accepting; inviting
  answers the same for an email with or without an account; the last owner can't be removed; any admin can stop
  managing.
- [ ] An admin removed on the web gets "not found" on next load and is returned to the list.

Server

- [ ] API tests for every endpoint in 7.1, including 404 for a non-admin, 403 for owner-only actions, and a check
      that no organization response contains a family id, family name, child or device.
- [ ] `npm run typecheck`, `npm test` and `npm run test:api` pass.

## 11. Decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| M1 | Redeem sponsor codes in the app | No · Yes on Android only · Yes everywhere | **No.** Store rules; the web already does it. Revisit only with written store guidance |
| M2 | Buy sponsor codes in the app | No · Through In-App Purchase | **No.** Organizations buy on the web, often with a work card or GCash |
| M3 | How much organization admin in the app | Full (minus buying and API keys) · Read-only | **Full minus buying, API keys and CSV.** Teachers and barangay staff are phone-first |
| M4 | Parent → child on the same phone | Shortcut (mobile-api.md A4) · Sign out and pair by hand | **Shortcut.** Common case: handing down an old phone |
| M5 | Child → parent after removal | Reuse the install · Uninstall and reinstall | **Reuse.** The device is already clean after `401` |
| M6 | Join links or QR codes | Now · Later | **Later** (S4). Typing 8 characters is fine for v1, and QR scanning adds a camera permission on iOS |
| M7 | `kind` shape in mobile responses | Keep the service's mix · Always send `kind` + `kindLabel` | **Decided: `kind` + `kindLabel` everywhere** in the new mobile routes; it's a new API, so no clients break |
