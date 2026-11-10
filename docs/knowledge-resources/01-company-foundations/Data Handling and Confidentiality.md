# Data Handling and Confidentiality

## Summary

The Data Handling and Confidentiality policy sets out what data DevCom Digital Marketing Services (short: DevCom) holds for eGuard, how confidential each kind is, who may see and share it, how long personal data is kept and how it is deleted, which outside tools may receive it, and how a suspected data incident is reported. It applies to everyone who works on eGuard, including staff who use the console (staff back office). The central rules are that staff see accounts, never children's activity; organizations see counts, never a family's data; card details never reach eGuard's servers; and eGuard sells no data and shows no ads. DevCom is the personal-information controller, and eGuard's privacy policy is written under the Data Privacy Act of 2012 (RA 10173). Several points, including the incident-reporting contact and deadline, are not yet decided and are marked [TO CONFIRM].

## Data categories: customer data

Customer data is data about families (parents and their children) and people on eGuard's mailing lists.

| Kind | Examples |
|---|---|
| Parent account | Parent's name and email address; Apple or Google sign-in ID; role in the family (family admin or parent); notification settings |
| Child profile | Child's first name and birth year; a profile photo if the parent uploads one. Children never have accounts |
| Device data | Device token issued at pairing, model and OS version; which protections the device reports; configuration history and alerts |
| Usage data | Installed app names (for approvals and limits); daily and hourly screen-time totals and per-app minutes; how many pages the browser extension blocked (never which sites); a site the child asks a parent to unblock |
| Location (eGuard Plus and eGuard Family only) | Each device's current location; visits, only if the family turns location history on; the family's saved places |
| Support | Support ticket messages |
| Parent care | A parent's preferences, recorded consent per channel, activity progress and message records (no message text is stored) |
| Mailing lists | Email addresses of people who joined "eGuard news" or the iPhone launch list without an account |

**Never collected:** messages, contacts, calls, what a child types, browsing history or web content, photos or files on the child's device, audio, calendar, health information, and card details.

## Data categories: financial, partner and employee data

Financial, partner and employee data is the data DevCom holds about purchases, organizations, suppliers and its own staff.

| Category | Examples | Notes |
|---|---|---|
| Financial data | Each purchase's plan, state, paid-through date and PayMongo reference numbers; sponsor-code batch amounts; refunds | Card details go from the browser straight to PayMongo; eGuard's servers only see reference numbers |
| Partner data: organizations | Organization name and kind (school, community, business); its admins (who are eGuard users); join code; sponsor-code batches and codes; Organization API keys (stored only as a hash); daily counts of families joined and codes redeemed | The family that redeemed a code is stored on the code for support and refunds only, and is never shown to the organization |
| Partner data: suppliers | Accounts with PayMongo, Google Play, Apple, Vercel, Resend, Firebase and MapTiler; the company's D-U-N-S registration | [TO CONFIRM: where supplier contracts and account details are kept] |
| Employee data: staff accounts | Staff email, name, password hash and a sealed authenticator secret; signed-in sessions (stored only as a hash); the staff audit log | Staff accounts are separate from eGuard user accounts, so a parent account can never open the console |
| Employee data: other | [TO CONFIRM: what other employee data DevCom holds, and where] | |

## Confidentiality levels

DevCom has no recorded classification scheme yet. This policy uses four levels until the owner confirms them: [TO CONFIRM: owner approval of the four confidentiality levels].

| Level | Meaning | Examples from the business |
|---|---|---|
| Public | Already published, or approved for publication | Website pages, published prices and plan features, the published sponsor-code volume discounts, the privacy policy and terms, Help Center and Knowledge Center articles, the press release once sent |
| Internal | For anyone working on eGuard; not for customers or the public | This knowledge library, system and feature documentation, console totals (families, devices, open tickets), the sign-up funnel numbers, plans not yet released (such as eGuard for Windows before it ships) |
| Confidential | Only for the staff who need it for their work | A family's account details shown in the console (parent emails, purchases, support tickets); organization details; internal pricing rules, costs, margins and price-review thresholds (see "Pricing and Discount Rules"); competitor analysis |
| Restricted | Never seen by staff, or held only by the systems and people that must hold it | Children's location, visits, app use, screen time, alerts and photos; passwords and authenticator secrets; payment and server keys; signing keys; device tokens; unused sponsor codes (anyone holding one can redeem it); Organization API keys; the store-review demo account's sign-in details |

## Who may share what with whom: staff

Staff see accounts, not children's activity. The console shows only:

- plans and purchases
- parents (email, whether it is verified, how they sign in, whether two-step sign-in is on, last active)
- how many children, devices and browsers a family has
- support tickets
- organizations

The console never shows a child's location, places visited, browsing, app use, screen time, alerts or photos. These stay between the family and its devices, as the privacy policy promises. New console pages must keep to the same rule.

Every staff action that opens data is recorded in the staff audit log with who did it and when: signing in, opening a family, ticket, organization or broadcast, searching families (with the search text) and every change. The audit log is read-only. The console has no staff roles yet, so every staff member can see every console page; the Parent care pages show aggregated numbers only.

Staff must not put a real child's name, photo or location in any screenshot, press kit or store listing; screenshots use the demo family only. Public material must not claim user counts, ratings or "trusted by" endorsements until they are real.

## Who may share what with whom: families, organizations and the public

Families, organizations, mailing-list subscribers and the public may each see only the data listed below.

| Who | May see or receive | Never |
|---|---|---|
| Parents in a family | Everything about their own family: children, devices, settings, activity, alerts and, on paid plans, location. Any parent can export the family's data | Another family's data |
| Family admin | All of the above, plus the family's plan, purchases and privacy settings such as location history | |
| A child's device | Its own child's rules only | Parent screens or other children's data |
| Organization admins | Counts of families joined and codes redeemed; the status of each code; the same through the Organization API | Names, children, devices, settings, activity, locations, or which family redeemed a code. This rule has no exceptions and no setting that changes it |
| Mailing-list subscribers | Emails for the list they joined | |
| The public | Public-level material only | Anything Internal, Confidential or Restricted |

Data is never sold, and eGuard shows no ads.

## Rules for personal data: collection

1. **Collect only what is needed** to apply and verify the family's protections. eGuard collects settings, screen-time totals and app names, not content.
2. **Never hidden.** eGuard is visible on the child's device; on Android it shows a notification while it is active, and a page written for children is at www.eguard.family/for-kids.
3. **Location only when allowed.** Location is collected only on eGuard Plus and eGuard Family, and only while sharing is on. On Free the server drops every location reading.
4. **Consent per channel.** Parent care sends push or email only to parents who have opted in for that channel; consent is recorded. Parent care messages never name a child.
5. **Double opt-in for mailing lists.** An address joins a list only after the person confirms by email.
6. **No tracking in the apps.** The apps contain no analytics, ads or tracking tools. Ad pixels are never placed on signed-in pages or on the page for children.

## Rules for personal data: retention periods

Personal data retention periods set how long eGuard keeps each kind of data before deleting it.

| Data | Kept for |
|---|---|
| Activity | Deleted automatically after 90 days |
| Current location | Only the latest location per device. Deleted when location sharing is turned off or the plan loses location sharing |
| Location history (visits) | Off unless the family admin turns it on. When on, default retention is 90 days (set in Settings › Privacy). Turning history off deletes every child's visits at once |
| Organization activity events | 30 days |
| Unconfirmed mailing-list sign-ups | 7 days |
| Parent care records | Events 400 days; messages 365 days; finished jobs 90 days; weekly plans 400 days; preferences and activity progress for as long as the account exists |
| Staff console sessions | End 12 hours after sign-in or after 30 minutes idle |
| Other data (account, children, devices, purchases, support tickets) | [TO CONFIRM: retention periods for account, purchase and support data, including any legal minimum for financial records] |

## Rules for personal data: export and deletion

1. **Export.** Any parent can download the family's data as a file from Settings, on the web or in the app. The export contains parents, children, settings, devices, app rules, screen time, location visits and saved places, history, alerts, browsers, support requests and purchases, plus the parent's own Parent care data. It never includes passwords or tokens. Each export is recorded in the family's audit log.
2. **Account deletion.** A parent deletes their account in Settings › Delete account (web or app). Deleting the family admin's account deletes the whole family: children, devices, history and other parents. Deleting another parent's account removes only that parent. Parent care data is deleted with the account.
3. **Deletion without signing in.** www.eguard.family/delete-account explains the steps and how to request deletion by email for people who cannot sign in.
4. **Smaller deletions.** Deleting a child deletes the child's visits; removing a device deletes its visit history if the parent chooses; unsubscribing from a mailing list deletes the address from every list.
5. **Organizations.** When a family is deleted, the link from any sponsor code it redeemed is removed. Deleting an organization deletes its members, memberships, batches and unredeemed codes; plans already redeemed stay with the family.

## Sending data outside the company

Personal data leaves DevCom only through the approved tools below, each used for its stated purpose. Adding a tool needs approval from [TO CONFIRM: role that approves new tools and processors].

| Tool | Purpose | What it receives |
|---|---|---|
| PayMongo | Payments and refunds | Payment details, entered directly on PayMongo; the parent's email for checkout |
| Vercel | Hosting the website, apps' server and scheduled jobs | All service data, as the host |
| Resend or SMTP | Email to parents and subscribers | Email address and message |
| Firebase Cloud Messaging | Push notifications | Push tokens and the alert being sent |
| MapTiler | Map tiles | Map requests made by eGuard's server, so the provider never sees the parent's address or which area they look at |
| Google reCAPTCHA v3, Have I Been Pwned | Sign-in and sign-up protection | [TO CONFIRM: what each receives] |
| Anthropic Claude or OpenAI | "Write with AI" drafts of broadcast emails | Only what staff type; never a parent's name, address or data |
| Google Play Console, Meta Business Suite | Store listing and Facebook Page | Public material only |

Other rules:

- **Email to parents** goes from the console as a broadcast. A service notice (terms or privacy changes, security notices, outages, account changes) reaches every verified parent; a product update reaches only parents who opted in.
- **Customer replies** go from the support inbox, support@devcomdigital.com.
- **Keys and secrets** stay out of shared documents, chat and code. A key that may have leaked is revoked or rotated straight away.

## Reporting a suspected data incident

A suspected data incident is any event where personal data may have been seen, changed, lost or sent to someone who should not have it. Examples: a payment or server key appears in a shared place; an Organization API key may have leaked; a staff account may be used by someone else; a family's data is shown to another family or an organization.

The reporting role and deadline are not yet set: [TO CONFIRM: which role receives incident reports, and how fast]. Until they are, colleagues follow these steps:

1. Report the suspected incident at once to [TO CONFIRM: incident contact role and channel], and to the Data Protection Officer at [TO CONFIRM: DPO name and contact].
2. Contain it where possible: revoke a leaked Organization API key on the organization's page (it stops on the next request), rotate leaked payment keys in the PayMongo dashboard, and deactivate a suspect staff account, which signs it out everywhere.
3. Do not delete logs. The staff audit log and family audit logs show who opened what.
4. The Data Protection Officer decides whether affected parents and the National Privacy Commission must be told, and how fast: [TO CONFIRM: legal notification requirements and deadlines]. Parents are told by a service notice from the console.

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role; suggested: Data Protection Officer] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Company Overview; Company Glossary; Systems Overview; Customer Support Playbook; Pricing and Discount Rules |

## Open questions

1. [TO CONFIRM: where supplier contracts and account details are kept]
2. [TO CONFIRM: what other employee data DevCom holds, and where]
3. [TO CONFIRM: owner approval of the four confidentiality levels]
4. [TO CONFIRM: retention periods for account, purchase and support data, including any legal minimum for financial records]
5. [TO CONFIRM: role that approves new tools and processors]
6. [TO CONFIRM: what Google reCAPTCHA v3 and Have I Been Pwned each receive]
7. [TO CONFIRM: which role receives incident reports, and how fast]
8. [TO CONFIRM: incident contact role and channel]
9. [TO CONFIRM: DPO name and contact.] launch-visibility.md: the site lists "DevCom's Data Protection Officer", but the DPO is not yet designated by name with the National Privacy Commission.
10. [TO CONFIRM: legal notification requirements and deadlines for a data incident]
11. [TO CONFIRM: owner role for this policy, effective date and review date]
12. **Legal review.** launch-visibility.md: the privacy policy and terms have not been reviewed by a lawyer. features/parent-care.md: Parent care was designed for the Data Privacy Act's principles but is "not reviewed by counsel or a DPO", and the privacy policy does not yet describe the holdout group (10% of parents who receive no Parent care messages, for comparison).
13. **Push alerts.** This policy lists Firebase Cloud Messaging as an approved tool. Sources disagree on whether push alerts are live: profile.md and faq.md say every plan gets push for security alerts; app-listing.md says "Push notifications aren't wired up"; organizations.md says "push isn't wired up for any alert yet"; mobile-api.md says alerts are pushed through FCM.
14. **Store data-safety answers.** app-listing.md was written while "the native apps aren't built yet" and leaves crash logs and diagnostics as "Confirm against the build". If the apps add any crash-reporting tool, the customer data list above and the privacy policy must be updated.
15. **"Share anonymous product analytics".** app-listing.md says this setting is off by default and never includes children's data. What it collects and where it goes is not described.
