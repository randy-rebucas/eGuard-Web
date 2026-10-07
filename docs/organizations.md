# Organizations and sponsored plans

How schools, communities and businesses use eGuard: organizations, join codes, and sponsor codes that pay for
families' plans. This document is the plan for all four phases and the specification for **Phase 1**, which is
what's built.

**Status:** Phase 1 built, 2026-10-01 (migration `20260930160137_organizations`, service `src/lib/organizations.ts`,
tests `tests/api/organizations.test.ts`).
**Related:** [subscriptions.md](subscriptions.md) (plans, PayMongo, entitlements), README › Protections and verification,
[mobile-organizations.md](mobile-organizations.md) (organizations in the Android and iOS app).

## Contents

1. [Goals and the privacy rule](#1-goals-and-the-privacy-rule)
2. [Roadmap](#2-roadmap)
3. [Phase 1 scope](#3-phase-1-scope)
4. [Concepts](#4-concepts)
5. [Data model](#5-data-model)
6. [Flows](#6-flows)
7. [How codes become a plan](#7-how-codes-become-a-plan)
8. [What each side sees](#8-what-each-side-sees)
9. [Screens](#9-screens)
10. [Rules and limits](#10-rules-and-limits)
11. [Security](#11-security)
12. [Testing](#12-testing)
13. [Not in Phase 1](#13-not-in-phase-1)
14. [Open questions](#14-open-questions)

---

## 1. Goals and the privacy rule

eGuard is built around one family's account. Organizations want to help many families at once: a barangay
funding plans for families who can't pay, a school encouraging parents to set up protection, a company offering
eGuard as an employee benefit.

**The rule every phase follows: an organization never sees an individual family's data.**

- A family **joins** an organization only by entering its code, and can leave at any time.
- An organization sees **counts** (families joined, codes redeemed), never names, children, devices, settings,
  activity or locations.
- Anything more detailed (the Phase 3 impact report) is **anonymous and only shown above a minimum group size**.

This is what the public Security & privacy page promises, and it keeps schools and employers clear of Data Privacy
Act (RA 10173) obligations for data they never receive.

## 2. Roadmap

| Phase | What | Why |
|---|---|---|
| **1** | Organizations, join codes, **sponsor codes** (prepaid plans an organization buys and hands out) | Revenue from every kind of organization; builds on the existing pass billing |
| 2 | School-approved websites and homework schedules families can subscribe to | Gives schools a reason to recommend eGuard; uses the browser policy's allowed sites and focus hours |
| 3 | Anonymous impact report (k ≥ 10), event mode for community sessions, benefit billing for employers | Proof for boards and grant reports; scale |
| 4 | Tagalog and Bisaya, and an organization API scoped to codes and the anonymous report | Reach; larger organizations. **The API for codes, batches and counts is built** ([organization-api.md](organization-api.md)); the anonymous report comes with Phase 3 |

## 3. Phase 1 scope

**In:**

- Any signed-in parent with a verified email can **create an organization** (a school, a community group or a
  business) and becomes its owner. Owners add other eGuard users as admins by email.
- Each organization has a **join code**. A family admin enters it to join; any family admin can leave.
- Organization admins **buy sponsor codes** in batches: a plan (eGuard Plus or Family Pro), a length (1, 3, 6 or
  12 months) and a quantity, paid once through PayMongo Checkout (GCash, Maya, QR Ph, card).
- Organization admins see each batch's codes and whether each has been redeemed, copy or download them, and
  cancel a code that hasn't been used.
- A family admin **redeems a sponsor code** in Settings › Subscription. The family gets the plan for the code's
  months.

**Out:** everything in [section 13](#13-not-in-phase-1), including redeeming codes in the mobile apps.

## 4. Concepts

| Term | Meaning |
|---|---|
| Organization | A school, community group or business. Has admins, a join code and sponsor code batches |
| Organization admin | An eGuard user (a parent account) who manages an organization. `OWNER` or `ADMIN` |
| Join code | `XXXX-XXXX`, one per organization, replaceable. Links a family to the organization |
| Membership | A family's link to an organization. Created by the family, removable by the family |
| Batch | One purchase of sponsor codes: plan, months, quantity, one PayMongo payment |
| Sponsor code | `XXXX-XXXX-XXXX`. One family redeems it once, for the batch's plan and months |

Joining and redeeming are separate on purpose. A family can redeem a code without joining (a code works like a
gift card), and can join without a code.

## 5. Data model

New tables (Prisma). Money is in centavos, as elsewhere.

```prisma
enum OrgKind { SCHOOL COMMUNITY BUSINESS }
enum OrgRole { OWNER ADMIN }

model Organization {
  id        String   @id @default(cuid())
  name      String
  kind      OrgKind
  joinCode  String   @unique
  createdAt DateTime @default(now())
  members     OrgMember[]
  memberships OrgMembership[]
  batches     VoucherBatch[]
}

/// A user who manages an organization. Users stay in their own family; this only adds a role.
model OrgMember {
  orgId  String; userId String; role OrgRole @default(ADMIN); createdAt DateTime @default(now())
  @@id([orgId, userId])
}

/// A family that joined an organization with its join code.
model OrgMembership {
  orgId String; familyId String; joinedAt DateTime @default(now())
  @@id([orgId, familyId])
}

/// One purchase of sponsor codes. Codes are created when PayMongo confirms the payment.
model VoucherBatch {
  id            String   @id            // also the checkout reference
  orgId         String
  plan          String                  // PLUS | PRO
  months        Int                     // 1, 3, 6 or 12
  quantity      Int
  amount        Int                     // total, centavos
  purchaseToken String   @unique        // PayMongo checkout session (cs_…)
  state         String                  // PENDING | PAID | EXPIRED | VOIDED
  paymentId     String?                 // pay_…, to match refunds
  paidAt        DateTime?
  createdBy     String                  // user id
  createdAt     DateTime @default(now())
  vouchers      Voucher[]
}

model Voucher {
  id         String    @id @default(cuid())
  batchId    String
  code       String    @unique          // stored so admins can view and hand out codes
  expiresAt  DateTime                   // redeem by: 12 months after payment
  redeemedAt DateTime?
  /// Kept for support and refunds only; never shown to the organization
  familyId   String?                    // SetNull when the family is deleted
  revokedAt  DateTime?
}
```

Deleting an organization deletes its members, memberships, batches and unredeemed codes. Plans already redeemed
are `StorePurchase` rows owned by the family and aren't touched.

## 6. Flows

### Create and manage an organization

1. Settings › Organizations › **Create an organization**: name and kind. The creator becomes `OWNER`.
2. The organization page shows the join code (copy, replace), the number of families that joined, sponsor codes,
   and admins.
3. The owner adds an admin by the email of an existing eGuard account, and can remove admins. The last owner can't
   be removed.

### Join and leave

1. The family admin enters the join code in Settings › Organizations. eGuard shows the organization's name and
   exactly what it will see (a count), then the family confirms.
2. The family appears in the organization's count. Leaving removes the membership immediately.

### Buy sponsor codes

```
Org admin: plan + months + quantity ─► VoucherBatch (PENDING) + PayMongo checkout session ─► pays (GCash, card…)
      │                                                                                        │
      ◄── back to /organizations/{id}?batch={id}  ──  re-read from PayMongo  ◄── webhook ──────┘
                                                        │
                                             PAID: create `quantity` codes (once)
```

- The checkout has one line item: *"eGuard Plus, 3 months"*, quantity *N*, at months × monthly price each, less
  the batch's volume discount (below). The description names the discount when there is one.

### Volume discounts

Larger batches cost less per code. The discount is set by the number of codes in the batch and applies to every
code in it ([src/lib/batch-discount.ts](../src/lib/batch-discount.ts)):

| Codes in the batch | Discount |
|---|---|
| 1–9 | none |
| 10–49 | 10% |
| 50–99 | 15% |
| 100–200 | 20% |

- The discounted price of one code is rounded to whole centavos, so the checkout total is exactly that × quantity.
  `VoucherBatch.amount` records the discounted total, so refunds and emails need no changes.
- The buy form shows the discount, the saving, and how many codes reach the next tier. It uses the same function as
  the checkout, so the price shown is the price charged.
- Discounts stop at 20% on purpose. Codes can be handed to anyone, so a deeper discount would make it worth buying
  codes in bulk to resell to families below the family price.
- Months don't change the discount: a 12-month code costs 12 × the discounted monthly price.
- Payment is re-read from PayMongo (on return, from the `checkout_session.payment.paid` webhook, and by the
  maintenance job) before codes are created. The `PENDING → PAID` update is conditional, so codes are created once.
- A checkout not paid within 24 hours becomes `EXPIRED`.

### Redeem a code

1. Settings › Subscription › **Have a sponsor code?** (family admin only).
2. eGuard checks the code: exists, not redeemed, not cancelled, not past its redeem-by date, batch `PAID`.
3. The same "one way of paying at a time" rules as buying a pass apply (see section 7).
4. In one transaction: mark the code redeemed by this family, and create the family's purchase.
5. `applyEntitlement` moves the family to the plan. The family gets the usual "Welcome to eGuard Plus" alert.

### Refunds

A `refund.succeeded` for a batch's payment marks the batch `VOIDED` and cancels its **unredeemed** codes. Plans
already redeemed keep running: a family shouldn't lose protection mid-month for something between us and the
organization. Partial refunds are handled by support.

## 7. How codes become a plan

A family's plan already comes only from `StorePurchase` rows, through `applyEntitlement()`
([entitlement.ts](../src/lib/entitlement.ts)). A redeemed code is one more row:

| Field | Value |
|---|---|
| `store` | `VOUCHER` |
| `productId` | `plus_pass_month` or `pro_pass_month` (so `planByProduct` resolves the plan) |
| `purchaseToken` | `voucher:{voucherId}` |
| `state` | `PAID` |
| `expiresAt` | start + code's months, where start is the end of the family's current paid time on the same plan, or now |

Because it's a normal paid row:

- The plan, device limit, "Welcome to…" alert, audit entry and downgrade at the end all work unchanged.
- It stacks like a pass: a code for the plan the family already has extends it.
- The pass reminder 3 days before the end is sent for sponsored plans too.
- `refreshPurchases` never re-checks it with a store (paid rows aren't re-checked, and `VOUCHER` rows are skipped).

**Redeeming is refused when** the family's plan is billed through Google Play, auto-renew is on (turn it off
first; the code's months then start when the paid time ends), or the family has paid time on a *different* plan
(redeem after it ends). These match the rules for buying a pass.

## 8. What each side sees

| | Organization admins | The family |
|---|---|---|
| Families joined | Count only | Which organizations the family joined |
| Codes | Each code: available, redeemed (date), cancelled, expired | Its own redeemed code, as "Sponsored plan" |
| Who redeemed a code | **Never** | n/a |
| Children, devices, settings, activity, location | **Never** | Everything, as today |

The redeeming family is stored on the code for support and refunds only. No screen or export shows it to the
organization.

### Notifications

Sent by [org-notifications.ts](../src/lib/org-notifications.ts). Emails go only to verified addresses, and a failed
send never fails the action.

**Organization admins (email):**

| When | Who | Setting |
|---|---|---|
| Someone is added as an admin | The new admin, and the other admins | Always |
| An admin is removed, or stops managing | The removed admin (unless they left themselves), and the other admins | Always |
| An admin is made owner, or becomes owner because the owner deleted their account | The new owner, and the other admins | Always |
| The join code is replaced (includes the new code) | The other admins | Always |
| An API key is created or revoked | The other admins | Always |
| A batch is paid: codes ready, redeem-by date | All admins | Always |
| A checkout isn't paid within 24 hours | The admin who started it | Always |
| A batch is refunded, with how many unused codes were cancelled | All admins | Always |
| Unused codes are 30 days from their redeem-by date (once per batch) | All admins | Always |
| **Daily activity**: families joined and left, codes redeemed and cancelled, current totals | All admins | Email alerts |

Joins, leaves and redemptions go only into the daily email, never one email per event. The email has counts and
no names, the same as the organization page. The events behind it (`OrgEvent`) have no family column and are
deleted after 30 days.

**Families (an alert in eGuard, plus email):**

| When | Alert | Email |
|---|---|---|
| The family admin joins an organization | "Joined {org}", with what the organization can see | The other parents |
| The family admin leaves | "Left {org}" | The other parents |
| A sponsor code is redeemed | "{plan} sponsored by {org}", with the end date | Every parent, as confirmation |
| A sponsored plan is 3 days from ending | The existing pass reminder | The family admin |

Family emails respect each parent's Email alerts setting.

## 9. Screens

| Where | Who | What |
|---|---|---|
| Settings › **Organizations** (new section) | Every parent sees it; family admin acts | Organizations the family joined (Leave), join with a code; organizations you manage, Create an organization |
| **/organizations/{id}** (new page) | Organization admins | Name and kind, join code (copy, replace), families joined, buy codes (plan, months, quantity, total), batches and codes (copy, download CSV, cancel), admins (add, remove) |
| Settings › **Subscription** | Family admin | "Have a sponsor code?" field. A sponsored plan shows "Sponsored plan" as how it's paid |
| `GET /organizations/{id}/codes.csv` | Organization admins | The batch codes as CSV: code, plan, months, status, redeem by, redeemed on |

Owners can also make another admin an owner, and any admin can stop managing an organization (the last owner
can't). When an owner's account is deleted, the longest-serving admin becomes owner.

## 10. Rules and limits

| Rule | Value |
|---|---|
| Organizations a user can own or manage | 10 |
| Organizations a family can join | 5 |
| Months per code | 1, 3, 6 or 12 |
| Codes per batch | 1 to 200 |
| Redeem by | 12 months after the batch was paid |
| Price | months × plan's monthly web price (the same `webPrice()` as passes) × quantity, less the volume discount: 10% from 10 codes, 15% from 50, 20% from 100 |
| Who creates an organization | A signed-in user with a verified email |
| Who joins, leaves, redeems | The family admin |

## 11. Security

- **Codes are bearer secrets.** Sponsor codes are 12 characters from a 32-character alphabet (60 bits). Join
  codes are 8 characters; a wrong guess only joins an organization, which grants nothing.
- **Guessing is rate-limited** per user and per family for both kinds of code.
- **Every organization action checks membership** on the server (`OrgMember` for the user and organization).
  Pages and the CSV route return 404 for organizations the user doesn't manage.
- **Payments are re-read from PayMongo**, never trusted from the browser or the webhook body, the same as passes.
- **Redemption is atomic:** the code is claimed with a conditional update (`redeemedAt IS NULL`) in the same
  transaction that creates the purchase, so two families can't redeem one code.

## 12. Testing

Service tests in `tests/api/organizations.test.ts`, against the real database and the fake PayMongo:

- create an organization; add and remove admins; the last owner can't be removed; non-members get 404
- join with a code, join twice (idempotent), leave; replaced join codes stop working
- buy a batch: checkout amount = quantity × months × price, and a batch of 50 gets 15% off; codes created once on payment (return and webhook both
  arriving); abandoned checkout expires
- redeem: plan changes and ends at the right time; stacking on the same plan; refused over Google Play,
  auto-renew, or a different plan; a code can't be redeemed twice or after it's cancelled or expired
- refund: unredeemed codes cancelled, redeemed plans kept
- the organization's view never includes a family
- notifications: admin changes and join code replacements reach the right people; payment emails are sent once
  even when the webhook and return both arrive; the daily email has counts, no names, and respects Email
  alerts; expiry and refund emails are sent once; families get alerts, and the other parents get emails

## 13. Not in Phase 1

- Redeeming codes or joining in the **mobile apps**. The apps don't sell plans (Google Play billing policy), and
  codes are a payment. They show the resulting plan as usual.
- Anything organizations can push to families (approved sites, schedules): Phase 2.
- Impact report, event mode, employer invoicing and seat management: Phase 3.
- An organization audit log. Batches record who bought them; families' audit logs record redemptions.
- Push notifications for organization events (push isn't wired up for any alert yet), and an in-app activity
  feed for organization admins. Admins are notified by email.
- Inviting an admin who doesn't have an eGuard account yet. They sign up first, then are added (and emailed).
- Deleting an organization from the UI. Support can do it; codes already redeemed are unaffected.

## 14. Open questions

1. **GCash limits on large batches.** E-wallets cap single payments. Large batches may need card or QR Ph; the
   checkout shows only the methods PayMongo allows for the amount.
2. **Official receipts (BIR)** for organizations that need them: currently through support.
3. ~~**Discounts for large batches.**~~ Done: 10% from 10 codes, 15% from 50, 20% from 100 (see
   [Volume discounts](#volume-discounts)).
