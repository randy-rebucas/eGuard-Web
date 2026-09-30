# eGuard Organization API — v1

For schools, community groups and businesses that manage an organization in eGuard
([organizations.md](organizations.md)) and want their own systems to use its sponsor codes and counts. For
example, an enrollment system can take the next available code for each new student's family and mark codes it
gave out by mistake as cancelled.

- **Base URL:** `https://www.eguard.family/api/org/v1`
- **Format:** JSON, UTF-8. Every response has `Cache-Control: no-store`.
- **Code:** routes in [src/app/api/org/v1/](../src/app/api/org/v1/), logic in [src/lib/org-api.ts](../src/lib/org-api.ts),
  tests in [tests/api/org-api.test.ts](../tests/api/org-api.test.ts).

**What it never returns:** anything about a family. It doesn't return who joined, who redeemed a code, or anything
about children, devices or activity. It only returns codes, batches and counts, the same as the organization page. This
rule has no exceptions and no setting that changes it.

## Contents

1. [Getting a key](#1-getting-a-key)
2. [Authentication](#2-authentication)
3. [Errors](#3-errors)
4. [Rate limits](#4-rate-limits)
5. [Endpoints](#5-endpoints)
6. [Objects](#6-objects)
7. [Recipes](#7-recipes)
8. [Security notes](#8-security-notes)

## 1. Getting a key

1. An admin of the organization whose family is on **Family Pro** opens the organization's page in eGuard
   (Settings › Organizations › Open) and goes to **API access**.
2. They name the key after what will use it ("Enrollment system") and choose its access:

   | Access | Can |
   |---|---|
   | **Read only** (`READ`) | Every `GET` endpoint |
   | **Read and cancel codes** (`WRITE`) | Everything `READ` can, plus `POST /codes/{code}/cancel` |

3. eGuard shows the key **once**. It looks like `egk_` followed by 43 characters. eGuard stores only a hash of it,
   so a lost key can't be shown again. Revoke it and create another.

An organization can have **5** working keys. Every admin gets an email when a key is created or revoked.

**When a key stops working:**

| What happened | Response |
|---|---|
| Any admin revoked it | `401` |
| The admin who created it stopped managing the organization, or their account was deleted | `401` (the key is revoked) |
| That admin's family is no longer on a plan with API access | `403 plan_required`. The key works again if the family returns to Family Pro. The page shows it as **Paused** |

## 2. Authentication

Send the key as a bearer token on every request:

```bash
curl https://www.eguard.family/api/org/v1/organization \
  -H "Authorization: Bearer egk_…"
```

A key belongs to one organization. Every endpoint works on that organization, so there's no organization id in the
path.

## 3. Errors

Every error has the same shape. `error` is written for a person and safe to show.

```json
{ "error": "This key is read-only. Create a key with \"Read and cancel codes\" access to do this.", "code": "forbidden" }
```

| Status | `code` | Meaning |
|---|---|---|
| 400 | `invalid` | A query parameter is wrong. For those, `error` names the parameter |
| 401 | `unauthorized` | Missing, unknown or revoked key |
| 403 | `forbidden` | A read-only key tried to cancel a code |
| 403 | `plan_required` | The key's admin is no longer on a plan with API access |
| 404 | `not_found` | No such code **in this organization**. Codes of other organizations are never found |
| 409 | `conflict` | The code was already redeemed or cancelled |
| 429 | `rate_limited` | Too many requests. Wait and retry |
| 500 | `server_error` | Unexpected. Retry later |

## 4. Rate limits

| Limit | Value |
|---|---|
| Requests per key | 600 per 10 minutes (about one a second on average) |
| Requests with a wrong key, per address | 20 per 15 minutes, then every request from that address gets `429` for the rest of the window |

## 5. Endpoints

| Method and path | Access | Returns |
|---|---|---|
| `GET /organization` | READ | `{ organization }`: the organization and its counts |
| `GET /codes` | READ | `{ codes, next }`: sponsor codes, a page at a time |
| `GET /codes/{code}` | READ | `{ code }`: one code, by its id or the code itself |
| `POST /codes/{code}/cancel` | WRITE | `{ code }`: the code, now cancelled |
| `GET /batches` | READ | `{ batches }`: purchases of codes, newest first |
| `GET /activity` | READ | `{ timezone, days }`: daily counts, up to 30 days |

### `GET /organization`

```json
{
  "organization": {
    "id": "cmg7…",
    "name": "San Isidro Elementary School",
    "kind": "SCHOOL",
    "kindLabel": "School",
    "joinCode": "SCHL-7K2P",
    "createdAt": "2026-09-01T02:00:00.000Z",
    "families": 4,
    "codes": { "total": 15, "available": 10, "redeemed": 3, "cancelled": 1, "expired": 1 },
    "key": { "name": "Enrollment system", "access": "READ" }
  }
}
```

`families` is how many families joined with the join code. `kind` is `SCHOOL`, `COMMUNITY` or `BUSINESS`.

### `GET /codes`

| Parameter | Default | Meaning |
|---|---|---|
| `status` | all | `AVAILABLE`, `REDEEMED`, `CANCELLED` or `EXPIRED` |
| `batchId` | all | Only this batch's codes |
| `limit` | 100 | 1 to 500 |
| `after` | | The `next` value from the previous page |

Codes are sorted by code. `next` is `null` on the last page.

```json
{
  "codes": [
    {
      "id": "cmg8…",
      "code": "H6LL-CTED-3GXM",
      "status": "AVAILABLE",
      "plan": "PLUS",
      "planName": "eGuard Plus",
      "months": 3,
      "batchId": "5b0e…",
      "redeemBy": "2027-09-11T02:00:00.000Z",
      "redeemedAt": null,
      "cancelledAt": null
    }
  ],
  "next": "H6LL-CTED-3GXM"
}
```

Only codes from paid batches are listed. A refunded batch's codes stay listed, with unused ones `CANCELLED`.

### `GET /codes/{code}`

`{code}` is the code's `id`, or the code itself in any case, with or without dashes (`h6ll-cted-3gxm` works).
Returns `{ "code": Code }`.

### `POST /codes/{code}/cancel`

Cancels a code that hasn't been redeemed, e.g. one handed out by mistake. A family trying it afterwards is told
the organization cancelled it. There's no refund for a cancelled code, and it can't be undone. Returns
`{ "code": Code }` with `status: "CANCELLED"`, or `409` if it was already redeemed or cancelled.

The cancellation is recorded in the key's admin's family audit log as done by `API key "<name>"`, and counted in
the admins' daily email.

### `GET /batches`

Paid, refunded and waiting-for-payment purchases. Abandoned checkouts are left out.

```json
{
  "batches": [
    {
      "id": "5b0e…",
      "plan": "PLUS",
      "planName": "eGuard Plus",
      "months": 3,
      "quantity": 10,
      "amount": 447000,
      "currency": "PHP",
      "state": "PAID",
      "createdAt": "2026-09-11T02:00:00.000Z",
      "paidAt": "2026-09-11T02:03:00.000Z",
      "codes": { "total": 10, "available": 6, "redeemed": 3, "cancelled": 1, "expired": 0 }
    }
  ]
}
```

`amount` is in **centavos** (447000 = ₱4,470.00). `state` is `PENDING` (waiting for payment, `codes` is `null`),
`PAID` or `VOIDED` (refunded). Buying codes happens on the organization page, because it needs a person to pay.

### `GET /activity`

| Parameter | Default | Meaning |
|---|---|---|
| `days` | 30 | 1 to 30, ending today |
| `timezone` | `Asia/Manila` | The IANA time zone used to decide which day an event falls on |

```json
{
  "timezone": "Asia/Manila",
  "days": [
    { "date": "2026-09-30", "joined": 0, "left": 0, "redeemed": 1, "cancelled": 0 },
    { "date": "2026-10-01", "joined": 2, "left": 0, "redeemed": 0, "cancelled": 0 }
  ]
}
```

Counts only. eGuard keeps this activity for 30 days, so there's no older history. If you need longer trends, store
the daily numbers yourself.

## 6. Objects

**Code**

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable |
| `code` | string | `XXXX-XXXX-XXXX`, what a family types |
| `status` | string | `AVAILABLE`, `REDEEMED`, `CANCELLED`, `EXPIRED` |
| `plan`, `planName` | string | `PLUS` / `eGuard Plus`, or `PRO` / `Family Pro` |
| `months` | number | 1, 3, 6 or 12 |
| `batchId` | string | |
| `redeemBy` | ISO time | After this, an unused code is `EXPIRED` |
| `redeemedAt` | ISO time or null | When a family redeemed it. **Never which family** |
| `cancelledAt` | ISO time or null | When it was cancelled (by an admin, a key, or a refund) |

Times are ISO-8601 in UTC.

## 7. Recipes

**Give each new family a code** (enrollment system):

```bash
curl "https://www.eguard.family/api/org/v1/codes?status=AVAILABLE&limit=1" -H "Authorization: Bearer $EGUARD_KEY"
```

Record which code you gave out in your own system. eGuard won't tell you later who redeemed it. To avoid handing
the same code out twice, keep track of the codes you've given out rather than relying on `AVAILABLE`, which only
changes when a family redeems the code.

**Check a code a parent says doesn't work:** `GET /codes/{code}`. The `status` says whether it was redeemed,
cancelled or expired.

**Take back a code given out by mistake:** `POST /codes/{code}/cancel` with a WRITE key.

**Weekly report to the school board:** `GET /organization` for totals and `GET /activity?days=7` for the week.

## 8. Security notes

- Treat keys like passwords. Keep them on your server, never in a web page, a mobile app or a shared spreadsheet.
- Give each system its own key, with only the access it needs. Then you can revoke one key without breaking the others.
- Available codes are worth money: anyone with a code can redeem it. A READ key can list them, so protect it as
  carefully as a WRITE key.
- If a key may have leaked, revoke it on the organization page right away. Revoking takes effect on the next
  request.
