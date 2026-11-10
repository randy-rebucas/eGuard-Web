# Customer Support Agent: Lesson Pack

## Summary

The Customer Support Agent Lesson Pack teaches a new customer support agent how eGuard support works at DevCom Digital Marketing Services. Support agents answer parents who write to support@devcomdigital.com or file a ticket from the app's Contact Support or the web's Settings › Support, and they use the console (console.eguard.family) to look up accounts and close tickets; the stated reply time is within 1 business day. The most important facts are that staff see accounts, never children's activity; that plans are bought only on the web by the family admin; and that a setting counts only when the child's device has confirmed it (Verified), not when it is saved. The pack covers the role's limits, five core rules, three worked examples drawn from real situations in eGuard's documentation, and common mistakes. The customer support agent role is proposed; it is not yet defined in the sources.

## What the customer support agent is responsible for

The customer support agent is responsible for:

| Task | Where it happens |
|---|---|
| Reading and answering parents' messages | The support inbox, support@devcomdigital.com. Tickets are forwarded there with Reply-To set to the parent, so replies go out from the inbox |
| Reading tickets and marking them Closed or Open | Console › Tickets (filter Open, Closed or All). Each ticket has a category: Setup, Device, Billing, Account or Other |
| Looking up a family's account | Console › Families: search by parent email or name, family name or id; the family page shows account, parents, purchases, tickets, organizations joined and sponsor codes redeemed |
| Explaining plans, payment, passes and auto-renew | Answers come from "Customer FAQ"; plan details and prices from "Products and Services Catalogue" |
| Helping with Failed settings and offline devices | Guiding the parent through the parent web dashboard; see the worked examples |
| Pointing parents to self-help | The Help Center at www.eguard.family/help and the Knowledge Center at www.eguard.family/learn |

Parents see each ticket's Open or Closed status in the app or on the web, so the status in the console must match reality.

## What the customer support agent is not responsible for

The customer support agent does not:

- change a family's plan, issue refunds or delete accounts from the console; the console cannot do these in v1. Refunds follow "Refunding a Purchase". [TO CONFIRM: who carries out refunds and plan changes]
- reply to tickets from the console; replies go from the support inbox.
- look at or describe a child's activity; see Rule 1.
- sell plans inside the apps, or promise features, dates or prices that are not published.
- fix server, PayMongo or webhook problems; those go to engineering. [TO CONFIRM: escalation contact and channel]

## Rule 1: Staff see accounts, never children's activity

The console shows plans and purchases, parents' sign-in details, how many children, devices and browsers a family has, support tickets and organizations. It never shows a child's location, places visited, browsing, app use, screen time, alerts or photos.

**Reason:** those details stay between the family and its devices, as the privacy policy promises. Every time a staff member opens a family, ticket or organization, or searches families, the console writes an entry in the staff audit log with who did it and when. An agent opens a family only when a ticket needs it. Details are in "Data Handling and Confidentiality".

## Rule 2: Plans are bought only on the web, by the family admin

eGuard plans are bought at www.eguard.family in Settings › Subscription, through PayMongo. Only the family admin can buy or cancel; other parents see "Only the family admin can change the plan." The apps show the plan but have no buy button. Passes can be paid with GCash, Maya, QR Ph or a card; auto-renew uses a card or Maya. Only one way of paying is active at a time.

**Reason:** the subscription belongs to the family, and Google Play's payments policy does not allow the apps to sell plans or point to outside payment. Telling a parent to "upgrade in the app" sends them to a button that does not exist.

## Rule 3: A setting counts only when the device confirms it

Saving a change in eGuard does not change the child's protection. The setting is marked **Verified** only when the child's device reports it has it. If the device reports something else, the setting shows **Failed** with what the device reported, and the parent gets an alert.

**Reason:** verification is the reason parents choose eGuard; most parental controls stop at "Saved". An agent never tells a parent a setting "is on" because it was saved, and never says a family "is safe".

## Rule 4: Organizations see counts only

Organizations (schools, community groups and businesses) see how many families joined and how many sponsor codes were redeemed, never which family redeemed a code or anything about a family's children or devices. The Organization API follows the same rule, with no exceptions.

**Reason:** families join organizations trusting that their data stays private. An agent never tells an organization which family used a code, and never tells a family about another family.

## Rule 5: Use only current, published facts

Support answers use the current plan limits: Free 1 child and 1 device; eGuard Plus 3 children and 5 devices; eGuard Family 6 children and 12 devices. Families who paid before 2026-10-28 keep their larger legacy limits (5 children and 10 devices on eGuard Plus, 10 children and 20 devices on eGuard Family) while they stay subscribed. iPhone and iPad are "coming soon"; eGuard for Windows is "in testing" with no date. Prices are in Philippine pesos (₱) and are taken from "Products and Services Catalogue".

**Reason:** some older documents still show the old limits. Quoting an out-of-date number creates a promise eGuard cannot keep. When a fact is not published, the agent checks before answering.

## Worked example 1: A parent asks why a setting shows Failed

**Situation.** A parent writes that a protection on their child's phone shows **Failed** and they received an alert. A typical Failed reason reads like "Device reported 1h / day" when the parent set a different limit.

**What a good response does:**

1. Explains that Failed means the child's device reported something other than what the parent set, and that the alert names the device and the setting.
2. Asks the parent to open Protection in the parent web dashboard. A failing check has a **Fix this** button that opens the setup flow for the child who owns the failing device.
3. Asks the parent to check the device is online, then apply the setting again and wait on the Verify step for the device to confirm.
4. Suggests **Run Configuration Check**, which asks devices to report now (results within about 12 seconds; up to 30 parent checks an hour).
5. If the setting was changed on the device, explains that Uninstall Protection keeps eGuard from being removed and that any change on the device is reported and alerted.
6. If the parent chose "Allowed sites only" for web filtering on a phone, explains that phones cannot do that mode, so it shows as not matching; the mode works in the eGuard browser extension.

**Relies on:** "Customer Support Playbook" and "Customer FAQ".

## Worked example 2: A parent says a device shows Offline

**Situation.** A parent sees an **Offline** badge on their child's tablet and asks whether protection has stopped.

**What a good response does:**

1. Explains that a device shows Offline when it has not synced for 24 hours.
2. Reassures the parent that protection stays on: the device keeps following the last rules it received, and the page shows its last known state ("Last known: verified").
3. Explains that **Run Configuration Check** is unavailable for that device until it is back online.
4. Explains that a change made while the device is offline waits ("Waiting for the device to come online") and is picked up when the device reconnects, usually within about 5 minutes.
5. Explains that if no device confirms a change within 7 days, eGuard stops waiting, keeps the earlier setting, and shows a notice to try again once the device is online.
6. Suggests the parent check that the device is switched on, charged and connected.

**Relies on:** "Customer Support Playbook" and "Customer FAQ".

## Worked example 3: A parent paid but the plan has not changed

**Situation.** The family admin paid for eGuard Plus, but Settings › Subscription keeps saying it is waiting, or the plan still shows Free.

**What a good response does:**

1. Asks the parent to reload Settings › Subscription. If PayMongo had not confirmed the payment yet, the page waits; eGuard re-checks an unfinished payment at most every minute.
2. Opens the family in the console to see its purchases and how the plan is paid (Auto-renew, Auto-renew off, Prepaid pass).
3. If the plan still has not changed, passes the case to engineering, who check webhook delivery in the PayMongo dashboard. [TO CONFIRM: escalation contact]
4. Replies to the parent with what was found and closes the ticket only when the plan shows correctly.

Two related answers: after auto-renew is turned off, the family keeps its plan until the end of the paid period, which is expected; and "Renewal failed" means a renewal is being retried, with 3 days of grace. Refund requests follow "Refunding a Purchase".

**Relies on:** "Customer Support Playbook", "Customer FAQ" and "Refunding a Purchase".

## Common mistakes and how to avoid them

Common customer support mistakes are listed below, each with the rule or worked example that prevents it.

| Mistake | How to avoid it |
|---|---|
| Quoting "up to 5" or "up to 10" children from an old FAQ table | Use the current limits in Rule 5 and check whether the family has legacy limits |
| Telling a parent to buy or upgrade in the app | Plans are bought on the web, by the family admin (Rule 2) |
| Telling a parent a setting is on because it was saved | Only Verified counts (Rule 3) |
| Saying a setting "failed" when the device is only offline | Offline devices keep their last known state; see worked example 2 |
| Telling a parent that buying a pass while auto-renew is on will work | Auto-renew must be turned off first; and auto-renew cannot start while pass time remains, because it would double-bill |
| Saying a sponsor code "doesn't work" without checking it | The organization admin can check the code's status (redeemed, cancelled or expired) on the organization page or through the Organization API's "check a code" recipe; a family that tries a cancelled code is told the organization cancelled it; unused codes expire after their redeem-by date |
| Telling an organization which family redeemed a code | Never; organizations see counts only (Rule 4) |
| Opening family records out of curiosity | Every view is logged; open a family only for a ticket (Rule 1) |
| Leaving a ticket Open after replying, or closing it before the issue is solved | Parents see the status; set Closed only when the issue is resolved, and Reopen if they reply |
| Promising a date for iPhone, iPad or Windows | Use the availability wording in Rule 5, with no date |

## Where to find more

The documents below give more detail on each part of the customer support agent's work.

| Document | Use it for |
|---|---|
| Customer Support Playbook | Step-by-step handling of each kind of ticket and escalation |
| Customer FAQ | Approved answers to parents' common questions |
| Refunding a Purchase | How passes, auto-renew invoices and sponsor-code batches are refunded |
| Products and Services Catalogue | Plans, prices, limits and what each plan includes |
| Data Handling and Confidentiality | What staff may see and share, and how personal data is protected |

Self-help links for parents are listed in "What the customer support agent is responsible for".

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Customer Support Playbook; Customer FAQ; Refunding a Purchase; Products and Services Catalogue; Data Handling and Confidentiality |

## Open questions

1. Owner role, effective date and review date of this lesson pack are not stated in the sources.
2. The customer support agent role is proposed; the sources mention only "staff" who use the console, and the console has no staff roles in v1 (every staff member sees everything).
3. Who carries out refunds and plan changes, since the console cannot do them in v1.
4. The escalation contact and channel for problems support cannot solve (payments, webhooks, server errors).
5. Working hours behind "Replies within 1 business day" are not stated.
6. Plan limits: faq.md's plan table says eGuard Plus "Up to 5" and eGuard Family "Up to 10" children; facebook-page.md's About text says eGuard Family covers "up to 10"; features/children.md §6 says "Free 1, Plus 5, Pro 10"; features/devices.md §6 says devices "Free 2, Plus 10, Pro 20"; mobile-api.md's `/subscription/plans` example shows Free 2 devices, Plus 5/10, Family 10/20. subscriptions.md and plan-change-2026-10.md give the current limits used here (Free 1/1, eGuard Plus 3/5, eGuard Family 6/12, with legacy limits 5/10 and 10/20). The other values are out of date (source inventory contradiction 1).
7. Is the Android app live on Google Play? faq.md and profile.md say Android works "through the eGuard app on Google Play"; app-listing.md and child-app-spec.md say "The native apps aren't built yet" (source inventory contradiction 4).
8. Push alerts: faq.md says every plan gets push for security alerts and Plus and eGuard Family push every alert; launch-visibility.md says "Push alerts (coming soon)" and app-listing.md and organizations.md say push isn't wired up (source inventory contradiction 5). Agents need one answer for parents.
9. Does a browser on a paired Windows PC take a device slot? The pricing page's FAQ (quoted in faq.md) says "Chrome and Edge on one laptop count as two devices"; pricing-desktop.md and browser-extension-api.md say browsers on a paired PC take no slot since 2026-10-23 (source inventory contradiction 2).
10. Whether "Run Configuration Check" results and the 30-checks-an-hour limit should be quoted to parents, or kept as internal detail.
