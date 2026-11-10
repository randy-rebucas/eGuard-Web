# Drafting conventions: eguard

The spellings and values every eguard draft uses, so the same fact reads the same way in every document. Written 2026-11-10 from the sources and the [fact sheet](project-fact-sheet.md). Values marked "provisional" follow the newest source while the owner has not answered; the contradiction numbers point to the [source inventory](../_review/source-inventory.md).

## Canonical spellings

| Use | Not | Source |
|---|---|---|
| eGuard | Eguard, e-Guard | profile.md |
| DevCom Digital Marketing Services (short: DevCom) | DevCom Digital | profile.md |
| Free | Free plan tier names from before September 2026 | subscriptions.md |
| eGuard Plus | Plus (alone, in customer text) | subscriptions.md |
| eGuard Family | Pro, Family Pro (aliases only, renamed 2026-10-28) | plan-change-2026-10.md |
| eGuard for Android; eGuard browser extension; parent web dashboard | | profile.md |
| eGuard for Windows | desktop agent (internal) | faq.md, desktop-agent-spec.md |
| eGuard for iPhone and iPad | iOS app (internal) | faq.md |
| Configuration Health; Verified; Failed | | profile.md, faq.md |
| The 10 protections: Screen Time, Bedtime, App Restrictions, App Approval, Content Restrictions, Web Filtering, Downloads, Location, Notification Controls, Uninstall Protection | | profile.md |
| family admin; parent | FAMILY_ADMIN, PARENT (code names) | mobile-api.md |
| organization; organization admin; join code; sponsor code; batch | voucher (code name) | organizations.md |
| pass; auto-renew | | faq.md, subscriptions.md |
| legacy limits | legacyLimits (code name) | plan-change-2026-10.md |
| alerts when a setting changes | drift alerts, driftAlerts (code names) | plan-change-2026-10.md |
| Parent care; Knowledge Center; Help Center | | features/parent-care.md, knowledge-center.md |
| console (staff back office); service notice; product update | | console.md |
| demo family | | app-listing.md |
| Philippine pesos (₱), written "₱149" | PHP 149, P149 | subscriptions.md |
| Philippine time (Asia/Manila) | | console.md, organization-api.md |

## Canonical values

| Fact | Value | Source |
|---|---|---|
| eGuard Plus price | ₱149 a month or ₱1,490 a year | subscriptions.md |
| eGuard Family price | ₱249 a month or ₱2,490 a year | subscriptions.md |
| Free price | ₱0 | subscriptions.md |
| Yearly price | the price of 10 months | subscriptions.md |
| Plan limits (provisional, contradiction 1) | Free 1 child / 1 device; eGuard Plus 3 / 5; eGuard Family 6 / 12 | subscriptions.md, plan-change-2026-10.md |
| Legacy limits | Families paying before 2026-10-28 keep 5 / 10 (eGuard Plus) or 10 / 20 (eGuard Family) while subscribed | plan-change-2026-10.md |
| Payment methods | Passes: GCash, Maya, QR Ph or card. Auto-renew: card or Maya | subscriptions.md |
| Where plans are bought | On the web, Settings › Subscription, by the family admin only; the apps show the plan but do not sell it | subscriptions.md |
| Pass reminder | 3 days before the pass ends | subscriptions.md |
| Grace period after a failed renewal | 3 days | subscriptions.md |
| Sponsor codes | 1, 3, 6 or 12 months; 1–200 codes per batch; redeem within 12 months of payment | organizations.md |
| Volume discounts | 1–9 codes none; 10–49 10%; 50–99 15%; 100–200 20% | organizations.md, profile.md |
| Activity retention | deleted after 90 days | profile.md |
| Location history | off unless the family turns it on; default retention 90 days | profile.md, features/location.md |
| Support | support@devcomdigital.com; replies within 1 business day | profile.md, mobile-api.md |
| Website | www.eguard.family | profile.md |
| Company location | Baybay City, Leyte, Philippines (street address left out until the owner confirms) | profile.md |

## Open points held as [TO CONFIRM] in every draft

| Point | Inventory contradiction |
|---|---|
| Whether eGuard for Android is live on Google Play | 4 |
| Whether push alerts work | 5 |
| Whether a browser on a paired Windows PC takes a device slot | 2 |
| Google Play package name | 3 |
| Which objective "the project" is | (fact sheet) |
