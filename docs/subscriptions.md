# Subscriptions and billing

How eGuard plans are sold, paid for, kept in sync with the payment provider, and enforced.

This document covers the server side: data model, flows, state handling, configuration and operations. For the
mobile API's request and response shapes, see [mobile-api.md › 4.14 Subscription](mobile-api.md#414-subscription).

## Contents

1. [Overview](#1-overview)
2. [Plans, products and prices](#2-plans-products-and-prices)
3. [Data model](#3-data-model)
4. [Pass flow (pay once)](#4-pass-flow-pay-once)
5. [Auto-renew flow](#5-auto-renew-flow)
6. [Entitlement rules](#6-entitlement-rules)
7. [Keeping purchases in sync](#7-keeping-purchases-in-sync)
8. [Enforcement](#8-enforcement)
9. [Endpoints and screens](#9-endpoints-and-screens)
10. [Configuration](#10-configuration)
11. [Security](#11-security)
12. [Testing](#12-testing)
13. [Operations and troubleshooting](#13-operations-and-troubleshooting)
14. [Google Play (turned off)](#14-google-play-turned-off)
15. [Known gaps](#15-known-gaps)
16. [Source map](#16-source-map)

---

## 1. Overview

- **All payments happen on the web, through [PayMongo](https://docs.paymongo.com).** The family admin buys in
  Settings › Subscription.
- **The apps show the plan but don't sell it.** Google Play policy generally forbids steering users to outside
  payment for digital subscriptions, so the apps have no buy button and no link to the website. The Google Play
  billing code still exists but is turned off (section 14).
- **There are two ways to pay:**

  | | Auto-renew | Pass (pay once) |
  |---|---|---|
  | PayMongo product | Subscriptions API | Hosted Checkout |
  | Methods | Visa/Mastercard, Maya | GCash, Maya, card, QR Ph, … (configurable) |
  | Renews | Every month or year until turned off | Never; buying again adds another period |
  | Before it ends | Charged automatically | Email and alert 3 days before |

  PayMongo subscriptions only support cards and Maya. GCash users, the majority in the Philippines, buy passes.
- **The server checks every payment with PayMongo itself.** Nothing the browser or a webhook says is trusted. The
  server re-reads the checkout session or subscription from the PayMongo API before it changes a plan.
- **The subscription belongs to the family**, not to one user. Only the `FAMILY_ADMIN` can buy or cancel.
- **The only thing a plan changes is the device limit.** Everything else in the feature list is display only.

```
┌──────────────┐ 1. buy (server action) ┌──────────────┐ 2. checkout session / subscription ┌───────────┐
│ Web browser  │ ─────────────────────► │ eGuard server│ ─────────────────────────────────► │ PayMongo  │
│ Settings ›   │                        │              │ ◄── 4. webhooks (paid, renewed,    │           │
│ Subscription │ ── 3. pay ──────────────────────────────────── card / GCash / Maya ──────► │           │
│              │ ◄── 5. back to ?ref=… ─┤  re-reads from PayMongo, then Family.plan         │           │
└──────────────┘                        └──────────────┘ ◄── 6. cron: re-checks, reminders  └───────────┘
```

---

## 2. Plans, products and prices

Defined in code in [src/lib/plans.ts](../src/lib/plans.ts). There is no plans table.

| Plan | Device limit | Priority support | Sold as |
|---|---|---|---|
| **eGuard Plus** (base plan) | 8 | ✗ | Free; every family starts here and falls back here |
| **eGuard Family** | 15 | ✓ | The four web products below |

Both plans include unlimited children, configuration health checks, protection alerts and advanced reports.

### Web products (`WEB_PRODUCTS`)

| `productId` | Kind | Period |
|---|---|---|
| `family_monthly` | Auto-renew | Month |
| `family_yearly` | Auto-renew | Year |
| `family_pass_month` | Pass | Month |
| `family_pass_year` | Pass | Year |

### Prices

Prices come from env, in pesos, and are the same for auto-renew and passes:

| Variable | Default (placeholder) |
|---|---|
| `PRICE_FAMILY_MONTHLY` | `199` |
| `PRICE_FAMILY_YEARLY` | `1990` |

`webPrice(interval)` returns centavos, which is what PayMongo expects. An invalid value throws, so a typo fails
loudly instead of charging the wrong amount.

**Changing a price:**

- **Passes** use the new price immediately.
- **Auto-renew** needs a PayMongo *plan* per price. `planFor()` looks for a plan named
  `eGuard Family monthly 199.00 PHP` and creates it if it doesn't exist, so a new price creates a new plan on first
  use. **Existing subscribers stay on their old plan and price.** PayMongo applies plan changes only at the next
  cycle, and eGuard doesn't migrate anyone automatically.

---

## 3. Data model

### `Family` (current plan)

| Field | Meaning |
|---|---|
| `plan`, `deviceLimit` | Current plan. Written only by `applyEntitlement` after sign-up. |
| `renewsAt` | End of the paid period of the purchase the plan comes from; `null` on the base plan |
| `paymongoCustomerId` | PayMongo customer (`cus_…`) that auto-renew bills. Created on the first auto-renew. |

### `StorePurchase` (one row per purchase)

| Field | Meaning |
|---|---|
| `store` | `PAYMONGO` (or `GOOGLE_PLAY`) |
| `productId` | One of the web products above |
| `purchaseToken` **unique** | Checkout session id (`cs_…`) for a pass, subscription id (`subs_…`) for auto-renew |
| `state` | See below |
| `autoRenewing` | `true` while PayMongo will charge again (`active`, `past_due`) |
| `expiresAt` | End of the paid period ("paid-through") |
| `paymentId` | Pass only: PayMongo payment id (`pay_…`), to match refunds |
| `remindedAt` | Pass only: when the "ends soon" reminder went out |
| `checkedAt` | Last time the row was re-read from PayMongo |

For a pass, the row `id` is also the checkout `reference_number` and the `?ref=` in the return URL.

### Purchase states

| State | Kind | Set by | Gives access? |
|---|---|---|---|
| `PENDING` | Pass | eGuard | No. Checkout opened, not paid yet. |
| `PAID` | Pass | eGuard | Yes, until `expiresAt` |
| `EXPIRED` | Pass | eGuard | No. Never paid; the checkout expired or is over 24 hours old. **Closed.** |
| `incomplete` | Auto-renew | PayMongo | No. Waiting for the first payment (24 hours at most). |
| `incomplete_cancelled` | Auto-renew | PayMongo / eGuard | No. First payment never came. **Closed.** |
| `active` | Auto-renew | PayMongo | Yes, until `expiresAt` |
| `past_due` | Auto-renew | PayMongo | Yes, until `expiresAt` + 3 days. A renewal failed and PayMongo retries daily, 3 times. |
| `unpaid` | Auto-renew | PayMongo | No. Retries used up. |
| `cancelled` | Auto-renew | PayMongo | Yes, until `expiresAt`. Auto-renew was turned off after paying. |
| `VOIDED` | Pass | eGuard | No. Refunded. **Closed.** |

eGuard never re-checks **closed** states with PayMongo.

---

## 4. Pass flow (pay once)

```
Browser                         eGuard                                   PayMongo
───────                         ──────                                   ────────
"Pay ₱199" ──► buyPass(interval)
                                checks (admin, config, can buy)
                                POST /v2/checkout_sessions ─────────────►
                                  amount, methods, email,
                                  reference_number = row id,
                                  success_url = /settings/subscription?ref=<row id>
                                ◄──────────────────────── cs_…, checkout_url
                                StorePurchase PENDING
◄── redirect to checkout_url
pays with GCash / Maya / card / QR Ph on PayMongo's page ───────────────►
◄── back to /settings/subscription?ref=<row id> ──────────────────────────
page load ──► confirmReturn()
                                GET /v1/checkout_sessions/cs_… ─────────►
                                ◄───────────────────────── payments[status=paid]
                                PAID, expiresAt = start + 1 period
                                applyEntitlement → eGuard Family
◄── "Payment received …"
                                ◄── webhook checkout_session.payment.paid (same check; no-op if already PAID)
```

- **The start date is the end of the family's current paid time, or now if there is none.** Buying early never
  loses days. Two passes back to back give two periods.
- **The paid check runs twice: once when the parent returns to the page, and again from the webhook.** The update
  is conditional (`WHERE state = 'PENDING'`), so only the first one extends the plan.
- **If the parent returns before PayMongo has confirmed the payment**, the page says it's waiting. The webhook or
  the next refresh finishes the purchase.
- **Abandoned checkouts** become `EXPIRED` after 24 hours, or earlier if PayMongo reports the session expired.
- **Refunds**: `refund.succeeded` with the pass's `paymentId` marks it `VOIDED`, and the plan is recomputed straight
  away.

---

## 5. Auto-renew flow

PayMongo has no hosted page for the first subscription payment. The browser completes it with PayMongo's public key,
so **card numbers never reach eGuard's server**.

```
Browser                              eGuard                                  PayMongo
───────                              ──────                                  ────────
"Turn on auto-renew" → card/Maya form
submit ──► startAutoRenew(interval)
                                     checks (admin, config, can buy)
                                     reuse an unfinished one for this period, or cancel it
                                     customer: Family.paymongoCustomerId,
                                       else GET /v1/customers?email=, else POST
                                     planFor(interval, price): find by name, else POST plan
                                     POST /v1/subscriptions ─────────────────►
                                     ◄──── subs_… (incomplete), latest_invoice.payment_intent
                                     StorePurchase incomplete
                                     GET /v1/payment_intents/pi_… ───────────►
                                     ◄──────────────────────────── client_key
◄── { publicKey, paymentIntentId, clientKey, returnUrl }
POST /v1/payment_methods (public key)             ────────────────────────────────────────►
  card details, or type paymaya
POST /v1/payment_intents/pi_…/attach (public key, client_key, return_url) ────────────────►
◄── status: awaiting_next_action → go to next_action.redirect.url (3-D Secure / Maya)
            succeeded / processing → go to returnUrl
            anything else → show last_payment_error
back to /settings/subscription?ref=<row id> ──► confirmReturn()
                                     GET /v1/subscriptions/subs_… ───────────►
                                     active + latest invoice paid →
                                       expiresAt = end of next_billing_schedule (PH time)
                                     applyEntitlement → eGuard Family
                                     ◄── webhooks subscription.activated, subscription.invoice.paid, …
```

### Renewals and failures

PayMongo drafts each renewal invoice a day before the billing date and charges it about 12 hours later. The
webhooks (`subscription.invoice.paid`, `subscription.updated`, …) make eGuard re-read the subscription:

| PayMongo reports | eGuard does |
|---|---|
| `active`, latest invoice `paid` | Moves `expiresAt` to the end of the new `next_billing_schedule` |
| `past_due` | Keeps `expiresAt` and gives 3 days of grace while PayMongo retries |
| `unpaid` | No access once the grace period is over. The family drops to eGuard Plus. |
| `cancelled` | Keeps access until `expiresAt` |

**The paid-through date only moves when the latest invoice is paid.** A renewal that's drafted but unpaid, or that
failed, never adds time.

### Turning auto-renew off

`cancelAutoRenew` calls `POST /v1/subscriptions/{id}/cancel`, which takes effect immediately at PayMongo. The row
becomes `cancelled` with `autoRenewing: false`, and **the family keeps eGuard Family until `expiresAt`**. The page
then shows "Ends on …".

### Retries

Opening the form again within 23 hours reuses the unfinished `incomplete` subscription for the same period, so no
duplicate is created. An unfinished one for the *other* period is cancelled first.

---

## 6. Entitlement rules

Source: [src/lib/entitlement.ts](../src/lib/entitlement.ts). This is shared by every store.

### When a purchase gives access

A purchase gives access when its state is one of the following and `expiresAt` hasn't passed:

- Google Play: `ACTIVE`, `IN_GRACE_PERIOD`, `CANCELED`
- PayMongo: `PAID`, `active`, `cancelled`, and `past_due` (which also gets 3 extra days)

### `applyEntitlement(familyId)`

This is the only function that changes a family's plan after sign-up.

1. Load the family's purchases (except `REPLACED`), with the latest `expiresAt` first.
2. If there are none, stop. Families that never bought anything are never touched.
3. Take the first purchase that gives access:
   - **found:** the plan comes from its product, and `renewsAt = expiresAt`
   - **none:** the family goes back to eGuard Plus (8 devices), with `renewsAt = null`
4. If the plan name changed, write an audit entry and an INFO alert ("Welcome to eGuard Family" or
   "eGuard Family ended").

### One way of paying at a time

`assertCanBuy` enforces this:

| Current purchase | Buy a pass | Start auto-renew |
|---|---|---|
| None | ✓ | ✓ |
| Pass, or auto-renew already turned off | ✓ (extends) | ✗ until the paid time ends. Auto-renew charges immediately, so starting it early would double-bill. |
| Auto-renew on | ✗ (turn it off first) | ✗ |
| Google Play | ✗ | ✗ |

### Display

- `renewalWord(purchase)` returns "Renews" for a purchase that will renew, and "Ends" for a pass or when auto-renew
  is off.
- The settings page shows how the plan is paid: Auto-renew, Auto-renew off, Prepaid pass, or Google Play.

---

## 7. Keeping purchases in sync

eGuard learns about payments in four ways. Each one re-reads the purchase from PayMongo and then runs
`applyEntitlement`.

### 7.1 Return from PayMongo

`/settings/subscription?ref=<row id>` calls `confirmReturn()`, which checks straight away. The parent sees the
result on the next page without waiting for a webhook.

### 7.2 Webhooks

`POST /api/billing/paymongo/webhook` ([route](../src/app/api/billing/paymongo/webhook/route.ts)):

1. It returns `501` unless the PayMongo keys and `PAYMONGO_WEBHOOK_SECRET` are set.
2. It reads the **raw** body and verifies `Paymongo-Signature: t=…,te=…,li=…`:
   - `HMAC-SHA256(secret, "<t>.<raw body>")` in hex
   - it is compared with `te` when using test keys and `li` when using live keys
   - anything else gets `401`
3. Malformed bodies, and events from the other mode (test vs live), get `200` and are ignored, so PayMongo doesn't
   retry them.
4. `handlePaymongoEvent` then acts on the event type:

| Event | Action |
|---|---|
| `checkout_session.payment.paid` | Re-read that checkout; mark the pass `PAID` |
| `subscription.*` (activated, updated, past_due, unpaid, invoice.*) | Find the subscription (from the event, the invoice's `subscription_id`, or the customer's open subscriptions) and re-read it |
| `refund.succeeded` (and `refund.updated` once succeeded) | Mark the pass with that `payment_id` `VOIDED` |
| Anything else | Ignored (`200`) |

5. If PayMongo can't be reached while re-reading, the route returns `503` and PayMongo retries (up to 12 times with
   backoff).

A replayed or duplicated delivery only triggers another re-read, so there's no event-id log and no timestamp window.

### 7.3 Lazy refresh

`refreshPurchases(familyId)` ([billing.ts](../src/lib/billing.ts)) runs:

- on the settings page
- on `GET /api/mobile/v1/subscription`
- before adding a device
- before device pairing

It re-reads only the purchases that are due:

| Purchase | Re-read |
|---|---|
| Pending pass, unfinished auto-renew, or a purchase past its paid period | At most every 10 minutes |
| Auto-renew within its paid period | Once a day |
| Paid pass | Never (refunds come by webhook) |
| Closed, or more than 30 days past its paid period | Never |

PayMongo errors keep the last known state.

### 7.4 Maintenance job

`/api/cron/maintenance` (every 5–15 minutes) does two things for billing:

- `refreshAllPurchases()`: runs the lazy refresh for every family with open purchases, which also downgrades
  families whose pass just ran out
- `sendPassReminders()`: sends a reminder once per pass, **3 days before it ends**, unless the family has already
  extended or subscribed. The reminder is:
  - an INFO alert: "eGuard Family ends on …"
  - an email to family admins with a verified email address, with a "Keep eGuard Family" button

---

## 8. Enforcement

`Family.deviceLimit` is checked when adding a device ([family-service.ts](../src/lib/family-service.ts)) and when a
device pairs ([pair route](../src/app/api/device/v1/pair/route.ts)), each after a lazy refresh.

**Downgrades never remove devices.** Devices over the limit stay protected; the family just can't add more.

`priority_support` is shown in the feature list but not enforced.

---

## 9. Endpoints and screens

### Web (family admin)

| What | Where |
|---|---|
| Plan, renewal, device usage, how it's paid | Settings › Subscription ([page](../src/app/(app)/settings/[section]/page.tsx)) |
| Choose monthly or yearly; Auto-renew or Pay once | `BuyPlan` ([components/billing.tsx](../src/components/billing.tsx)) |
| Pay once | Server action `buyPass(interval)` → redirect to PayMongo Checkout |
| Auto-renew | Server action `startAutoRenew(interval)`, then the browser calls PayMongo |
| Turn off auto-renew | Server action `cancelAutoRenew()` (asks to confirm first) |
| Result after paying | Banner on `?ref=`: paid, waiting for confirmation, or didn't go through |

Server actions: [src/app/actions/billing.ts](../src/app/actions/billing.ts).

Other parents see the plan and "Only the family admin can change the plan." Without PayMongo keys, the page says
online payment isn't available and links to support.

### Server-to-server

| Endpoint | Caller | Auth |
|---|---|---|
| `POST /api/billing/paymongo/webhook` | PayMongo | `Paymongo-Signature` HMAC |
| `GET/POST /api/cron/maintenance` | Scheduler | `Bearer $CRON_SECRET` |

### Mobile apps

`GET /subscription` returns the plan, usage and renewal as before.

- `billingAvailable` is `false` while Google Play is turned off, so the apps show no buy button.
- `store.name` is `PAYMONGO` for web purchases.

---

## 10. Configuration

| Variable | Purpose |
|---|---|
| `PAYMONGO_SECRET_KEY` | `sk_test_…` or `sk_live_…`. Server only. |
| `PAYMONGO_PUBLIC_KEY` | `pk_test_…` or `pk_live_…`. Sent to the browser for the auto-renew payment. It must be the same mode as the secret key, or billing stays off. |
| `PAYMONGO_WEBHOOK_SECRET` | The webhook endpoint's secret key |
| `PAYMONGO_PASS_METHODS` | Methods offered for passes. Default `gcash,paymaya,card,qrph`. Other values: `grab_pay`, `shopee_pay`, `billease`, `dob`, `brankas`. |
| `PRICE_FAMILY_MONTHLY`, `PRICE_FAMILY_YEARLY` | Prices in pesos |
| `APP_URL` | Used for checkout success, cancel and return URLs, and in reminder emails. Must be the public HTTPS URL in production. |
| `CRON_SECRET` | Maintenance job (refresh and reminders) |

### Setup checklist

**PayMongo account**

1. Create the account and finish verification (KYC, business documents). Live keys only work once the account is
   activated.
2. Activate the payment methods you'll offer (Settings › Payment Methods). Every method in
   `PAYMONGO_PASS_METHODS` must be active, or checkout creation fails.
3. **Ask PayMongo support (support@paymongo.com) to enable Subscriptions** for the account. It's off by default,
   and auto-renew fails without it. Passes work without it.

**Webhook**

4. Developers › Webhooks: add `https://<your-host>/api/billing/paymongo/webhook` for these events:
   - `checkout_session.payment.paid`
   - `subscription.activated`, `subscription.updated`, `subscription.past_due`, `subscription.unpaid`
   - `subscription.invoice.paid`, `subscription.invoice.payment_failed`
   - `refund.succeeded`

   Copy the secret into `PAYMONGO_WEBHOOK_SECRET`. Test and live modes need **separate** endpoints and secrets.

**Server**

5. Set the keys and prices, check that `APP_URL` is right, and schedule the maintenance job.
6. Leave `GOOGLE_PLAY_PACKAGE_NAME` and `GOOGLE_PLAY_SERVICE_ACCOUNT` empty, so the apps don't sell.

For local development without a public URL, the return-page check (7.1) and the lazy refresh still complete
purchases. To test webhooks locally, use a tunnel (for example `cloudflared` or `ngrok`) and register its URL in
test mode.

---

## 11. Security

| Threat | Protection |
|---|---|
| Card data on eGuard's servers | Card details go from the browser straight to PayMongo using the public key. The server only sees ids. PayMongo's hosted checkout handles passes. |
| Faked "I paid" | The server never trusts the browser, the `?ref=` or the webhook body. It re-reads the checkout session or subscription with the secret key. |
| Forged or replayed webhooks | HMAC signature over the raw body, checked against the key's mode. A replay only triggers another re-read. |
| Test payments unlocking live plans | Keys must be the same mode; the webhook drops events from the other mode; a test signature (`te`) isn't accepted with live keys. |
| Another family's purchase | Every lookup is scoped to the signed-in family (`confirmReturn`). Purchases are created server-side with the family id. |
| Paying twice | One way of paying at a time (section 6); a retried auto-renew reuses the unfinished subscription; conditional updates stop double extensions. |
| Non-admin buying or cancelling | Admin only, checked in the service layer. |
| Price tampering | Prices come from server env; the browser only chooses month or year. |
| PayMongo outage | Errors keep the last known state and never downgrade anyone. Failed webhooks are retried by PayMongo. |

Keep `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` out of the repo. Rotate them in the PayMongo dashboard if
they leak.

---

## 12. Testing

### Automated

`tests/api/web-billing.test.ts` runs against a fake PayMongo API ([tests/fake-paymongo.ts](../tests/fake-paymongo.ts))
and the real database:

```sh
npx vitest run -c vitest.api.config.ts tests/api/web-billing.test.ts tests/api/billing.test.ts
```

| Area | Covered |
|---|---|
| Helpers | Config (mixed modes rejected), webhook signatures (mode, tampering, wrong secret), event parsing, period arithmetic, env prices |
| Passes | Admin only; 501 without config; checkout and pending return; paid via webhook; repeated webhook adds nothing; second pass extends; auto-renew blocked while time is left; refunds; abandoned checkouts; no sale over Google Play |
| Auto-renew | First payment details; retry reuses the subscription; activation; no pass while on; renewal moves the date; past-due grace with no extra time; unpaid drops the plan; turning off keeps the paid period |
| Reminders | Sent once, 3 days before; skipped when extended |

### Manual, in PayMongo test mode

Use test keys. Useful card numbers (any future expiry, any CVC):

| Card | Result |
|---|---|
| `4343 4343 4343 4345` | Paid, no 3-D Secure |
| `4120 0000 0000 0007` | 3-D Secure: choose Authorize or Fail. **Use this one to activate a subscription.** |
| `5123 0000 0000 0001` | Subscription activates, then the next cycle fails (`past_due`, then `unpaid`) |
| `4111 1111 1111 1111` | Declined |

- **GCash and Maya** in test mode open a PayMongo test page; choose Authorize or Fail.
- **QR Ph** test codes are real: **don't scan and pay them.** Use the `test_url` instead.
- **To run a renewal right away**, call PayMongo's
  [Create a new test Subscription cycle](https://docs.paymongo.com/reference/trigger-a-new-subscription-cycle)
  endpoint.

---

## 13. Operations and troubleshooting

### Where to look

- **Audit log**: `purchase.paid`, `purchase.verified` (auto-renew activated), `autorenew.cancelled`,
  `purchase.voided`, `plan.changed`
- **`StorePurchase`** rows for the family: `state`, `expiresAt` and `checkedAt` show what eGuard last saw
- **Server logs**: `[paymongo] <method> <path> <status> <code>`, `[billing] PayMongo webhook failed`,
  `[billing] pass reminder failed`
- **Cron response**: `purchases: { families, failed }`, `passReminders: { due, sent }`
- **PayMongo dashboard**: payments, subscriptions, and webhook delivery attempts (which can be retried)

### Common problems

| Symptom | Likely cause |
|---|---|
| Page says online payment isn't available | Keys missing, or a test key paired with a live key |
| "PayMongo refused the request" when buying a pass | A method in `PAYMONGO_PASS_METHODS` isn't activated, or the account isn't live yet |
| "PayMongo refused the request" when starting auto-renew | Subscriptions aren't enabled on the account (ask PayMongo support) |
| Paid, but the page keeps saying "waiting" | Webhook not registered or failing (check delivery attempts in the dashboard). Reload; the lazy refresh re-checks every 10 minutes. |
| Webhook returns `401` | Wrong `PAYMONGO_WEBHOOK_SECRET` (each endpoint and mode has its own), or a proxy altered the body |
| Webhook returns `501` | `PAYMONGO_WEBHOOK_SECRET` or the keys aren't set |
| Card attach error in the browser | PayMongo's own message is shown (for example an invalid card number, or a declined card) |
| Still on Family after turning auto-renew off | Expected until the end of the paid period |

### Refunds

- **Pass:** refund it in the PayMongo dashboard. `refund.succeeded` ends the pass straight away.
- **Auto-renew invoice:** not matched automatically (section 15). Refund in the dashboard, cancel the subscription,
  and the plan ends at `expiresAt`. To end it immediately, set that row's `state` to `VOIDED` and reload the page.

### Granting a plan manually

There is no admin tool. Editing `Family.plan` and `deviceLimit` works only for families **with no purchases**:
`applyEntitlement` recomputes the plan for any family that has purchase rows, including abandoned checkouts.

---

## 14. Google Play (turned off)

The Android in-app purchase path from before web billing is still in the code:

- [google-play.ts](../src/lib/google-play.ts)
- `redeemGooglePlay` and `handlePlayNotification` in [billing.ts](../src/lib/billing.ts)
- `POST /api/mobile/v1/subscription/google-play`
- `POST /api/billing/google-play/notifications`

With `GOOGLE_PLAY_PACKAGE_NAME` and `GOOGLE_PLAY_SERVICE_ACCOUNT` empty:

- `billingAvailable` is `false` and `/subscription/plans` returns `googlePlay: null`, so the app shows no buy button
- redeem returns `501`
- the notifications endpoint returns `501`

To turn it back on, set those variables plus `GOOGLE_PLAY_RTDN_AUDIENCE` and `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT`.
Then:

- set `obfuscatedAccountId` in the billing flow
- acknowledge purchases on the server, not in the app
- expect Google's re-check timing (every 10 minutes after expiry, daily while active)

Google Play purchases share `StorePurchase` and `applyEntitlement` with web purchases. A family with an active Play
plan can't buy on the web.

---

## 15. Known gaps

- **Refunds of auto-renew invoices aren't matched automatically.** Only a pass records its payment id. See
  section 13 for the manual steps.
- **No way to change the card for auto-renew.** PayMongo supports it, but eGuard doesn't expose it yet. A parent with
  an expiring card turns auto-renew off and on again after the paid period, or buys passes.
- **No switching between monthly and yearly auto-renew.** Turn it off, and start the other once the paid time ends.
- **Existing subscribers keep their old price** when the price changes (section 2).
- **No receipts in eGuard.** PayMongo emails receipts for passes (`send_email_receipt`). Subscription invoices follow
  the PayMongo account's own email settings.
- **iOS and in-app purchases are off.** See section 14.
- **`priority_support` isn't enforced.**

---

## 16. Source map

| File | Role |
|---|---|
| [src/lib/plans.ts](../src/lib/plans.ts) | Plans, web products, env prices |
| [src/lib/paymongo.ts](../src/lib/paymongo.ts) | PayMongo API client: checkout, customers, plans, subscriptions, payment intents, webhook signature |
| [src/lib/web-billing.ts](../src/lib/web-billing.ts) | Passes, auto-renew, return check, webhook handling, reminders |
| [src/lib/entitlement.ts](../src/lib/entitlement.ts) | Which purchase gives access; `applyEntitlement` |
| [src/lib/billing.ts](../src/lib/billing.ts) | `refreshPurchases` (all stores); Google Play redeem and notifications |
| [src/app/actions/billing.ts](../src/app/actions/billing.ts) | Server actions: buy pass, start and cancel auto-renew |
| [src/components/billing.tsx](../src/components/billing.tsx) | Buy panel and card/Maya form; turn off auto-renew |
| [src/app/(app)/settings/[section]/page.tsx](../src/app/(app)/settings/[section]/page.tsx) | Settings › Subscription |
| [src/app/api/billing/paymongo/webhook/route.ts](../src/app/api/billing/paymongo/webhook/route.ts) | PayMongo webhooks |
| [src/lib/maintenance.ts](../src/lib/maintenance.ts) | Refresh and pass reminders in the maintenance job |
| [prisma/schema.prisma](../prisma/schema.prisma) | `Family` plan fields, `StorePurchase` |
| [tests/api/web-billing.test.ts](../tests/api/web-billing.test.ts), [tests/fake-paymongo.ts](../tests/fake-paymongo.ts) | Web billing tests |
| [tests/api/billing.test.ts](../tests/api/billing.test.ts) | Google Play tests |
