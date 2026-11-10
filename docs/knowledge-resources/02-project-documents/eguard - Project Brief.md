# eguard: Project Brief

## Summary

The eguard Project Brief describes the eguard project: the product work on eGuard, the parental control product of DevCom Digital Marketing Services, as recorded in the company's working documents up to 2026-11-10. The owner has not yet chosen the project objective, so the goal, the deadline and the main deliverable are all [TO CONFIRM: project objective, deadline and main deliverable]. The sources describe several workstreams at different stages: the public website and parent web dashboard are live, eGuard for Windows has its server side built but not its agent, Parent care is built but not deployed, and eGuard for iPhone and iPad is "coming soon". The brief is for anyone joining the work who needs the status, the measures and the limits in one place; details live in the related documents listed under "Document control".

## eguard: Background and business problem

eGuard lets parents set screen time, bedtime, app and web protections on their children's devices and shows whether each one is actually applied on the device, marked Verified or Failed. The business problem, as stated in profile.md and press-release.md, is that most parental controls stop at "Saved": a setting can be saved and still not be on the device, because the phone was offline, a system update reset a permission, or someone switched it off. From the parent's side, nothing looks different.

eGuard is built for families in the Philippines, with prices in Philippine pesos, local payment methods through PayMongo, and a privacy policy written under the Data Privacy Act of 2012 (RA 10173). Plans and prices are in the "Products and Services Catalogue" and "Pricing and Discount Rules".

Why the work matters now is not stated in the sources: [TO CONFIRM: why now]. The press material suggests a seasonal hook: press-release.md recommends pitching Philippine media from late October to mid-November so coverage can run before the Christmas break.

## eguard: Goal and success measures

The project goal is [TO CONFIRM: project objective]. The sources do not set overall project targets: [TO CONFIRM: overall project targets].

The sources do define three sets of measures that a confirmed objective could adopt:

| Measure | Target stated in the source | Source |
|---|---|---|
| Sign-up funnel: landing visit → account → email verified → first child → first device paired → upgrade | No target; reviewed on day 30 of the launch plan, then weekly | launch-visibility.md |
| eGuard for Windows price review: share of paying families who pair a PC | At least 25% | pricing-desktop.md |
| eGuard for Windows price review: Free-to-eGuard Plus conversion among families with a PC | At least 1.5 times that of families without one | pricing-desktop.md |
| eGuard for Windows price review: monthly churn among families with a PC | No worse than families without one | pricing-desktop.md |
| eGuard for Windows price review: PCs with uninstall or tamper alerts that were eGuard's fault | Fewer than 5% | pricing-desktop.md |
| Parent care pilot: 7-day retention | +10% relative, treatment versus holdout (a hypothesis) | features/parent-care.md |
| Parent care pilot: 30-day retention | +5% (a hypothesis) | features/parent-care.md |
| Parent care pilot: reactivation | 15–25% (a hypothesis) | features/parent-care.md |

The Parent care figures are hypotheses, to be read from the treatment-versus-holdout difference with a few hundred parents per group, never from before-and-after comparisons.

## eguard: Scope included

The project scope is [TO CONFIRM: project scope]. Until the owner confirms it, the sources describe the following eGuard workstreams as active or recently active:

| Workstream | Status in the sources |
|---|---|
| Public website at www.eguard.family | Published; trust fixes and the production go-live checklist in launch-visibility.md are mostly ticked |
| Parent web dashboard, plans and web billing | Live; plan-limit change released 2026-10-28 |
| eGuard for Android and the eGuard browser extension | Described as available in customer-facing sources; whether the Android app is live on Google Play is [TO CONFIRM: whether eGuard for Android is live on Google Play] (see Open questions) |
| eGuard for Windows | Server side built 2026-10-23 and 2026-10-24; the agent, its installer, code signing and the download page are not built (desktop-agent-spec.md) |
| Parent care | Implemented and tested; "Nothing has been deployed" as of 2026-10-21 (features/parent-care.md) |
| eGuard for iPhone and iPad | "Coming soon"; store blockers open (app-listing.md) |
| Organizations, join codes and sponsor codes | Phase 1 built 2026-10-01 (organizations.md) |

## eguard: Scope excluded

The sources do not state what the project excludes: [TO CONFIRM: what is out of scope]. Some items are stated as out of scope for individual features and may carry over:

- Organizations: redeeming sponsor codes or buying them in the mobile apps; Phase 2 to 4 features such as school-approved websites, the anonymous impact report and employer invoicing (organizations.md).
- The child device app: reading messages, photos, files, browsing content or keystrokes; call or SMS logs; chat between child and parent; hiding the app (child-app-spec.md).
- eGuard for Windows: a Mac agent, which "comes later" (desktop-agent-spec.md).

## eguard: Deliverables

The project's deliverables are [TO CONFIRM: deliverables]. The open items the sources name, which are candidates once the objective is set:

| Deliverable | Description | Due date | Owner role |
|---|---|---|---|
| eGuard for Windows agent and installer | Windows service, session agent and guard, built to desktop-agent-spec.md and passing its acceptance tests | [TO CONFIRM] (no Windows release date) | [TO CONFIRM] |
| Code-signing certificate | OV certificate with cloud signing (code-signing.md) | Start 3–4 weeks before the Windows beta | Owner (desktop-agent-spec.md "Needs the owner") |
| Windows test PC or virtual machine | Windows 11 with Steam and Counter-Strike 2, for the acceptance tests | [TO CONFIRM] | Owner (desktop-agent-spec.md "Needs the owner") |
| Parent care pilot | Pilot run after the four steps in features/parent-care.md "Before the pilot" | [TO CONFIRM] | [TO CONFIRM] |
| eGuard for iPhone and iPad | App Store release after the StoreKit decision and the Family Controls entitlement | [TO CONFIRM] | [TO CONFIRM] |
| Legal review and DPO registration | Lawyer review of the privacy policy and terms; Data Protection Officer named with the National Privacy Commission | [TO CONFIRM] | [TO CONFIRM] |
| Google Play yearly base plans | Yearly base plans on the two Play subscription products | [TO CONFIRM] | Owner, in Play Console (pricing-desktop.md) |

## eguard: Timeline and milestones

The project deadline is [TO CONFIRM: project deadline]. Dates already recorded in the sources:

| Date | Milestone | Source |
|---|---|---|
| 2026-09-28 | First website audit | launch-visibility.md |
| 2026-10-01 | Organizations Phase 1 built | organizations.md |
| 2026-10-04 | Website audit re-run on the live domain | launch-visibility.md |
| 2026-10-08 | eGuard for Android to use on-device APIs, not Google Family Link | child-app-spec.md |
| 2026-10-17 | Marketing site review items built | marketing-site-review.md |
| 2026-10-21 | Parent care implemented and tested, not deployed | features/parent-care.md |
| 2026-10-23 | Windows pricing decisions accepted; Windows server side built; yearly plans built | pricing-desktop.md, desktop-agent-spec.md |
| 2026-10-24 | Further Windows agent decisions; agent self-update built (waits for the VM test and the certificate) | desktop-agent-spec.md |
| 2026-10-28 | Plan-limit change released; privacy policy updated for Parent care | plan-change-2026-10.md, features/parent-care.md |
| 2026-11-14 | Old sign-in cookie stops being read; legacy code can be removed after | features/authentication.md |
| 90 days after eGuard for Windows leaves beta | Price review | pricing-desktop.md |
| About April 2027 | Six-monthly re-check of Knowledge Center facts (from 4 October 2026) | knowledge-center.md |
| [TO CONFIRM] | eGuard for Windows release | faq.md says no release date |
| [TO CONFIRM] | eGuard for iPhone and iPad release | faq.md, profile.md say "coming soon" |

## eguard: Budget and cost limits

The project budget and spending limits are [TO CONFIRM: project budget and spending limits]. The only cost estimates in the sources are for eGuard for Windows:

| Cost | Estimate | Source |
|---|---|---|
| Code-signing certificate (OV, cloud signing) | About 200–500 US dollars a year, sometimes plus a cloud-signing fee; renews every year | code-signing.md |
| Server load from PCs | "Small" | pricing-desktop.md |
| Support for PC questions | "The biggest real cost"; no amount given | pricing-desktop.md |
| Game catalog upkeep | A few hours a month | pricing-desktop.md |

pricing-desktop.md gives a different code-signing estimate (see Open questions). Who may approve spending, and up to what limit, is [TO CONFIRM: spending approval role and limit].

## eguard: Teams and roles involved

The eguard project's teams and roles are named in the sources as roles, not as people or departments:

| Role | Responsibility in the sources |
|---|---|
| Owner | Accepts or rejects product, pricing and engineering recommendations; buys the code-signing certificate; manages Play Console products |
| Founder | Quoted in press material; name and title are placeholders in press-release.md |
| Staff | Use the console for families, support tickets, organizations, broadcasts and Parent care; no staff roles in version 1 |
| Data Protection Officer | Contact for privacy requests; not yet named with the National Privacy Commission |
| Lawyer (external) | Needed to review the privacy policy, terms and Parent care |
| Native Filipino speaker | Needed to review Filipino Parent care templates and the Filipino kids page |
| Suppliers | PayMongo, Google Play, Apple App Store, Vercel, Resend, Firebase, MapTiler, Dun & Bradstreet, a code-signing provider |

Names, titles, departments and whether the founder and the owner are the same person are [TO CONFIRM: names and titles of the owner and founder, and the company's teams].

## eguard: Constraints

The eguard project's main constraints are listed in full, with sources and consequences, in "eguard: Risks, Assumptions and Constraints". In short: the Data Privacy Act of 2012 (RA 10173); Google Play's payments and stalkerware policies; Apple's App Store guidelines on purchases and parental controls; no user counts, ratings or "trusted by" claims until real; staff never see a child's activity and organizations see counts only; no analytics, ads or tracking SDKs in the apps; the Windows agent never touches a game's process from the inside; and the marketing site must not mention PCs until eGuard for Windows ships.

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | eguard: Requirements and Acceptance Criteria; eguard: Decision Log; eguard: Risks, Assumptions and Constraints; Company Overview; Products and Services Catalogue (plans and features); Pricing and Discount Rules (prices, sponsor-code discounts); Systems Overview |

## Open questions

1. [TO CONFIRM: project objective, deadline and main deliverable]. The owner has not yet chosen which objective "the project" is.
2. [TO CONFIRM: why now] for the business problem.
3. [TO CONFIRM: overall project targets]; the funnel, Windows price-review and Parent care measures are candidates only.
4. [TO CONFIRM: project scope] and [TO CONFIRM: what is out of scope].
5. [TO CONFIRM: deliverables], with a due date and owner role for each candidate in the Deliverables table (seven due dates and four owner roles are open there).
6. [TO CONFIRM: project deadline], the eGuard for Windows release date and the eGuard for iPhone and iPad release date.
7. [TO CONFIRM: project budget and spending limits] and [TO CONFIRM: spending approval role and limit].
8. [TO CONFIRM: names and titles of the owner and founder, and the company's teams].
9. [TO CONFIRM: owner role] for this document, plus its effective date and review date.
10. Is the Android app live on Google Play? app-listing.md and child-app-spec.md say "The native apps aren't built yet"; faq.md, profile.md, press-release.md and facebook-page.md say Android works now "through the eGuard app on Google Play"; child-app-spec.md also refers to "Android 1.0.9". This brief follows the customer-facing sources until the owner answers.
11. Do push alerts work? launch-visibility.md lists eGuard Plus "Push alerts (coming soon)"; app-listing.md blocker 6 says "Push notifications aren't wired up"; organizations.md says "push isn't wired up for any alert yet". faq.md, profile.md and press-release.md say every plan gets push for security alerts and eGuard Plus and eGuard Family push every alert; mobile-api.md says alerts are pushed through Firebase Cloud Messaging.
12. Is eGuard for Windows built? desktop-agent-spec.md's status says the agent "is not built yet", while its section 10 says self-update was "built 2026-10-24".
13. Code-signing cost and option: pricing-desktop.md says "About $10 a month (Azure Trusted Signing), or $200–400 a year (OV certificate)"; code-signing.md says Azure Artifact Signing is "not available to us" and an OV certificate costs about $200–500 a year. This brief uses code-signing.md.
14. Launch checklist status: launch-visibility.md section 1 says the latest copy is "not deployed yet" and the email records "Needs attention"; the same file's section 9 checklist ticks both as done.
15. Plan limits: this brief follows subscriptions.md and plan-change-2026-10.md (Free 1 child / 1 device, eGuard Plus 3 / 5, eGuard Family 6 / 12, with legacy limits for families paying before 2026-10-28). faq.md, facebook-page.md (About text), features/children.md section 6, features/devices.md section 6 and the mobile-api.md plan examples show older, larger limits and look out of date.
16. Does a browser on a paired Windows PC take a device slot? faq.md quotes the pricing page FAQ: "Chrome and Edge on one laptop count as two devices"; pricing-desktop.md and browser-extension-api.md say browsers on a paired PC take no slot since 2026-10-23. [TO CONFIRM]
17. Is Parent care still undeployed? The status line is dated 2026-10-21 and may have moved.
18. press-release.md still has placeholders for the founder's name, title and quote, the release date, the phone number and the press kit link.
