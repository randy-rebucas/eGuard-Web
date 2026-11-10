# eguard: Risks, Assumptions and Constraints

## Summary

The eguard Risks, Assumptions and Constraints document lists the risks, assumptions and constraints for eGuard work that the company's working documents record, for anyone planning, building or releasing eGuard. The largest risks are on the platforms eGuard depends on: the iPhone and iPad app may be rejected without in-app purchases and needs an Apple entitlement that can take weeks; eGuard for Windows needs a code-signing certificate or Windows warns on every install; and anti-cheat software may block the agent from ending a game. Legal review is also open: the privacy policy, the terms and Parent care have not been reviewed by a lawyer or a Data Protection Officer. Likelihood and impact are given only where a source supports them; the rest are [TO CONFIRM], and the project objective itself is [TO CONFIRM: project objective].

## eguard risks: Apple and Google Play approval

The eguard Apple and Google Play approval risks concern whether the app stores accept and keep eGuard's apps.

| ID | Risk | Likelihood | Impact | Mitigation | Owner role | Trigger that means it is happening |
|---|---|---|---|---|---|---|
| RK1 | The iOS app is rejected because paid features unlock for web subscribers without StoreKit purchases (Apple guideline 3.1.3(b)) | High (source: "likely to be rejected") | [TO CONFIRM] | Build StoreKit subscriptions, or ship iOS with Free features only (app-listing.md section 6) | [TO CONFIRM] | App Store review rejects the build |
| RK2 | The Family Controls distribution entitlement from Apple is not granted in time; approval "can take weeks" | [TO CONFIRM] | High (source: App Store builds do not work without it) | Request it now (app-listing.md blocker 4) | [TO CONFIRM] | No entitlement when the iOS build is ready |
| RK3 | Google Play rejects or removes eGuard for Android under its stalkerware, permissions or payments policies | [TO CONFIRM] | [TO CONFIRM] | Monitoring-tool flag, persistent notification, permission declarations, no buying or pointing to the web from the app (app-listing.md sections 6, 9, 10) | [TO CONFIRM] | A policy warning or rejection in Play Console |
## eguard risks: store copy, privacy forms and push alerts

The eguard store copy, privacy form and push alert risks concern whether what the apps and their store listings say matches what the build does.

| ID | Risk | Likelihood | Impact | Mitigation | Owner role | Trigger that means it is happening |
|---|---|---|---|---|---|---|
| RK4 | The Plans help article tells app users to upgrade "on the web", which the apps may not say | [TO CONFIRM] | [TO CONFIRM] | Give the apps a version that only names the plans (app-listing.md blocker 2, partly fixed) | [TO CONFIRM] | Store review cites steering to outside payment |
| RK5 | The store privacy forms do not match the build (for example an SDK that collects data) | [TO CONFIRM] | [TO CONFIRM] | Confirm every permission and SDK against the build before submission | [TO CONFIRM] | A difference found in the dependency list |
| RK6 | Push alerts promised in customer copy are not actually delivered (sources disagree on whether push works) | [TO CONFIRM] | [TO CONFIRM] | Wire up push before the apps launch, or describe alerts as in-app and email (app-listing.md blocker 6) | [TO CONFIRM] | Parents report missing push alerts |

## eguard risks: eGuard for Windows signing, anti-cheat and administrator accounts

The eGuard for Windows signing, anti-cheat and administrator-account risks concern whether the agent can be installed, can end games and can hold against a child with administrator rights.

| ID | Risk | Likelihood | Impact | Mitigation | Owner role | Trigger that means it is happening |
|---|---|---|---|---|---|---|
| RK7 | Without a code-signing certificate, SmartScreen warns on every install and Microsoft Defender may flag the agent | High if unsigned (source: "warns on every install") | [TO CONFIRM] | Buy an OV certificate with cloud signing, starting 3–4 weeks before the Windows beta; submit false positives to Microsoft | Owner (desktop-agent-spec.md "Needs the owner") | No certificate 3–4 weeks before the beta; Defender detections |
| RK8 | Certificate validation stalls because the Dun & Bradstreet record does not match the registration papers exactly | [TO CONFIRM] | [TO CONFIRM] | Check and correct the record first; corrections take a few days to a couple of weeks (code-signing.md) | [TO CONFIRM] | The certificate authority questions the business details |
| RK9 | Anti-cheat software (Vanguard, Easy Anti-Cheat) stops the agent ending a game's process | [TO CONFIRM] | High (source: "The whole enforcement design rests on it") | Test ending Counter-Strike 2, Fortnite and Valorant early; fallbacks: stop the launch, end the launcher, overlay plus lock (desktop-agent-open-questions.md Q3, open) | [TO CONFIRM] | A game keeps running after the agent tries to end it |
| RK10 | A child with an administrator account, or who reinstalls Windows, defeats the agent | [TO CONFIRM] | [TO CONFIRM] | Standard account as a health check that fails loudly; alerts on every attempt; reinstall shows as the offline alert after a day | [TO CONFIRM] | Administrator-account alert; computer offline for a day |
## eguard risks: eGuard for Windows enforcement gaps, support and competition

The eGuard for Windows enforcement-gap, support and competition risks concern fullscreen games, clock changes, support cost and the free Microsoft alternative.

| ID | Risk | Likelihood | Impact | Mitigation | Owner role | Trigger that means it is happening |
|---|---|---|---|---|---|---|
| RK11 | The time-up overlay cannot show over a game in exclusive fullscreen | [TO CONFIRM] | [TO CONFIRM] | End the foreground app first (approved 2026-10-24, not built); lock the session after 15 seconds | [TO CONFIRM] | A game stays in front after time is up |
| RK12 | A clock changed while the PC is offline grants time or skips bedtime | [TO CONFIRM] | [TO CONFIRM] | Persist the last trusted server time (desktop-agent-open-questions.md Q6, open) | [TO CONFIRM] | Usage or bedtime out of line after an offline reboot |
| RK13 | Support for PCs costs more than expected ("the biggest real cost") | [TO CONFIRM] | [TO CONFIRM] | [TO CONFIRM: no mitigation stated] | [TO CONFIRM] | Rising PC support tickets |
| RK14 | Microsoft Family Safety, which is free, wins families who only want limits on a PC | [TO CONFIRM] | [TO CONFIRM] | Compete on one dashboard across devices, one gaming limit, verified protections, removal protection and alerts (pricing-desktop.md) | [TO CONFIRM] | Low PC pairing or conversion at the price review |

## eguard risks: legal, privacy and trust

The eguard legal, privacy and trust risks concern unreviewed legal pages, the Data Protection Officer, Parent care consent, public claims and recovery if the service ends.

| ID | Risk | Likelihood | Impact | Mitigation | Owner role | Trigger that means it is happening |
|---|---|---|---|---|---|---|
| RK15 | The privacy policy and terms have not been reviewed by a lawyer, especially the refund and liability terms | [TO CONFIRM] | [TO CONFIRM] | Lawyer review (launch-visibility.md, open) | [TO CONFIRM] | A complaint or regulator question about the legal pages |
| RK16 | The Data Protection Officer is not named with the National Privacy Commission | [TO CONFIRM] | [TO CONFIRM] | Designate the DPO by name when DevCom registers | [TO CONFIRM] | Registration with the commission is due |
| RK17 | Parent care messages and their holdout group are not reviewed by counsel or a DPO | [TO CONFIRM] | [TO CONFIRM] | Legal and DPO review before the pilot; describe the holdout group | [TO CONFIRM] | Pilot start without the review |
| RK18 | A claim on the site, in a store or in press material is not true (user counts, ratings, iPhone support) | [TO CONFIRM] | [TO CONFIRM] | Add a claim only once it can be backed up; follow the claims and screenshots constraint in "eguard constraints: company promises and technical choices" | [TO CONFIRM] | Copy that says "Android and iOS" or shows a rating |
| RK19 | Without an offline recovery route, eGuard for Windows cannot be removed if the service shuts down: a consumer-law risk | [TO CONFIRM] | [TO CONFIRM] | Support removal and end-of-life plan (decided 2026-10-24, not built) | [TO CONFIRM] | Release without the recovery route |

## eguard risks: Parent care operations and billing

The eguard Parent care operations and billing risks concern the Parent care launch, the test suite, refunds and card changes.

| ID | Risk | Likelihood | Impact | Mitigation | Owner role | Trigger that means it is happening |
|---|---|---|---|---|---|---|
| RK20 | Parent care fails in production because push and email delivery were never exercised for real, and bounces create no suppressions | [TO CONFIRM] | [TO CONFIRM] | Start with automations paused; watch the console Delivery and Trust pages; log alerts on opt-out spikes and failed jobs | [TO CONFIRM] | "Opt-out spike" or "jobs failed for good" warnings |
| RK21 | 12 API tests already fail on the untouched code, hiding new failures | [TO CONFIRM] | [TO CONFIRM] | Fix the stale expectations (features/parent-care.md, open) | [TO CONFIRM] | A new failure is missed in the full API suite |
| RK22 | Refunds of auto-renew invoices are not matched automatically | [TO CONFIRM] | [TO CONFIRM] | Manual steps in subscriptions.md section 13 | [TO CONFIRM] | A refunded family keeps its plan |
| RK23 | Parents cannot change the card for auto-renew or switch between monthly and yearly | [TO CONFIRM] | [TO CONFIRM] | Turn auto-renew off and on after the paid period, or buy passes | [TO CONFIRM] | Support requests about expiring cards |
## eguard risks: device reporting gaps

The eguard device reporting risks concern gaps in what the server learns from children's devices, listed as open server gaps in the sources.

| ID | Risk | Likelihood | Impact | Mitigation | Owner role | Trigger that means it is happening |
|---|---|---|---|---|---|---|
| RK24 | A child who force-stops the app goes unnoticed for up to 24 hours (offline alert) | [TO CONFIRM] | [TO CONFIRM] | A shorter "stopped reporting" alert (server gap G9, open) | [TO CONFIRM] | A device silent for hours with no alert |
| RK25 | Apps keyed by display name collide or lose their rules when renamed | [TO CONFIRM] | [TO CONFIRM] | Add a package or bundle identifier (server gap G4, open) | [TO CONFIRM] | Two apps with the same name share one rule |
| RK26 | iOS cannot read back settings or send usage totals, so iOS verification and charts may not be possible | [TO CONFIRM] | [TO CONFIRM] | Prototype before promising them (server gap G3) | [TO CONFIRM] | The prototype cannot read the setting |

## eguard assumptions

The eguard assumptions are beliefs the plans rely on that have not yet been checked.

| ID | Assumption | How we will check it | By when |
|---|---|---|---|
| A1 | The owner's objective for this project matches the workstreams in "eguard: Project Brief" | Owner confirms the objective | [TO CONFIRM] |
| A2 | About ₱58 to the US dollar, and Qustodio's October 2026 US prices, hold for price comparisons | Check them again | Before any public comparison (pricing-desktop.md) |
| A3 | The costs of PCs are covered by a handful of extra eGuard Plus subscribers a month | Compare PC costs with new subscribers | [TO CONFIRM] |
| A4 | The child uses a standard Windows account | The agent's health check reports it | Continuous, per computer |
| A5 | Parent care raises retention and reactivation (the pilot hypotheses) | Treatment versus holdout, a few hundred parents per group | [TO CONFIRM: pilot end date] |
| A6 | Parent care planning scales to thousands of parents | Revisit beyond about 50,000 parents | [TO CONFIRM] |
| A7 | GCash users are the majority in the Philippines, so passes matter more than auto-renew | [TO CONFIRM: no check stated] | [TO CONFIRM] |
| A8 | Customer-facing copy (profile.md, faq.md) is accurate about eGuard for Android and push alerts | Owner confirms against the build | [TO CONFIRM] |
| A9 | Price-review thresholds reflect current conversion and churn | Owner may change them if data says otherwise | 90 days after eGuard for Windows leaves beta |

Prices referred to here are in Philippine pesos (₱); plan prices are in "Pricing and Discount Rules".

## eguard constraints: law and store policies

The eguard legal and store-policy constraints are fixed limits from Philippine law and from Google, Apple and Meta policies that every workstream must respect.

| Constraint | Source | Consequence if broken |
|---|---|---|
| Data Privacy Act of 2012 (RA 10173); DevCom is the personal-information controller | profile.md, launch-visibility.md | [TO CONFIRM: legal consequence not stated] |
| Google Play payments policy: no buying or pointing to the web from the apps | subscriptions.md, app-listing.md | Store rejection |
| Google Play stalkerware policy: persistent notification, app never hidden, 18+ audience | app-listing.md | Store rejection or removal |
| Apple guidelines 3.1.1, 3.1.3(b), 4.8, 5.1.1(iv), 5.1.2 and 5.4 | app-listing.md, mobile-organizations.md | Store rejection |
| Meta does not allow Pages or ads directed at children | facebook-page.md, launch-visibility.md | [TO CONFIRM: consequence not stated] |
## eguard constraints: company promises and technical choices

The eguard constraints from company promises and technical choices are fixed limits on claims, privacy, the Windows agent, code signing and purchases that every workstream must respect.

| Constraint | Source | Consequence if broken |
|---|---|---|
| No user counts, ratings or "trusted by" claims until real; screenshots use the demo family only | press-release.md, launch-visibility.md | Lost trust; flagged by ad platforms and app store reviewers |
| Staff never see a child's activity; organizations see counts only; card data never reaches eGuard's servers | console.md, organizations.md, subscriptions.md | Broken privacy promise; organizations take on Data Privacy Act obligations |
| No analytics, ads or tracking SDKs in the apps | mobile-api.md, child-app-spec.md | Store forms wrong; Apple guideline 5.1.2 breached |
| The Windows agent never touches a game's process from the inside and uses no kernel driver | desktop-agent-spec.md | Anti-cheat bans or crashes; driver signing needed |
| The marketing site does not mention PCs until eGuard for Windows ships | pricing-desktop.md, desktop-agent-spec.md | A claim the product cannot back up |
| Code-signing certificates last at most 460 days, so they renew every year | code-signing.md | Unsigned releases and SmartScreen warnings |
| Only the family admin buys, cancels or redeems | subscriptions.md, organizations.md | [TO CONFIRM: consequence not stated] |

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | eguard: Project Brief; eguard: Requirements and Acceptance Criteria; eguard: Decision Log |

## Open questions

1. [TO CONFIRM: project objective]; the risks above cover all workstreams until it is chosen.
2. [TO CONFIRM: owner role] for this document, its effective date and review date.
3. Likelihood and impact are [TO CONFIRM] for every risk except RK1 (likelihood), RK2 (impact), RK7 (likelihood) and RK9 (impact), where a source supports the rating.
4. Owner roles are [TO CONFIRM] for every risk except RK7.
5. RK13 has no stated mitigation: [TO CONFIRM: no mitigation stated].
6. Assumption checks and dates: A1, A3, A6, A7 and A8 have [TO CONFIRM] dates; A5 needs [TO CONFIRM: pilot end date]; A7 has [TO CONFIRM: no check stated].
7. Constraint consequences not stated: Data Privacy Act ([TO CONFIRM: legal consequence not stated]), Meta's rule and family-admin-only purchases ([TO CONFIRM: consequence not stated]).
8. Is the Android app live? app-listing.md and child-app-spec.md say "The native apps aren't built yet"; faq.md, profile.md, press-release.md and facebook-page.md say Android works now on Google Play; child-app-spec.md refers to "Android 1.0.9". This document follows the customer-facing sources (A8).
9. Do push alerts work? launch-visibility.md says "Push alerts (coming soon)"; app-listing.md and organizations.md say push is not wired up; faq.md, profile.md and press-release.md say push is sent; mobile-api.md says alerts go through Firebase Cloud Messaging (RK6).
10. app-listing.md's Google Play description says eGuard "Works with … iPhone and iPad"; every other source says iPhone and iPad are "coming soon" (RK18).
11. Code-signing cost: pricing-desktop.md says about $10 a month (Azure) or $200–400 a year (OV); code-signing.md says Azure is not available and OV costs about $200–500 a year.
12. Windows sync interval: pricing-desktop.md says every 5 minutes; desktop-agent-spec.md and mobile-api.md say every 60 seconds.
13. Windows build status: desktop-agent-spec.md says the agent "is not built yet" but that self-update was "built 2026-10-24".
14. Launch checklist: launch-visibility.md section 1 marks the latest copy and email records as open; its section 9 ticks both as done.
15. Does a browser on a paired Windows PC take a device slot? faq.md says Chrome and Edge on one laptop count as two devices; pricing-desktop.md and browser-extension-api.md say they take no slot since 2026-10-23. [TO CONFIRM]
16. Statuses that may have moved: code-signing.md (not bought as of 2026-10-23) and features/parent-care.md (not deployed as of 2026-10-21).
17. Suggested, not confirmed: a risk that the 2026-10-28 plan-limit change raises support load or churn among Free families now over the 1-device limit (plan-change-2026-10.md counts such families but sets no follow-up).
18. Suggested, not confirmed: a risk that card or e-wallet payment caps block large sponsor-code batches (organizations.md open question on GCash limits).
19. Suggested, not confirmed: a risk that the native Filipino review of Parent care templates and the Filipino kids page is not done before they are promoted.
