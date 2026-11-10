# Company Glossary

## Summary

The Company Glossary defines the terms, product names, roles, system names and abbreviations used at DevCom Digital Marketing Services (short: DevCom) for eGuard, grouped by theme. It is for every colleague who writes, sells, supports or builds eGuard, so that everyone uses the same word for the same thing. Where two words are used for one thing, the official term is in the "Term" column and the other appears under "Not to be confused with" as an alias; for example, "eGuard Family" is the official name of the plan that code and older documents call "Pro" or "Family Pro". Prices are not repeated here; they are in the "Products and Services Catalogue". Terms that only appear in code are included only when staff are likely to meet them in documents or the console.

## Company and brand terms

Company and brand terms name DevCom, eGuard and the people and addresses behind them.

| Term | Meaning | Not to be confused with |
|---|---|---|
| DevCom Digital Marketing Services | The company that makes eGuard, based in Baybay City, Leyte, Philippines. Short form: DevCom | |
| eGuard | DevCom's parental control product for Filipino families: parents set protections on their children's devices, and eGuard shows whether each one is actually applied | "eguard" in lower case is the project name, not the product name |
| www.eguard.family | eGuard's website, where parents sign up, manage their family and buy plans | The staff console address, console.eguard.family |
| Owner | The person who accepts or rejects product, pricing and engineering recommendations | Organization owner (a customer role) |
| Staff | People at DevCom who use the console to look up families, handle tickets and send broadcasts. Staff accounts are separate from eGuard user accounts | Parents; organization admins |
| Support inbox | support@devcomdigital.com, where parents email and where ticket replies are sent from | |

## Products and platforms

Product and platform terms name each part of eGuard that a family or parent uses.

| Term | Meaning | Not to be confused with |
|---|---|---|
| eGuard for Android | The eGuard app on a child's Android phone or tablet | The same app in parent mode, used by a parent |
| eGuard browser extension | The extension for Chrome, Edge and Firefox that applies a child's browser rules | |
| Parent web dashboard | The signed-in part of www.eguard.family where parents manage their family | Staff console |
| eGuard parent app | The eGuard app in parent mode on a parent's phone. There is one app with two modes, not separate parent and child apps | eGuard for Android in child device mode |
| eGuard for Windows | Protection for a child's Windows PC, in testing. Technical documents call it the "desktop agent" or "PC agent" (alias) | eGuard browser extension, which it installs in the PC's browsers |
| eGuard for iPhone and iPad | The app for Apple devices; coming soon | |
| Knowledge Center | eGuard's library of 100 free guides for parents at www.eguard.family/learn. The site menu calls it "Learn" (alias) | Help Center; the blog, which is for product news |
| Help Center | Setup and troubleshooting articles at www.eguard.family/help | Knowledge Center |
| Demo family | The made-up family used in screenshots, the press kit and app store review. No real child's name, photo or location is ever shown | A real customer family |

## Plan terms

Plan terms describe the plans families choose from and what each plan allows. Prices are in the "Products and Services Catalogue".

| Term | Meaning | Not to be confused with |
|---|---|---|
| Plan | What a family pays for: Free, eGuard Plus or eGuard Family. The subscription belongs to the family, not to one parent | |
| Free | The base plan every family starts on and returns to: 1 child, 1 device | |
| eGuard Plus | The first paid plan | The free "eGuard Plus" plan that existed before September 2026 (retired) |
| eGuard Family | The largest plan. Aliases: "Pro" (in code, prices and the Google Play product) and "Family Pro" (its name before 2026-10-28) | The retired paid plan called "eGuard Family" before September 2026, and the customer group "family" |
| Legacy limits | The older, larger limits kept by families who were paying before 2026-10-28, for as long as they stay on a paid plan | Current plan limits |
| Plan limits | The number of children and devices a plan allows | |
| Device slot | One place in the plan's device limit. A phone, tablet, browser or PC each takes one. Whether a browser on a paired Windows PC takes its own slot is [TO CONFIRM: whether a browser on a paired Windows PC takes a device slot] | |
| Entitlement | What a plan unlocks, checked on the server (for example location sharing or advanced reports) | |

## Billing and payment terms

Billing and payment terms describe how families pay for a plan and what happens when a payment fails.

| Term | Meaning | Not to be confused with |
|---|---|---|
| Pass | One month or one year of a plan, paid once. It never renews | Auto-renew |
| Auto-renew | A card or Maya is charged every month or year until turned off | Pass |
| Grace period | The 3 days a family keeps its plan while a failed auto-renew payment is retried ("past due") | |
| Sponsored plan | A plan paid for by a sponsor code; shown to the family as "Sponsored plan" | |
| PayMongo | The payment provider for every plan purchase and sponsor-code batch | Google Play billing, which is built but turned off |
| Philippine peso (₱) | The currency of every price, written "₱149". Payment amounts are handled in centavos | PHP is the currency code |

## Organization terms: organizations and membership

Organization terms cover schools, community groups and businesses that help families through eGuard, and how families join them.

| Term | Meaning | Not to be confused with |
|---|---|---|
| Organization | A school, community group or business in eGuard that helps many families at once | A family |
| Organization admin | An eGuard user who manages an organization, either as owner or admin | Family admin; staff |
| Organization owner | The organization admin who created it, or was made owner. The last owner cannot be removed | The company owner |
| Join code | The code (XXXX-XXXX) a family admin enters to join an organization. Joining grants nothing and can be undone | Sponsor code; pairing code |
| Membership | A family's link to an organization, created and removable by the family | |
| Counts only | The rule that an organization sees how many families joined and redeemed codes, never a family's data | |

## Organization terms: sponsor codes and the Organization API

Sponsor code and Organization API terms describe how an organization pays for families' plans and reads its own figures.

| Term | Meaning | Not to be confused with |
|---|---|---|
| Sponsor code | A code (XXXX-XXXX-XXXX) that gives one family a paid plan for 1, 3, 6 or 12 months. Anyone holding it can redeem it, like a gift card | Join code |
| Batch | One purchase of sponsor codes: a plan, a number of months and a quantity, paid once | Configuration batch (a set of setting changes sent to devices) |
| Volume discount | The lower price per code in larger batches. Rules are in "Pricing and Discount Rules" | |
| Redeem-by date | The date after which an unused sponsor code expires: 12 months after the batch was paid | The end date of the plan the code gives |
| Organization API | The interface an organization's own systems use to read its codes, batches and counts. Needs an admin on eGuard Family | The mobile API used by the apps |
| API key | A key for the Organization API, shown once, either "Read only" or "Read and cancel codes". "Paused" means its admin's family is no longer on eGuard Family | |

## Customer roles and accounts

Customer role and account terms describe who is who inside an eGuard family.

| Term | Meaning | Not to be confused with |
|---|---|---|
| Family | One household's account: its parents, children, devices and plan | eGuard Family (the plan) |
| Family admin | The parent who owns the family's subscription and the admin-only actions, such as buying a plan, redeeming a sponsor code or changing privacy settings. FAMILY_ADMIN in code | Organization admin |
| Parent | Any parent or guardian in the family, aged 18 or over, with an eGuard account. PARENT in code. A family can have more than one parent on every plan | Family admin |
| Child | A profile a parent creates. Children never have accounts and never sign in | |
| Parent mode | The eGuard app used by a signed-in parent | Child device mode |
| Child device mode | The eGuard app on a child's device, paired to one child. Nobody signs in | Parent mode |
| Two-step sign-in | An authenticator code asked for after the password. Also called "two-step verification" | |
| Invitation | How a family admin adds another parent to the family | Organization admin invitation |

## Devices and pairing

Device and pairing terms describe how a child's device or browser is connected to eGuard.

| Term | Meaning | Not to be confused with |
|---|---|---|
| Device | A child's phone, tablet or Windows PC protected by eGuard. Browsers also count toward the device limit | |
| Pairing | Connecting a device or browser to a child with a one-time code | Joining an organization |
| Pairing code | The 8-character, one-time code a parent gets on the dashboard and types on the child's device. It works for 15 minutes | Join code; sponsor code |
| Browser code | The pairing code for adding a browser ("Add a browser") | |
| Primary device | A child's first device, listed first and shown on the child's card | |
| Sync | A device checking in with eGuard to get its rules and changes, about every 5 minutes for phones | |
| Device states | Healthy (online, every protection passing); "*n* issues" (online, some protections not passing); Offline (no sync for 24 hours); Waiting for first check (nothing reported yet) | Child status |

## Protections

Protection terms name the 10 settings areas eGuard applies and checks. The tools around them are in "Protection tools".

| Term | Meaning | Not to be confused with |
|---|---|---|
| Protection | One of the 10 settings areas eGuard applies and checks: Screen Time, Bedtime, App Restrictions, App Approval, Content Restrictions, Web Filtering, Downloads, Location, Notification Controls, Uninstall Protection | A plan feature |
| Screen Time | A daily limit, with an optional separate weekend limit | Extra time |
| Bedtime | Pauses the device overnight, every day or on school nights | Notification Controls |
| App Restrictions | Limits apps by age rating; per-app daily limits and blocking | App Approval |
| App Approval | The child asks for an app; the parent approves or declines | Downloads |
| Content Restrictions | Age ratings for movies, TV and books | Web Filtering |
| Web Filtering | Blocks adult sites, or allows only sites the parent chooses | |
| Downloads | Requires the parent's approval to install apps | App Approval |
| Location | Shows where the child's device is now | Location history |
| Notification Controls | Keeps the device quiet during bedtime | |
| Uninstall Protection | Stops eGuard being removed without the parent | |

## Protection tools

Protection tool terms name the starting profiles, shared limits and extra time that work alongside eGuard's 10 protections.

| Term | Meaning | Not to be confused with |
|---|---|---|
| Profiles: Protected, Balanced, Custom | Starting settings suggested for a child's age when the child is added. Protected is recommended under 13, Balanced from 13 | Plans |
| Category limits | One limit across a category of apps, such as "gaming time" across all games; eGuard Plus and up | Per-app limits |
| Extra time | Time a parent gives that lets the child keep using apps past a limit or bedtime for a while; blocked apps stay blocked. A child can ask for it with "Ask for more time" | Screen Time limit |

## Verification and status terms

Verification and status terms describe how eGuard reports whether protections are really in place.

| Term | Meaning | Not to be confused with |
|---|---|---|
| Verified | A setting the child's device has confirmed it has | "Saved", which only means the parent chose it |
| Failed | The device reported something other than what the parent set; the parent sees what the device reported | "Didn't match", the same result shown on a configuration request |
| Configuration Health | One score per child across the 10 protections, based on what the child's devices report. It measures device settings, never the child's behavior | A rating of the child |
| Configuration check | A check the parent can run any time to see whether protections are in place | |
| Configuration history | The record of changes to a child's protections; on every plan | 30-day reports (eGuard Family) |
| Configuration batch | A set of setting changes sent to a child's devices at once | Batch of sponsor codes |
| Guided setup | eGuard shows the parent steps to do on the device, then confirms the result | Applied directly by eGuard |
| Set by you | A protection the device cannot read, recorded on the parent's word. Never shown as "Verified" | Verified |
| Unsupported | A protection the platform does not allow. It never counts against Configuration Health | Failed |
| Child status | Protected; Needs attention; Not configured (no phone or tablet) | Device states |

## Alerts

Alert terms describe the messages eGuard sends parents when something on a device needs attention.

| Term | Meaning | Not to be confused with |
|---|---|---|
| Alert | A message to parents in the app and by email, with a link to the fix | Broadcast |
| Alerts when a setting changes | An alert when a protection changes on the device ("Protection setting changed"). eGuard Plus and up. "driftAlerts" in code; "drift" is the alias | Tamper and removal alerts |
| Tamper and removal alerts | Alerts when eGuard is removed, tampered with or a protection turned off. On every plan, and these are the "security alerts" that are pushed on Free. Whether push alerts work is [TO CONFIRM: whether push alerts work] | Alerts when a setting changes |
| Alert severity | Info, Attention, Action required, Critical | |

## Location terms

Location terms describe eGuard's location features, which are part of eGuard Plus and eGuard Family.

| Term | Meaning | Not to be confused with |
|---|---|---|
| Location sharing | Showing each device's current location to parents. eGuard Plus and up | Location history |
| Location history | Places the child's devices stayed at, kept only if the family admin turns it on. Default retention 90 days | Current location |
| Visit | One stay at a place in location history. A stay of under 4 minutes shows as "passing by" | |
| Saved place | A place a parent names, such as home or school; up to 30 per family | |

## Browser extension terms

Browser extension terms are specific to the eGuard browser extension for Chrome, Edge and Firefox.

| Term | Meaning | Not to be confused with |
|---|---|---|
| Installation | The eGuard browser extension's connection to eGuard after pairing | A device |
| Access request | A child's request to open a blocked site; the parent can allow it for 15 minutes, an hour, today or always | App Approval |
| Signed policy | The browser rules, digitally signed so the extension only enforces rules that came from eGuard | |
| Block counts | How many pages the extension blocked. Never which sites | Browsing history (never collected) |
| Safe Browsing, SafeSearch | Browser and search-engine safety settings the extension turns on | Web Filtering |
| Focus hours | Times set by the parent when the browser blocks everything not on the allowed list | Bedtime |
| Disconnected for security | A browser whose connection was cut because an old credential was reused; it must be added again | Offline |

## eGuard for Windows terms

eGuard for Windows terms are specific to protecting a child's Windows PC, which is in testing.

| Term | Meaning | Not to be confused with |
|---|---|---|
| Child's accounts | The Windows accounts on a PC where eGuard applies the child's rules, chosen by the parent when pairing | The parent's own Windows account, which is not limited |
| Standard account | A Windows account without administrator rights. The child must use one for Uninstall Protection to hold | Administrator account |
| App scan | eGuard for Windows listing installed games and apps from publishers eGuard cannot vouch for | |
| Tamper event | An attempt to stop, change or remove eGuard on a PC, such as starting in Safe Mode or changing the clock. Each raises an alert | |
| Removal code | An offline code a parent types on the PC to remove eGuard when the PC cannot reach eGuard | Pairing code |
| Gaming time | A category limit that covers games on phone and PC together | Screen Time |

## Parent care terms

Parent care terms describe the optional tips, plans and reminders eGuard sends parents.

| Term | Meaning | Not to be confused with |
|---|---|---|
| Parent care | Optional tips, weekly plans, reminders, check-ins and monthly reports that help parents use eGuard. Parents see it as "Safety plan" and "Tips and reminders" (aliases) | Alerts, which are never delayed by Parent care |
| Automation | One of five Parent care message types: briefing, follow-up, weekly plan, check-in, monthly report | Broadcast |
| Holdout | The 10% of parents who get no Parent care messages, so results can be compared | |
| Quiet hours | Times a parent receives no push or email from Parent care; default 21:00–07:00 local time | Bedtime |
| Contact limits | The most Parent care messages a parent can get: 1 push or email a day and 3 a week; 2 in-app a day and 6 a week | |
| Qualifying activity | A real parent action, such as changing a protection, that counts as being active. App opens do not count | |

## Staff console and communications

Staff console and communication terms describe the staff back office and the ways DevCom contacts parents.

| Term | Meaning | Not to be confused with |
|---|---|---|
| Console | The staff back office at console.eguard.family: families, support tickets, organizations, broadcasts, Parent care and the audit log | Parent web dashboard |
| Staff audit log | The read-only record of what each staff member opened or changed in the console | Family audit log, which records actions in a family |
| Support ticket | A message a parent sends from Contact Support in the app or Settings › Support on the web; Open or Closed | |
| Broadcast | One email to many parents or subscribers, sent from the console | Alert |
| Service notice | A broadcast to every verified parent whatever their settings, for terms or privacy changes, security notices, outages and account changes. Never for news | Product update |
| Product update | A broadcast only to parents who left "Product updates" on, for new features and news. Has an unsubscribe link | Service notice |
| Mailing list | A public list people join without an account: "eGuard news" or "iPhone launch". Joining needs email confirmation (double opt-in) | Parents who receive product updates |
| Write with AI | A console tool that drafts a broadcast's subject and message from what staff type, using Claude or OpenAI. Nothing is sent until staff save, test and confirm | |
| Maintenance job | The scheduled job that runs every 10 minutes: sends broadcasts and reminders, refreshes purchases and deletes expired data | |

## Systems and suppliers

System and supplier terms name the outside services eGuard runs on. How they fit together is in "Systems Overview".

| Term | Meaning | Not to be confused with |
|---|---|---|
| Vercel | Hosts the website and server and runs the maintenance job | |
| PostgreSQL, Prisma | The database and the tool the code uses to work with it | |
| Resend, SMTP | Services that send eGuard's email. Mailpit catches email in testing | |
| Firebase Cloud Messaging (FCM) | Sends push notifications to phones | |
| MapTiler | Supplies map images, fetched through eGuard's server | |
| Google reCAPTCHA v3 | Bot check on the website's sign-in, create-account, forgot-password and mailing-list forms, when switched on | |
| Have I Been Pwned | Service used to check passwords against known leaks; only the start of a scrambled form of the password is sent | |
| Google Play Console | Where the Android app's store listing and products are managed | |
| Google Search Console, Bing Webmaster Tools | Where the website's search listing is monitored | |
| Meta Business Suite | Where the eGuard Facebook Page is managed | |
| Code-signing certificate | The certificate that signs eGuard for Windows so Windows does not warn on install. An OV (organization validation) certificate is planned | |

## Privacy, legal and abbreviations

Privacy, legal and abbreviation terms appear in eGuard's privacy material and store paperwork.

| Term | Meaning | Not to be confused with |
|---|---|---|
| Data Privacy Act of 2012 (RA 10173) | The Philippine law eGuard's privacy policy is written under | |
| NPC | National Privacy Commission | |
| DPO | Data Protection Officer: the contact for privacy requests | |
| Personal-information controller | The role DevCom holds for eGuard's personal data | Supplier acting for DevCom |
| D-U-N-S | Dun & Bradstreet's company number, needed for Apple developer verification | |
| Data export | The file any parent can download with the family's data | |
| Delete account | Deleting a parent's account; the family admin's deletion deletes the whole family | Removing a device |
| PH time | Philippine time (Asia/Manila), the time zone for schedules and reports | |

## Customer segments

Customer segment terms name the groups DevCom sells eGuard to.

| Term | Meaning | Not to be confused with |
|---|---|---|
| Families | Parents and guardians in the Philippines who protect their children's devices | Organizations |
| Schools | Organizations of kind "School", such as a school or PTA helping its families | |
| Community groups | Organizations of kind "Community", such as a barangay funding plans for families who cannot pay | |
| Businesses | Organizations of kind "Business", such as an employer offering eGuard as a benefit | |

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Company Overview; Products and Services Catalogue; Data Handling and Confidentiality; Systems Overview; Customer FAQ |

## Open questions

1. [TO CONFIRM: owner role for this glossary, effective date and review date]
2. [TO CONFIRM: team and department names.] The sources name no teams, so this glossary has no team section; it should be added once "Teams and Responsibilities" exists.
3. **Plan limits.** This glossary does not repeat limits beyond Free's. Several sources still show old limits (faq.md: "Up to 5" and "Up to 10" children; features/children.md section 6 "Free 1, Plus 5, Pro 10"; features/devices.md section 6 "Free 2, Plus 10, Pro 20"; mobile-api.md `/subscription/plans` examples). The current limits are in the "Products and Services Catalogue".
4. **Device slot for a browser on a PC.** [TO CONFIRM: whether a browser on a paired Windows PC takes a device slot.] faq.md quotes the pricing page: "Chrome and Edge on one laptop count as two devices"; pricing-desktop.md and browser-extension-api.md say browsers on a paired PC take no slot. The "Device slot" entry leaves this out.
5. **Profiles.** profile.md lists three profiles (Protected, Balanced, Custom); features/children.md offers only Protected or Balanced when adding a child. Whether "Custom" is a profile a parent picks or simply any changed setting needs confirming.
6. **Age-rating tiers.** mobile-api.md: "4, 9, 13, 16, 18"; child-app-spec.md: "4, 9, 12, 13 or 17"; features/protection.md: "4, 9, 12, 13, 16, 17, 18". The glossary does not list tiers until this is settled.
7. **PC sync interval.** pricing-desktop.md: "A PC syncs every 5 minutes, like a phone"; desktop-agent-spec.md and mobile-api.md: computers sync every 60 seconds. The "Sync" entry gives only the phone interval.
8. **Push for security alerts.** The "Tamper and removal alerts" entry follows profile.md and faq.md (pushed on every plan). app-listing.md and organizations.md say push is not wired up yet.
9. **Old plan names.** subscriptions.md: before September 2026 there was a free "eGuard Plus" and a paid "eGuard Family" (both retired); old products still grant eGuard Family while paid. Staff reading older records may meet these names.
