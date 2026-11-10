# Setting Up PayMongo

## Summary

The PayMongo set-up procedure explains how the engineering team sets up PayMongo, the payment provider for every eGuard plan purchase, so that passes and auto-renew work on the web. It covers the PayMongo account (verification, payment methods and Subscriptions), the webhook, and the server configuration, and lists the common problems and their causes. All eGuard payments happen on the web, in Settings › Subscription, and only the family admin can buy; the apps show the plan but do not sell it. The server never trusts the browser or a webhook body: it re-reads every checkout or subscription from PayMongo before it changes a plan. Test mode and live mode need separate keys, webhook endpoints and secrets.

## Purpose of the PayMongo set-up procedure

The purpose of the PayMongo set-up procedure is to make plan purchases work reliably and safely: parents can pay with GCash, Maya, QR Ph or a card for a pass, or with a card or Maya for auto-renew, and eGuard learns about every payment, renewal and refund. A wrong key, missing payment method or missing webhook leaves parents unable to pay, or paid but still waiting for their plan.

## When the PayMongo set-up procedure applies

The PayMongo set-up procedure applies when:

- a new environment (production, a preview or a developer machine) needs billing;
- billing moves from PayMongo test mode to live mode;
- keys or the webhook secret are rotated, for example after a leak;
- a payment method is added to or removed from the methods offered for passes.

The procedure does not cover refunds (see "Refunding a Purchase"), price changes (see "Releasing a Plan-Limit or Price Change") or Google Play Billing, which is turned off.

## Roles involved in PayMongo set-up

| Role | Responsibility |
|---|---|
| PayMongo account holder | Creates the account, completes verification (KYC and business documents) and asks PayMongo support to enable Subscriptions. [TO CONFIRM: who holds the PayMongo account] |
| Engineering | Activates payment methods, registers the webhook, sets server variables, tests the set-up. [TO CONFIRM: which role or person] |
| Owner | Approves going live with real charges. [TO CONFIRM: approver] |

## Inputs needed before PayMongo set-up

| Input | Detail |
|---|---|
| A PayMongo account | Verified and activated; live keys only work once the account is activated |
| Business documents | For PayMongo's verification [TO CONFIRM: which documents] |
| The public HTTPS address of the environment | `https://www.eguard.family` in production |
| Server access | To set environment variables (Vercel for production) |
| The maintenance cron | Scheduled and protected by `CRON_SECRET` |

## PayMongo configuration variables

PayMongo set-up uses these server variables. Values, including keys and secrets, are never written into documents or the code repository.

| Variable | Purpose |
|---|---|
| `PAYMONGO_SECRET_KEY` | PayMongo secret key, test or live. Server only |
| `PAYMONGO_PUBLIC_KEY` | PayMongo public key, sent to the browser for the auto-renew payment. Must be the same mode (test or live) as the secret key, or billing stays off |
| `PAYMONGO_WEBHOOK_SECRET` | The webhook endpoint's secret key |
| `PAYMONGO_PASS_METHODS` | Payment methods offered for passes. Default: GCash, Maya, card and QR Ph |
| `PRICE_PLUS_MONTHLY`, `PRICE_PRO_MONTHLY`, `PRICE_PLUS_YEARLY`, `PRICE_PRO_YEARLY` | Prices in Philippine pesos (₱). The approved prices are in "Products and Services Catalogue" |
| `APP_URL` | Checkout success, cancel and return addresses, and reminder emails. Must be the public HTTPS address in production |
| `CRON_SECRET` | The maintenance job that refreshes purchases and sends reminders |
| `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT` | Left empty, so the apps do not sell |

## Procedure: setting up the PayMongo account

1. The PayMongo account holder creates the account and completes verification (KYC and business documents). If the account is not yet activated, then only test keys work; continue in test mode and come back to this step before going live.
2. Engineering activates each payment method to be offered in PayMongo › Settings › Payment Methods. Every method listed in `PAYMONGO_PASS_METHODS` must be active, or checkout creation fails.
3. The PayMongo account holder asks PayMongo support (support@paymongo.com) to enable Subscriptions for the account. Subscriptions are off by default. Without them, auto-renew fails; passes still work.

## Procedure: registering the PayMongo webhook

1. Engineering opens PayMongo › Developers › Webhooks and adds the endpoint `https://<host>/api/billing/paymongo/webhook` (in production, `https://www.eguard.family/api/billing/paymongo/webhook`).
2. Engineering subscribes the endpoint to these events:
   - `checkout_session.payment.paid`
   - `subscription.activated`, `subscription.updated`, `subscription.past_due`, `subscription.unpaid`
   - `subscription.invoice.paid`, `subscription.invoice.payment_failed`
   - `refund.succeeded`
3. Engineering copies the endpoint's secret into `PAYMONGO_WEBHOOK_SECRET`.
4. If the environment uses both test and live mode, then engineering registers a separate endpoint for each mode, each with its own secret.

## How the eGuard PayMongo webhook handles events

The eGuard webhook (`POST /api/billing/paymongo/webhook`) behaves as follows, which helps when reading delivery attempts in the PayMongo dashboard:

| Situation | Response |
|---|---|
| PayMongo keys or `PAYMONGO_WEBHOOK_SECRET` not set | `501` |
| Signature does not match (wrong secret, wrong mode, or a body changed in transit) | `401` |
| Malformed body, or an event from the other mode | `200`, ignored, so PayMongo does not retry |
| `checkout_session.payment.paid` | Re-reads the checkout and marks the pass paid |
| `subscription.*` events | Finds and re-reads the subscription |
| `refund.succeeded` (and `refund.updated` once succeeded) | Marks the refunded pass as voided |
| Any other event | `200`, ignored |
| PayMongo cannot be reached while re-reading | `503`; PayMongo retries up to 12 times with backoff |

A repeated delivery only triggers another re-read, so duplicates do no harm.

## Procedure: configuring and testing the server for PayMongo

1. Engineering sets `PAYMONGO_SECRET_KEY`, `PAYMONGO_PUBLIC_KEY` (same mode), `PAYMONGO_WEBHOOK_SECRET`, `PAYMONGO_PASS_METHODS` if the default methods change, and the price variables.
2. Engineering checks that `APP_URL` is the public HTTPS address and that the maintenance job is scheduled.
3. Engineering leaves `GOOGLE_PLAY_PACKAGE_NAME` and `GOOGLE_PLAY_SERVICE_ACCOUNT` empty.
4. Engineering opens Settings › Subscription as a family admin and checks that the page offers payment. If the page says online payment is not available, then go to "Common PayMongo problems and causes".
5. In test mode, engineering buys a pass and starts auto-renew with PayMongo's published test cards and test pages (the cards to use are listed in subscriptions.md §12). GCash and Maya open a PayMongo test page with Authorize or Fail. QR Ph test codes are real: never scan and pay them; use the test URL instead. A renewal can be run at once with PayMongo's "Create a new test Subscription cycle" endpoint.
6. In live mode, engineering makes one real purchase and refunds it (see "Production Go-Live Checks" and "Refunding a Purchase").

For local development without a public address, the return-page check and the lazy refresh still complete purchases. To test webhooks locally, a tunnel (for example `cloudflared` or `ngrok`) is registered in test mode.

## Common PayMongo problems and causes

| Symptom | Likely cause |
|---|---|
| Page says online payment isn't available | Keys missing, or a test key paired with a live key |
| "PayMongo refused the request" when buying a pass | A method in `PAYMONGO_PASS_METHODS` is not activated, or the account is not live yet |
| "PayMongo refused the request" when starting auto-renew | Subscriptions are not enabled on the account; ask PayMongo support |
| Paid, but the page keeps saying "waiting" | Webhook not registered or failing; check delivery attempts in the PayMongo dashboard. Reloading helps: the lazy refresh re-checks an unfinished payment every minute |
| Webhook returns `401` | Wrong `PAYMONGO_WEBHOOK_SECRET` (each endpoint and mode has its own), or a proxy altered the body |
| Webhook returns `501` | `PAYMONGO_WEBHOOK_SECRET` or the keys are not set |
| Card attach error in the browser | PayMongo's own message is shown, for example an invalid or declined card |
| Still on eGuard Family after turning auto-renew off | Expected until the end of the paid period |

Other places to look: the eGuard audit log (`purchase.paid`, `purchase.verified`, `autorenew.cancelled`, `purchase.voided`, `plan.changed`), the family's `StorePurchase` rows, server logs starting `[paymongo]` or `[billing]`, and the cron response (`purchases`, `passReminders`).

## Approvals required for PayMongo set-up

| What | Who approves | Limit |
|---|---|---|
| Switching production to live keys | [TO CONFIRM: approver] | Account verified and activated first |
| Real-money test purchase | [TO CONFIRM: approver] | One purchase, refunded |
| Adding payment methods for passes | [TO CONFIRM: approver] | Each method must be active in PayMongo first |

## Exceptions in PayMongo set-up and what to do

| Situation | What to do |
|---|---|
| A key or the webhook secret may have leaked | Rotate it in the PayMongo dashboard and update the server variable; keep `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` out of the repository |
| PayMongo outage | Nothing to undo: errors keep the last known state and never downgrade anyone; PayMongo retries failed webhooks |
| A parent needs a plan without paying | There is no admin tool; editing the family's plan works only for families with no purchases. [TO CONFIRM: who may grant a plan manually] |

## Outputs of PayMongo set-up and where they are recorded

| Output | Where it is recorded |
|---|---|
| Account, methods, Subscriptions, webhook endpoints | PayMongo dashboard |
| Keys, secret, methods and prices | Server environment variables (Vercel › Production for production) |
| Set-up record | [TO CONFIRM: where configuration changes are logged] |

## Time targets for PayMongo set-up

| Step | Target |
|---|---|
| PayMongo verification and enabling Subscriptions | [TO CONFIRM: PayMongo's turnaround] |
| Webhook retries on `503` | Up to 12 retries with backoff |
| Lazy refresh of an unfinished payment | At most every minute |
| Pass reminder | 3 days before the pass ends |

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Refunding a Purchase; Releasing a Plan-Limit or Price Change; Production Go-Live Checks; Products and Services Catalogue; Pricing and Discount Rules; Systems Overview |

## Open questions

1. Owner role, effective date and review date of this procedure are not stated in the sources.
2. Who holds the PayMongo account, who sets up and tests billing, who approves live keys, the real-money test purchase and new payment methods, and who may grant a plan manually.
3. Which business documents PayMongo verification needs, and how long verification and enabling Subscriptions take.
4. Where configuration changes are logged.
5. subscriptions.md §10's configuration table lists only `PRICE_PLUS_MONTHLY` and `PRICE_PRO_MONTHLY`, while §2 also lists `PRICE_PLUS_YEARLY` and `PRICE_PRO_YEARLY`. This document lists all four.
6. subscriptions.md §7.2 says the webhook acts on `refund.updated` once a refund has succeeded, but the §10 set-up list does not subscribe to `refund.updated`. Confirm whether it should be registered.
7. subscriptions.md §7.4 says the maintenance job runs "every 5–15 minutes"; launch-visibility.md and features/parent-care.md say every 10 minutes.
8. subscriptions.md §4's pass-flow diagram shows "Pay ₱199", which matches no price in any price table (source inventory contradiction 15).
9. PayMongo's test card numbers were left out of this document on purpose; subscriptions.md §12 lists them.
