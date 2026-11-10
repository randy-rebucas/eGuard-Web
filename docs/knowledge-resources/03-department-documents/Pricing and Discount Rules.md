# Pricing and Discount Rules

## Summary

"Pricing and Discount Rules" sets out the list prices of eGuard plans, the volume discounts on sponsor codes for organizations, the Windows launch offer, the rules for changing a price, and the known running costs behind the prices. It is a confidential document for the sales and finance roles at DevCom Digital Marketing Services. All amounts are in Philippine pesos (₱) unless marked as US dollars ($). eGuard Plus costs ₱149 a month or ₱1,490 a year and eGuard Family costs ₱249 a month or ₱2,490 a year; a year costs the same as 10 months. The only discounts in the sources are the automatic sponsor-code volume discounts (10%, 15% or 20%, capped at 20%) and the yearly price; who may approve any other discount or price exception is not yet decided.

## Price list for eGuard plans

The eGuard price list below is the current list price for families. Passes (paid once) and auto-renew cost the same. Plans are bought only on the web at www.eguard.family (Settings › Subscription), only by the family admin, through PayMongo. The apps show the plan but do not sell it.

| Product | List price | Currency | Billing period |
|---|---|---|---|
| Free | ₱0 | Philippine pesos (₱) | No charge |
| eGuard Plus | ₱149 | Philippine pesos (₱) | One month (pass or monthly auto-renew) |
| eGuard Plus | ₱1,490 | Philippine pesos (₱) | One year (pass or yearly auto-renew) |
| eGuard Family | ₱249 | Philippine pesos (₱) | One month (pass or monthly auto-renew) |
| eGuard Family | ₱2,490 | Philippine pesos (₱) | One year (pass or yearly auto-renew) |
| Sponsor code (organizations) | Months × the plan's monthly web price, less the volume discount | Philippine pesos (₱) | 1, 3, 6 or 12 months per code, paid once per batch |

Plan limits, features and payment methods are described in "Products and Services Catalogue". eGuard Family appears as "Pro" or "Family Pro" in code and older documents; that is an alias only.

Source: subscriptions.md §2, organizations.md §10, profile.md.

## Price rules that apply to every eGuard plan

The pricing rules below come from the sources and apply to every sale.

| Rule | Detail |
|---|---|
| Yearly price | A year costs ten months ("two months free"), added 2026-10-23 |
| Where prices are set | In the server's configuration, read in pesos; the landing page shows prices from the same place. A mistyped value stops the sale instead of charging a wrong amount |
| Price tampering | The customer's browser only chooses month or year; the price always comes from the server |
| Windows PCs | Included in every plan, with no PC add-on and no new tier (owner decision, 2026-10-23) |
| Old products | Products sold before September 2026 still grant eGuard Family for as long as they are paid, at the price they were bought at, but are not sold |
| Legacy limits | Families paying before 2026-10-28 keep their older, larger limits while subscribed, at the same price |

Source: subscriptions.md §2, pricing-desktop.md, plan-change-2026-10.md.

## Changing an eGuard price

A change to an eGuard list price affects customers as follows.

1. Passes use the new price immediately.
2. Auto-renew needs a separate PayMongo plan for each price. A new price creates a new PayMongo plan on first use.
3. Existing auto-renew subscribers stay on their old plan and price. eGuard does not move anyone to a new price automatically.
4. On Google Play (currently turned off for sales), a higher price is created as a new price cohort, with existing subscribers kept on the legacy price so that nobody gets a "price increase" prompt.

Company policy, from the owner's 2026-10-23 decision: existing subscribers keep their price when prices rise. Who approves a price change: [TO CONFIRM: role that approves a list-price change; the sources say only that "the owner" accepted the 2026-10-23 recommendations].

Source: subscriptions.md §2 and §15, pricing-desktop.md §6.

## Planned price review for eGuard for Windows

The price review for eGuard for Windows takes place 90 days after the Windows agent leaves beta (generally available). Prices were held at ₱149 and ₱249 a month at launch because the agent is unproven, the first installers may show SmartScreen warnings, and charging more for an unproven feature leads to refunds and bad reviews.

If all four conditions below hold, prices rise for **new subscribers only**:

| Plan | Current | After a successful review |
|---|---|---|
| eGuard Plus, monthly | ₱149 | ₱179 |
| eGuard Family, monthly | ₱249 | ₱299 |
| eGuard Plus, yearly | ₱1,490 | ₱1,790 |
| eGuard Family, yearly | ₱2,490 | ₱2,990 |

Conditions:

1. At least 25% of paying families have paired a PC.
2. Free-to-Plus conversion among families with a PC is at least 1.5 times that of families without one.
3. Monthly churn among families with a PC is no worse than among families without one.
4. Fewer than 5% of PCs show uninstall or tamper alerts that turned out to be eGuard's fault.

If conversion rises but churn also rises, the price is held and the product fixed first. Conversion is compared from the 2026-10-28 sign-up cohort on, because a Free family can no longer have both a phone and a PC. The owner may change the threshold numbers if current conversion and churn data say otherwise. Windows release date: [TO CONFIRM: release date of eGuard for Windows].

Source: pricing-desktop.md §5, §6, §8.

## Costs behind eGuard prices

The cost figures below are the only cost information in the sources (estimates written 2026-10-23).

| Cost | Rough size | Notes |
|---|---|---|
| Code signing for eGuard for Windows | About 200–500 US dollars a year for an OV certificate (code-signing.md) | Needed before launch, or Windows warns on every install. See Open questions for a different figure |
| Server load from PCs | Small | |
| Support | The biggest real cost | PC questions take longer than phone ones |
| Catalog upkeep | A few hours a month | Adding newly popular games |

The 2026-10-23 recommendation concludes that these costs are covered by "a handful of extra Plus subscribers a month", so PCs do not need their own price.

Target margins: [TO CONFIRM: target gross margin or minimum margin per plan; not in the sources]. Payment processing fees: [TO CONFIRM: PayMongo fees per payment method].

Source: pricing-desktop.md §2, code-signing.md.

## Competitor prices used in eGuard pricing decisions

The competitor prices below were taken from the competitors' US pages in October 2026, at an assumed rate of about ₱58 to the dollar. They must be checked again before any public comparison.

| Product | Price | Per month in pesos (approx.) |
|---|---|---|
| Qustodio Basic | $59.95 a year | about ₱290 |
| Qustodio Complete | $104.95 a year, unlimited devices | about ₱510 |
| Microsoft Family Safety | Free with a Microsoft account | ₱0 |

eGuard's own prices are in "Price list for eGuard plans". eGuard is positioned as the low-price option; Microsoft Family Safety is the main rival on a PC because it is free.

Source: pricing-desktop.md §1.

## Discount limits for eGuard

The discount limits below are the only discounts described in the sources. Sponsor-code volume discounts are applied automatically by the system at checkout, with no manual approval step.

| Discount size | Who may approve | Conditions |
|---|---|---|
| None | Not applicable | Sponsor-code batch of 1–9 codes |
| 10% | Automatic (set in code) | Sponsor-code batch of 10–49 codes |
| 15% | Automatic (set in code) | Sponsor-code batch of 50–99 codes |
| 20% (maximum) | Automatic (set in code) | Sponsor-code batch of 100–200 codes |
| Two months free (yearly price = 10 months) | Owner decision, 2026-10-23 | Any family buying a yearly pass or yearly auto-renew |
| One free month of eGuard Plus (Windows launch offer) | Owner decision, 2026-10-23 (built, switched off) | See "Windows launch offer for eGuard Plus" |
| Any other discount, on any product | [TO CONFIRM: role allowed to approve, and the maximum size] | [TO CONFIRM] |

Source: organizations.md (Volume discounts), subscriptions.md §2, pricing-desktop.md §8.

## Sponsor-code volume discount rules

Sponsor-code volume discounts follow these rules (organizations.md, Volume discounts):

- The discount is set by the number of codes in the batch and applies to every code in the batch.
- The number of months does not change the discount: a 12-month code costs 12 × the discounted monthly price.
- The discounted price of one code is rounded to whole centavos, and the checkout total is exactly that price × quantity.
- The buy form shows the discount, the saving and how many codes reach the next tier, using the same calculation as the checkout.
- Discounts stop at 20% on purpose. Codes can be handed to anyone, so a deeper discount would make it worth buying codes in bulk to resell to families below the family price.

Worked example from profile.md, eGuard Plus, 12 months per code:

| Codes in the batch | Discount | Price per code |
|---|---|---|
| 1–9 | none | ₱1,788 |
| 10–49 | 10% | ₱1,609.20 |
| 50–99 | 15% | ₱1,519.80 (50 codes: ₱75,990, saving ₱13,410) |
| 100–200 | 20% | ₱1,430.40 |

## Windows launch offer for eGuard Plus

The Windows launch offer gives one month of eGuard Plus, once ever, to a family with no paid time that pairs a Windows computer. The offer runs only while an end date for the offer is set in the server configuration; with no date set, there is no offer. The offer is to be switched on when eGuard for Windows ships.

- The month ends like a pass: a reminder 3 days before, then back to Free.
- The family can add paid eGuard Plus months on top.
- The offer is recorded as eGuard's own promotional purchase, one per family.

Who switches the offer on and sets its end date: [TO CONFIRM: role]. Offer end date: [TO CONFIRM].

Source: subscriptions.md §2 (Windows launch offer), pricing-desktop.md §5 and §8.

## Special terms for eGuard customers

The special terms in the sources are listed below. Anything not listed is not covered by the sources.

| Term | Rule |
|---|---|
| Payment terms, families | Paid in advance. A pass is paid once and never renews; buying again adds another period, starting when current paid time ends. Auto-renew charges card or Maya every month or year until turned off |
| Late renewal (auto-renew) | 3 days of grace while PayMongo retries a failed renewal; after that the family drops to Free |
| Payment terms, organizations | A sponsor-code batch is paid once through PayMongo Checkout (GCash, Maya, QR Ph, card). An unpaid checkout expires after 24 hours. Codes must be redeemed within 12 months of payment |
| Large organization payments | E-wallets cap single payments, so large batches may need card or QR Ph |
| Official receipts (BIR) for organizations | Currently handled through support |
| Refund of a sponsor-code batch | Unredeemed codes are cancelled; plans already redeemed keep running. Partial refunds are handled by support |
| Multi-year terms | [TO CONFIRM: none in the sources; the longest period sold is one year] |
| Non-profit pricing | [TO CONFIRM: none in the sources; community groups such as a barangay buy sponsor codes at the standard volume discounts] |
| Partner or reseller pricing | [TO CONFIRM: none in the sources] |

Refund approval limits are covered in "Refunding a Purchase" and "Customer Support Playbook". Source: subscriptions.md, organizations.md.

## What never gets discounted at eGuard

The sources state the following firm limits:

1. Sponsor-code volume discounts never go above 20% (reason in "Sponsor-code volume discount rules").
2. Existing subscribers are never moved to a higher price (see "Changing an eGuard price").
3. Windows PCs are never sold as a paid add-on (see "Price rules that apply to every eGuard plan").
4. More than one parent and configuration history are never sold as paid features; they stay on every plan, Free included (decision of 2026-10-28).
5. The app stores never sell eGuard plans; the apps have no buy button and no link to web payment (see "Price list for eGuard plans").

Any further items that must never be discounted: [TO CONFIRM].

Source: organizations.md, pricing-desktop.md, subscriptions.md.

## Requesting and recording an eGuard price exception

No procedure for requesting or recording a price exception exists in the sources. The relevant facts are:

- There is no staff tool for granting a plan by hand. Editing a family's plan directly works only for families with no purchases at all, because the system recomputes the plan from purchase records for every other family.
- Every plan change is recorded in the family's audit log (for example `purchase.paid`, `plan.changed`).
- Sponsor codes belong to an organization's paid batch and are not issued to a family directly; the Windows launch offer was built as a separate promotional purchase for that reason.

Procedure for requesting an exception: [TO CONFIRM: who may request, who approves, maximum size]. Where an approved exception is recorded: [TO CONFIRM].

Source: subscriptions.md §13, pricing-desktop.md §8.

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role; the sources name "the owner" as the person who accepts pricing decisions] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Products and Services Catalogue; Sales Playbook; Refunding a Purchase; Customer Support Playbook; eguard: Decision Log |

## Open questions

1. [TO CONFIRM: owner role] for this document.
2. [TO CONFIRM] effective date and review date. Suggested: review every 3 months, because the document holds prices (suggestion only, not decided).
3. [TO CONFIRM: role that approves a list-price change.] The sources say only that "the owner" accepted the 2026-10-23 recommendations and changed limits on 2026-10-28.
4. [TO CONFIRM: release date of eGuard for Windows], which starts the 90-day price-review clock.
5. [TO CONFIRM: target gross margin or minimum margin per plan.]
6. [TO CONFIRM: PayMongo fees per payment method.]
7. [TO CONFIRM: role allowed to approve any discount other than the automatic volume discounts, and the maximum size.]
8. [TO CONFIRM: role who switches on the Windows launch offer], and [TO CONFIRM] the offer's end date.
9. [TO CONFIRM] multi-year terms, non-profit pricing and partner or reseller pricing: none appear in the sources.
10. [TO CONFIRM] any further items that must never be discounted.
11. [TO CONFIRM] the procedure for requesting a price exception (who may request, who approves, maximum size) and where an approved exception is recorded.
12. Contradiction, code-signing cost. pricing-desktop.md: "About $10 a month (Azure Trusted Signing), or $200–400 a year (OV certificate)". code-signing.md: Azure Artifact Signing is only for organizations in the US, Canada, the EU and the UK, "so not available to us"; an OV certificate costs about $200–500 a year. This document uses the code-signing.md figure.
13. Contradiction, how often a PC syncs (affects the server-load cost estimate). pricing-desktop.md: "A PC syncs every 5 minutes, like a phone". desktop-agent-spec.md and mobile-api.md: computers sync every 60 seconds / every minute.
14. Contradiction, sponsor-code examples without the volume discount. organizations.md and profile.md: 10–49 codes get 10% off, 50–99 get 15%. organization-api.md example: 10 codes × 3 months of Plus = ₱4,470.00 (no discount). mobile-organizations.md example: 50 codes × 3 months of Plus = ₱22,350 (no discount). This document follows organizations.md.
15. Contradiction, price in a flow diagram. subscriptions.md §4 diagram: "Pay ₱199". Every price table: ₱149 or ₱249 a month.
16. Contradiction, plan limits. subscriptions.md, profile.md and plan-change-2026-10.md give Free 1 child / 1 device, eGuard Plus 3 / 5, eGuard Family 6 / 12 (legacy limits 5/10 and 10/20). faq.md shows eGuard Plus "Up to 5" and eGuard Family "Up to 10" children; facebook-page.md About says "up to 10"; features/children.md §6 says "Free 1, Plus 5, Pro 10"; features/devices.md §6 says "Free 2, Plus 10, Pro 20"; mobile-api.md `/subscription/plans` example shows Free 2 devices, Plus 5/10, Family 10/20. The out-of-date values are not used here.
17. Out of date, pricing-desktop.md: its device-slot counts (Free 2 slots, Plus 10, Pro 20) predate the 2026-10-28 change, as the file itself notes.
18. Out of date, payment configuration: subscriptions.md §10 lists only the monthly price settings, while §2 also lists the yearly price settings. Confirm that the configuration reference is complete.
19. [TO CONFIRM] whether a browser on a paired Windows PC takes a device slot. faq.md: "Chrome and Edge on one laptop count as two devices". pricing-desktop.md and browser-extension-api.md: browsers on a paired PC take no slot since 2026-10-23.
