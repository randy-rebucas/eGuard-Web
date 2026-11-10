# Refunding a Purchase

## Summary

The refund procedure describes how eGuard staff refund a purchase made through PayMongo: a pass (one month or one year paid once), an auto-renew invoice, or an organization's batch of sponsor codes. It is for the staff who handle support requests and the staff who have access to the PayMongo dashboard. Every refund is issued in the PayMongo dashboard, because the console (staff back office) cannot issue refunds in version 1. A refunded pass ends straight away; a refunded auto-renew invoice is not matched automatically and needs manual steps; a refunded batch cancels only its unredeemed sponsor codes. Who may approve a refund, and up to what amount, is not yet set and is marked [TO CONFIRM].

## Purpose of the refund procedure

The refund procedure makes sure that money returned to a family or an organization through PayMongo is matched by the right change in eGuard: the purchase is closed, the family's plan is recalculated, and nobody loses protection unexpectedly. It also records where each refund can be traced afterwards.

## When the refund procedure applies, and when it does not

The refund procedure applies to:

- a **pass** bought by a family admin on the web (Settings › Subscription), paid with GCash, Maya, QR Ph or card;
- an **auto-renew invoice** charged to a card or Maya;
- a **sponsor-code batch** bought by an organization admin, refunded in full or in part.

The refund procedure does not apply to:

- **Turning auto-renew off.** A family admin does that in Settings › Subscription; the family keeps its plan until the end of the paid period, and no money is returned.
- **A sponsor code cancelled by its organization.** An organization admin can cancel an unredeemed code, but there is no refund for a cancelled code and the cancellation cannot be undone (organization-api.md).
- **Google Play purchases.** Google Play billing is turned off; how a refund of a legacy Google Play purchase is handled is [TO CONFIRM: refund route for legacy Google Play purchases].
- **The Windows launch offer** (eGuard's own free month of eGuard Plus), which involves no payment.
- **Granting a plan by hand.** There is no admin tool for that; see "Exceptions to the refund procedure".

## Roles involved in a refund

| Role | Responsibility |
|---|---|
| Family admin | Asks for a refund of the family's pass or auto-renew invoice. Only the family admin can buy or cancel the family's plan. |
| Organization admin | Asks for a refund of a sponsor-code batch. |
| Support staff | Receive the request (support inbox or a support ticket in the console), look up the family or organization in the console, reply to the customer from the support inbox. |
| Staff member with PayMongo dashboard access | Issues the refund in the PayMongo dashboard and checks webhook delivery. [TO CONFIRM: which role holds PayMongo dashboard access] |
| Engineer with production database access | Ends an auto-renew plan immediately when that is required (sets the purchase to `VOIDED`). [TO CONFIRM: which role may edit production purchase records] |
| Refund approver | Approves the refund before it is issued. [TO CONFIRM: approver role and approval limits] |

## Inputs needed before starting a refund

1. The request in writing, from the family admin's or organization admin's sign-in email, through the support inbox (support@devcomdigital.com) or a support ticket.
2. The family or organization, found in the console: `/families/[id]` shows the family's purchases and the plan, with "renews" or "ends"; `/organizations/[id]` shows the organization's code batches and how many codes were redeemed.
3. The PayMongo payment for the purchase, found in the PayMongo dashboard.
4. For a partial batch refund: the number of codes to refund and which codes are still unredeemed.
5. The refund approval, where one is required (see "Approvals required for a refund").
6. The reason the customer gives, and whether it meets the refund terms in the website's Terms. [TO CONFIRM: refund eligibility rules in the Terms, for example time limits]

## Refund procedure, steps 1 to 5: checking the request

1. **Support staff (support inbox or console › Tickets):** confirm the request came from the family admin of the family, or from an admin of the organization. If it came from another parent, then reply that only the family admin can act on the plan and stop.
2. **Support staff (console › Families or Organizations):** open the family or organization and note the purchase to refund, its plan, its period and how it was paid (pass, auto-renew, sponsored plan or batch). Opening the record writes an audit entry (`family.view` or `organization.view`).
3. **Support staff:** if the purchase is a pass, then go to step 6. If it is an auto-renew invoice, then go to step 10. If it is a sponsor-code batch, then go to step 15. If it is anything else, then go to "Exceptions to the refund procedure".
4. **Support staff:** tell the family admin what the refund will change, before it is issued (see "What a refund changes for the family").
5. **Refund approver:** approve or decline the refund. If declined, then support staff reply to the customer and stop.

## Refund procedure, steps 6 to 9: refunding a pass

6. **Staff member with PayMongo access (PayMongo dashboard):** refund the pass's payment.
7. **System (eGuard server):** PayMongo sends `refund.succeeded`; eGuard matches it to the pass by its payment id, marks the pass `VOIDED` and recalculates the family's plan straight away.
8. **Support staff (console › Families):** reload the family and check that the pass shows as ended and the plan has changed. If it has not changed, then check the webhook delivery attempts in the PayMongo dashboard and retry the failed delivery. A paid pass is never re-checked with PayMongo on its own, so a refund that never arrives by webhook is never seen.
9. **Support staff (support inbox):** confirm the refund to the family admin. Go to step 19.

## Refund procedure, steps 10 to 14: refunding an auto-renew invoice

10. **Staff member with PayMongo access (PayMongo dashboard):** refund the invoice's payment. eGuard does not match refunds of auto-renew invoices automatically; only a pass records its payment id.
11. **Staff member with PayMongo access:** cancel the subscription so that it is not charged again. [TO CONFIRM: whether staff cancel it in the PayMongo dashboard or ask the family admin to turn auto-renew off in Settings › Subscription]
12. **Refund approver or support staff:** decide whether the plan should end now or at the end of the paid period. By default the plan ends at the end of the paid period. If it must end now, then go to step 13; otherwise go to step 14.
13. **Engineer (production database):** set that purchase's state to `VOIDED`, then reload Settings › Subscription for the family so that the plan is recalculated.
14. **Support staff (console › Families):** check the plan shows "ends" on the expected date, or has changed, then confirm the refund to the family admin. Go to step 19.

## Refund procedure, steps 15 to 18: refunding a sponsor-code batch

15. **Support staff (console › Organizations):** check how many of the batch's codes were redeemed. Plans already redeemed keep running after a refund: a family should not lose protection mid-month for something between eGuard and the organization.
16. **Support staff:** if the organization wants a full refund, then go to step 17. If it wants a partial refund, then go to step 18.
17. **Staff member with PayMongo access (PayMongo dashboard):** refund the batch's payment. On `refund.succeeded`, eGuard marks the batch `VOIDED` and cancels its unredeemed codes; every organization admin gets an email saying how many unused codes were cancelled. Go to step 19.
18. **Support staff:** handle the partial refund by hand. The sources say only that "partial refunds are handled by support". [TO CONFIRM: steps for a partial batch refund, including whether codes are cancelled first and how the refunded amount is worked out from the batch's discounted total]

## Refund procedure, step 19: closing the request

19. **Support staff (console › Tickets):** close the support ticket, if there is one, and keep the reply in the support inbox.

## What a refund changes for the family

When a refund moves a family to a smaller plan, nothing is removed. Children and devices over the new limit stay protected, but the family cannot add more until it is back within the limit or upgrades. Current locations are cleared when location sharing ends; location history is kept but hidden until the family upgrades. The family gets an alert when the plan name changes (for example "eGuard Family ended"). The plan limits themselves are in "Products and Services Catalogue".

## Approvals required for a refund

| What | Who approves | Limit |
|---|---|---|
| Refund of a pass | [TO CONFIRM: approver role] | [TO CONFIRM: amount limit in Philippine pesos (₱)] |
| Refund of an auto-renew invoice | [TO CONFIRM: approver role] | [TO CONFIRM: amount limit in Philippine pesos (₱)] |
| Ending an auto-renew plan immediately (database change) | [TO CONFIRM: approver role] | Not applicable |
| Full or partial refund of a sponsor-code batch | [TO CONFIRM: approver role] | [TO CONFIRM: amount limit in Philippine pesos (₱)] |

## Exceptions to the refund procedure

| Situation | What to do |
|---|---|
| The family's plan should change without a refund | There is no admin tool. Editing the family's plan and device limit by hand works only for a family with no purchase records at all, because eGuard recalculates the plan for any family with purchase records, including abandoned checkouts. Escalate to engineering. |
| The family also holds a redeemed sponsor code | Not covered by the sources. [TO CONFIRM: whether a sponsored plan can be ended or refunded for a family] |
| The pass's refund did not end the plan | Check webhook delivery in the PayMongo dashboard (step 8). The `refund.succeeded` event must be registered on the webhook. |
| An organization needs an official receipt (BIR) | Handled through support. [TO CONFIRM: how support issues official receipts] |
| A Google Play purchase | [TO CONFIRM: refund route for legacy Google Play purchases] |

## Outputs of a refund and where they are recorded

| Output | Where it is recorded |
|---|---|
| Refund of the payment | PayMongo dashboard (payments and webhook delivery attempts) |
| Pass or batch closed as `VOIDED` | The purchase or batch record in eGuard; the family's audit log entry `purchase.voided` |
| Plan change | The family's audit log entry `plan.changed`, and an alert to the family |
| Staff look-ups | Console audit log (`family.view`, `organization.view`, `ticket.status`) |
| Reply to the customer | Support inbox |
| Batch refund notice | Email to every organization admin |

eGuard sends no receipts of its own: PayMongo emails receipts for passes, and subscription invoices follow the PayMongo account's email settings.

## Time targets for a refund

| Step | Target |
|---|---|
| First reply to the customer | Within 1 business day (the support reply target) |
| Approval decision | [TO CONFIRM] |
| Refund issued after approval | [TO CONFIRM] |
| Plan change after a pass refund | Straight away, once PayMongo delivers `refund.succeeded` |

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Customer Support Playbook; Pricing and Discount Rules; Products and Services Catalogue; Setting Up PayMongo; Systems Overview; Data Handling and Confidentiality |

## Open questions

1. [TO CONFIRM: which role holds PayMongo dashboard access]
2. [TO CONFIRM: which role may edit production purchase records]
3. [TO CONFIRM: approver role and approval limits] for each kind of refund, with amount limits in Philippine pesos (₱). The sources set no refund approval limits.
4. [TO CONFIRM: refund eligibility rules in the Terms, for example time limits]. launch-visibility.md says the Terms contain "refund and liability terms" and asks for a legal review; the Terms text is not in the sources.
5. [TO CONFIRM: refund route for legacy Google Play purchases]. subscriptions.md says Google Play billing is turned off, but old `eguard_family` Google Play products "still grant eGuard Family for as long as they're paid".
6. [TO CONFIRM: whether staff cancel it in the PayMongo dashboard or ask the family admin to turn auto-renew off in Settings › Subscription] when an auto-renew invoice is refunded. subscriptions.md says only "Refund in the dashboard, cancel the subscription".
7. [TO CONFIRM: steps for a partial batch refund, including whether codes are cancelled first and how the refunded amount is worked out from the batch's discounted total]. organizations.md says only "Partial refunds are handled by support".
8. [TO CONFIRM: whether a sponsored plan can be ended or refunded for a family].
9. [TO CONFIRM: how support issues official receipts] (organizations.md open question 2, "Official receipts (BIR)").
10. [TO CONFIRM: approval decision time target] and [TO CONFIRM: time from approval to refund].
11. [TO CONFIRM: owner role], effective date and review date for this SOP.
12. Ending an auto-renew plan immediately needs a direct database change ("set that row's `state` to `VOIDED`", subscriptions.md §13), because the console cannot change plans or issue refunds in v1 (console.md §7). Confirm whether a console tool is planned, and who may make the change until then.
13. subscriptions.md §4 (pass flow diagram) shows the button as "Pay ₱199", while every price table in subscriptions.md and plan-change-2026-10.md gives ₱149 or ₱249 a month. The diagram looks out of date; it does not affect the refund steps.
