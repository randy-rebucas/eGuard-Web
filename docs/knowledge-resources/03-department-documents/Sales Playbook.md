# Sales Playbook

## Summary

The Sales Playbook describes how DevCom Digital Marketing Services sells eGuard: who the right customers are, who decides, the stages from first contact to a paying organization, the questions and messages to use, and how to answer common objections. It is for anyone talking to prospective customers, mainly schools, community groups and businesses that buy sponsor codes for families, and for staff who support families deciding on a plan. Families buy for themselves on the web; organizations are the main audience for active selling. eGuard's central message is verification: a setting is marked Verified only once the child's device confirms it. Prices and discounts are not repeated here: they live in "Products and Services Catalogue" and "Pricing and Discount Rules".

## Ideal customer profile: families

The eGuard family customer is a parent or guardian aged 18 or over in the Philippines. The family pays in Philippine pesos (₱) with local payment methods; most families in the Philippines use GCash, so many buy passes rather than auto-renew. Plans are bought on the web by the family admin, and the apps do not sell. Typical family size is [TO CONFIRM: typical number of children and devices per paying family].

| Signals of a good fit | Signals of a poor fit |
|---|---|
| Children use Android phones or tablets, or Chrome, Edge or Firefox | The children use only iPhones or iPads (coming soon) |
| The parent worries whether controls set before are really working ("parental controls not working") | The children use only a Windows PC (eGuard for Windows is in testing, no date) |
| More than one child, or a concern about gaming time across apps (category limits on eGuard Plus and up) | The parent wants to read messages, see browsing history or watch secretly: eGuard is never hidden and never reads messages, photos or browsing content |
| The parent values privacy and a policy under Philippine law | The parent expects to buy inside the app |

## Ideal customer profile: organizations

An eGuard organization is a school, community group or business that helps many families at once. The sources give three examples: a barangay funding plans for families who cannot pay, a school encouraging parents to set up protection, and a company offering eGuard as an employee benefit. Typical organization size is [TO CONFIRM: typical number of families per organization].

| Signals of a good fit | Signals of a poor fit |
|---|---|
| Wants to pay for families' plans for a set time (1, 3, 6 or 12 months) | Wants to see individual families, children or activity (not possible; see "Objection: what will the school, the company or eGuard see about us") |
| Is comfortable handing out codes and keeping its own record of who received each | Wants to push school-approved sites or homework schedules to children (planned for a later phase, not built) |
| Has an enrollment or HR system that could take codes automatically (Organization API, needs eGuard Family) | Wants impact reports, event mode, employer invoicing or seat management (later phase, not built) |
| Can pay online with GCash, Maya, QR Ph or a card | Needs to buy or redeem inside the mobile apps |
| Runs parent sessions, PTAs or guidance programs | Needs official receipts on a fixed process (currently handled case by case through support) |

## Buyer roles and what each cares about

eGuard sales involve the following roles. Organization admins are ordinary eGuard parent accounts with an extra role; examples in the sources are a teacher, a barangay officer and an HR person.

| Role | What the role does | What the role cares about |
|---|---|---|
| Family admin (parent) | Owns the family's subscription; the only person who can buy, cancel or redeem a code | Price, payment by GCash or Maya, whether controls really work, privacy, the child knowing eGuard is on |
| Other parent | Uses the account; cannot buy | Sharing the work; more than one parent is allowed on every plan |
| Organization owner | Creates the organization, adds admins, buys codes | Cost per family, volume discount, that families' data stays private, simple hand-out |
| Organization admin | Manages the join code, codes and batches | Copying, sharing and cancelling codes; daily activity email with counts |
| School board or management | Receives reports | Totals and weekly activity, which the Organization API can supply |
| IT or enrollment-system staff | Connects their system | API keys, read-only or "read and cancel" access, rate limits |
| Data protection contact at the organization | Reviews privacy | The organization receives counts only, which keeps it clear of Data Privacy Act (RA 10173) obligations for data it never receives |

## Sales stages

eGuard organization sales follow the stages below. Family sales are self-serve and follow the funnel in "Sales stages for families".

| Stage | Entry criteria | Activities | Exit criteria | System where it is recorded |
|---|---|---|---|---|
| 1. Lead | A school, community group or business shows interest (for example from www.eguard.family/for-schools or a parent session) | Qualify with the questions below; send the for-schools page | Contact and need confirmed | [TO CONFIRM: CRM or lead list] |
| 2. Parents' session or pilot | Lead agrees to talk to parents | Offer PTAs and guidance offices a free parents' session on screen time with a one-page handout linking to the guides | Session held; interest in sponsoring confirmed | [TO CONFIRM: CRM or lead list] |
| 3. Quote | Organization wants a price | Use the sponsor-cost estimator on the for-schools page, which uses the checkout's own calculation | Organization accepts plan, months and quantity | [TO CONFIRM: CRM or lead list] |
| 4. Organization set up | Quote accepted | Organization owner creates the organization in Settings › Organizations and invites admins | Organization exists | Console › Organizations |
| 5. Batch paid | Organization exists | Admin buys a batch on the organization page and pays through PayMongo | Payment confirmed; codes created | Console › Organizations (batches); PayMongo dashboard |
| 6. Codes in use | Codes delivered | Organization shares the join code and hands out sponsor codes | Families join and redeem | Organization page counts; daily activity email; Organization API |

## Sales stages for families

eGuard families buy without a salesperson. The funnel the business watches is:

1. Landing visit → account created.
2. Account → email verified.
3. Verified → first child added.
4. Child → first device paired, the moment eGuard delivers value.
5. Paired → upgrade to eGuard Plus or eGuard Family.

The funnel is counted from eGuard's own database, without third-party tracking. Staff answering families' questions use "Customer FAQ".

## Qualification questions

The organization qualification questions help decide whether eGuard fits an organization and which batch to propose.

1. How many families do you want to support, and how many children do they have?
2. Which devices do the children use: Android phones and tablets, browsers, iPhones, Windows PCs?
3. Who will pay: the organization for every family, or the families themselves?
4. For how long should each family be covered: 1, 3, 6 or 12 months?
5. Which plan fits the families: eGuard Plus or eGuard Family (compare limits in "Products and Services Catalogue")?
6. How will you pay? Large amounts may exceed e-wallet limits, so card or QR Ph may be needed.
7. Do you need official receipts? [TO CONFIRM: how official receipts are issued]
8. How will you hand out codes and record who received each one? eGuard never tells the organization who redeemed a code.
9. Do you want your own system to take codes automatically? That needs an admin whose family is on eGuard Family.
10. What do you expect to see about families? (The answer must match the rule in "Objection: what will the school, the company or eGuard see about us".)
11. When do you want to start? The start of the school year (June) and holidays are natural moments.

## Value messages by customer type

eGuard's value messages are drawn from the sources and use only facts that are true today.

| Customer type | Message |
|---|---|
| Families | "Saved" isn't "on": eGuard marks a setting Verified only after the child's device confirms it, and tells the parent when that changes. Free for 1 child, no card needed. Pay with GCash, Maya, QR Ph or a card |
| Families worried about privacy | eGuard never reads messages, photos or browsing content, shows no ads and sells no data. It is never hidden from the child. Activity is deleted after 90 days |
| Schools | Families join with a code; the school sees how many joined, never who. Sponsor codes pay for families' plans. A free parents' session and 100 free Knowledge Center guides support the school's own safety work |
| Barangays and community groups | Fund plans for families who cannot pay. A sponsor code works like a gift card: one family redeems it for the batch's plan and months |
| Businesses | Offer eGuard as an employee benefit; the company sees counts only |
| Organizations with their own systems | With eGuard Family, the Organization API lets an enrollment system take the next available code and report totals to a board |
| Media and partners | A Filipino-made product from Baybay City, Leyte, built for Filipino families, with peso pricing and local payment methods |

Larger batches receive published volume discounts; the tiers are in "Pricing and Discount Rules".

## Objection: Microsoft Family Safety or Google Family Link is free

**Objection.** "There are free parental controls already."

**Response.** eGuard's Free plan is also free for 1 child and 1 device, and it includes verification: every setting is checked on the device and shown as Verified or Failed, with Configuration Health per child. On Android, eGuard applies protections with its own app, not Google Family Link. eGuard Plus adds one "gaming time" limit across all games.

**Evidence to cite.** The how-it-works page (www.eguard.family/how-it-works); the Free plan on the pricing page. Internal note: the pricing analysis sees Microsoft Family Safety as the main rival on a PC, but eGuard for Windows is not released, so PCs are not part of any pitch until it ships.

## Objection: Qustodio or another paid app is better known

**Objection.** "We already know a bigger international brand."

**Response.** eGuard is built for Filipino families: peso prices, GCash, Maya and QR Ph, and a privacy policy written under Philippine law. Its difference is that protections are confirmed on the device, not just saved.

**Evidence to cite.** Peso prices on the pricing page. Internal only: the pricing analysis compares eGuard Plus with Qustodio Basic (about ₱290 a month at about ₱58 to the US dollar, from Qustodio's US pages in October 2026). The source says to check Qustodio prices again before any public comparison, so staff do not quote competitor prices to customers until they are re-checked and approved [TO CONFIRM: who approves a public competitor comparison].

## Objection: it is too expensive

**Objection.** "We can't afford a monthly subscription."

**Response.** eGuard's Free plan costs nothing and needs no card (its limits are in "Objection: Microsoft Family Safety or Google Family Link is free"). Paid plans can be bought as a one-month pass with GCash that never renews, and a yearly plan costs the same as 10 months. Organizations can pay for families through sponsor codes, with lower per-code prices for larger batches.

**Evidence to cite.** The pricing page; the for-schools page and its estimator.

## Objection: our children use iPhones or Windows PCs

**Objection.** "Our kids don't have Android phones."

**Response.** The eGuard browser extension works today in Chrome, Edge and Firefox. The iPhone and iPad app is coming soon, and families can get an email when it launches at www.eguard.family/iphone. eGuard for Windows is in testing with no release date.

**Evidence to cite.** The devices list on the website. No release date may be given (see "What may not be promised without approval").

## Objection: my child will just switch it off

**Objection.** "Kids always find a way around these apps."

**Response.** Uninstall Protection stops eGuard from being removed without a parent. If a setting is changed on the device anyway, the device reports what it really has, eGuard shows Failed, and the parent gets an alert naming the device and the setting. Tamper and removal alerts are on every plan, Free included.

**Evidence to cite.** The how-it-works page; the "Can my child switch eGuard off or uninstall it?" answer in "Customer FAQ".

## Objection: what will the school, the company or eGuard see about us

**Objection.** "I don't want my school or employer to see my family's data."

**Response.** An organization never sees an individual family's data: only how many families joined and how many codes were redeemed, never names, children, devices, settings, activity or location, and never who redeemed a code. eGuard staff see accounts, never a child's activity. Families can leave an organization at any time.

**Evidence to cite.** The for-schools page and the Security page; the Organization API documentation, which states that it never returns anything about a family.

## Objection: who else uses eGuard

**Objection.** "Which schools or how many parents already use it?"

**Response.** eGuard does not publish user counts, ratings or "trusted by" claims until they are real. Staff offer a parents' session or a pilot instead, and a demo account for a walkthrough.

**Evidence to cite.** "Built in Baybay City, Leyte" and the "Who's behind eGuard" block on the About page. A school may be named as a customer only after it has gone from pilot to a real quote, and only with its agreement [TO CONFIRM: approval needed to name a customer].

## Objection: we want to pay or redeem in the app

**Objection.** "Can families just redeem the code in the app?"

**Response.** Sponsor codes are redeemed on the web by the family admin, in Settings › Subscription, and organizations buy codes on the web. App store rules do not allow unlocking paid plans with codes inside the apps, or pointing users to pay elsewhere. The app then shows the sponsored plan.

**Evidence to cite.** The for-schools page's organizer FAQ.

## What may not be promised without approval

The following may not be promised to a prospect without approval from [TO CONFIRM: approver role for each item].

| Topic | Rule from the sources |
|---|---|
| Release dates for eGuard for iPhone and iPad or eGuard for Windows | No dates exist; describe them only as "coming soon" and "in testing" |
| Features not built | Family-wide policies, advanced recommendations, school-approved sites, homework schedules, impact reports, event mode, employer invoicing, seat management and Tagalog or Bisaya versions of the app are not built |
| Any discount, free period or price outside the published plans and volume tiers | Not covered by the sources [TO CONFIRM] |
| Future prices | Existing auto-renew subscribers keep their price when a price changes; nothing else about future prices may be promised |
| Refunds | See "Customer Support Playbook" |
| Access to family data for an organization | Never possible; no approval can change it |
| Official receipts, invoices or contracts | [TO CONFIRM: process] |
| "Priority support" | Listed as a paid-plan feature but not enforced; do not promise service levels |
| A free eGuard Family plan for a creator's sponsored walkthrough | Suggested in the launch plan; the post must be labeled as sponsored |
| Naming a customer, quoting a parent, or showing a rating | Only when real, with consent, and for ratings only from 20 reviews |

## Hand-over to delivery or onboarding

When an organization agrees to buy, sales hands it to onboarding [TO CONFIRM: who onboards organizations]. The onboarding steps:

1. **Create the organization.** The owner signs in to eGuard with a verified email and creates the organization in Settings › Organizations (name and kind: School, Community group or Business).
2. **Add admins.** The owner invites admins by the email they use for eGuard. An invitation stays open for 14 days; a person without an eGuard account signs up first.
3. **Buy a batch.** An admin chooses plan, months and quantity on the organization page and pays through PayMongo. Codes appear once payment is confirmed; an unpaid checkout expires after 24 hours.
4. **Share the join code** with families, so they can join and be counted.
5. **Hand out sponsor codes** and record which family received which code; eGuard will not tell the organization later.
6. **Explain redemption to families,** as described in "Objection: we want to pay or redeem in the app".
7. **Set up reporting if wanted:** the organization page and daily activity email show counts; with eGuard Family, an admin can create API keys.
8. **Remind about deadlines:** codes must be redeemed within 12 months of payment; admins are emailed 30 days before unused codes expire.

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Products and Services Catalogue; Pricing and Discount Rules; Customer FAQ; Customer Support Playbook; Brand Voice and Writing Style Guide; Company Overview |

## Open questions

1. [TO CONFIRM: owner role] for this playbook, and whether DevCom has a sales role at all (the sources name only "the owner" and "staff").
2. [TO CONFIRM: typical number of children and devices per paying family] and [TO CONFIRM: typical number of families per organization].
3. [TO CONFIRM: CRM or lead list] where organization leads, sessions and quotes are recorded.
4. [TO CONFIRM: how official receipts are issued] — organizations.md says official receipts (BIR) are "currently through support".
5. [TO CONFIRM: who approves a public competitor comparison] — pricing-desktop.md says Qustodio prices are from its US pages in October 2026: "Check them again before any public comparison."
6. [TO CONFIRM: approval needed to name a customer] — launch-visibility.md: "Take one school from pilot to a real quote. Only then say a school uses eGuard."
7. [TO CONFIRM: approver role for each item] in "What may not be promised without approval", including discounts or free periods outside published tiers ([TO CONFIRM] in the table) and free plans for creators.
8. [TO CONFIRM: process] for official receipts, invoices or contracts with organizations.
9. [TO CONFIRM: who onboards organizations].
10. What a parents' session or pilot includes, and what it costs, is not in the sources.
11. Volume-discount examples disagree: organizations.md and profile.md give 10% off for 10–49 codes and 15% for 50–99; organization-api.md's example batch (10 codes × 3 months of eGuard Plus = ₱4,470.00) and mobile-organizations.md's example (50 codes × 3 months = ₱22,350) show no discount. Quotes must use the estimator, not these examples.
12. Plan limits: current limits (subscriptions.md, plan-change-2026-10.md) are Free 1/1, eGuard Plus 3/5, eGuard Family 6/12; out-of-date values appear in faq.md ("Up to 5", "Up to 10"), facebook-page.md About ("up to 10"), features/children.md §6, features/devices.md §6 and mobile-api.md examples.
13. Push alerts: faq.md, profile.md and press-release.md say every plan gets push for security alerts; launch-visibility.md ("Push alerts (coming soon)"), app-listing.md ("Push notifications aren't wired up") and organizations.md ("push isn't wired up for any alert yet") disagree. Sales should not lead with push until confirmed.
14. Android app availability: faq.md and profile.md say Android works through Google Play now; app-listing.md and child-app-spec.md say the native apps are not built.
15. Joining organizations in the apps: organizations.md §13 says it is "Not in Phase 1"; mobile-organizations.md says the family side is built in both apps.
16. pricing-desktop.md describes a possible price review 90 days after eGuard for Windows leaves beta. It is internal, conditional and must not be mentioned to prospects; confirm whether sales should know about it.
