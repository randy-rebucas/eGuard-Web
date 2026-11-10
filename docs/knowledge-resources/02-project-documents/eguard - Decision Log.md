# eguard: Decision Log

## Summary

The eguard Decision Log records the eGuard product, pricing and engineering decisions that the company's working documents state as made, from 2026-10-08 to 2026-10-28, for anyone who needs to know what was decided, by whom and why. Most decisions were made by the owner, the role that accepts or rejects product, pricing and engineering recommendations. The largest are: eGuard for Windows is included in every plan with no add-on (2026-10-23); plan limits changed to Free 1 child / 1 device, eGuard Plus 3 / 5 and eGuard Family 6 / 12, with legacy limits for families already paying (2026-10-28); and eGuard for Android uses on-device APIs instead of Google Family Link (2026-10-08). Recommendations that the sources do not state as decided are listed under Open questions, not here. Amounts are in Philippine pesos (₱) unless stated otherwise.

## eguard decision D1: eGuard for Android uses on-device APIs, not Google Family Link

- **Date:** 2026-10-08
- **Decided by:** [TO CONFIRM: role]
- **Decision:** eGuard for Android applies protections with on-device Android APIs (usage access, device admin, a foreground service), not Google Family Link.
- **Reasons:** Family Link has no public API for a third-party app to set or read its rules, so eGuard could not verify them.
- **Options rejected:** Google Family Link (no API, so no verification); Android Enterprise or device owner (no reason recorded).
- **Affects:** Android permissions and store declarations; the help article on Family Link, which now says Family Link is not needed.
- **Status:** In force. Sources: child-app-spec.md (its decision D1), app-listing.md.

## eguard decision D2: Android app and content age ratings are "Set by you"

- **Date:** 2026-10-14
- **Decided by:** [TO CONFIRM: role]
- **Decision:** On Android, age ratings for apps (App Restrictions) and for movies and TV (Content Restrictions) are set by the parent in Google Play's parental controls with guided steps, confirmed by the parent, never shown as Verified and not counted in Configuration Health.
- **Reasons:** Android cannot read app ratings, and Google Play's parental controls have no read API.
- **Options rejected:** a bundled rating list; the parent deciding per app (no reasons recorded). A server-side rating lookup could make the setting verifiable later.
- **Affects:** Configuration Health on Android; what the child device app reports.
- **Status:** In force. Source: child-app-spec.md (its decision D3).

## eguard decision D3: eGuard for Windows is included in every plan

- **Date:** 2026-10-23
- **Decided by:** Owner
- **Decision:** A child's Windows PC is protected on every plan, with no PC add-on and no new tier.
- **Reasons:** Microsoft Family Safety is free and is the real rival on a PC, so eGuard cannot charge for "limits on a PC" alone; eGuard is already the low-price option; the costs of PCs are covered by "a handful of extra Plus subscribers a month".
- **Options rejected:** a PC add-on or a separate price ("PCs don't need their own price").
- **Affects:** plan cards (to add "Windows PCs and games" at launch, not before); support load.
- **Status:** In force. Source: pricing-desktop.md.

## eguard decision D4: Tamper protection stays on the Free plan

- **Date:** 2026-10-23
- **Decided by:** Owner
- **Decision:** Uninstall protection and tamper and removal alerts are included on Free, on PCs and on phones.
- **Reasons:** an eGuard that a child can uninstall would make the whole product look weak; an alert that goes unseen costs a family's trust more than it earns in upgrades.
- **Options rejected:** making tamper protection a paid feature.
- **Affects:** Free plan features; the 2026-10-28 plan change kept it (decision D9).
- **Status:** In force. Sources: pricing-desktop.md, plan-change-2026-10.md.

## eguard decision D5: Prices held at launch; yearly plans at two months free

- **Date:** 2026-10-23
- **Decided by:** Owner
- **Decision:** Monthly prices stay at ₱149 (eGuard Plus) and ₱249 (eGuard Family) while the PC agent is new, and yearly plans are added at the price of 10 months.
- **Reasons:** the agent is unproven, the first installers may show SmartScreen warnings, and charging more for an unproven feature leads to refunds and bad reviews. Yearly plans keep families through months when a child is not gaming, pay for code signing up front, and the code already handled yearly periods.
- **Options rejected:** raising prices at launch.
- **Affects:** web products, PayMongo plans, Google Play base plans. Prices are kept in "Pricing and Discount Rules".
- **Status:** In force; yearly plans built 2026-10-23. Sources: pricing-desktop.md, subscriptions.md.

## eguard decision D6: Browsers on a paired PC take no device slot

- **Date:** 2026-10-23 (built the same day)
- **Decided by:** Owner (accepted with the pricing recommendations)
- **Decision:** A browser on a PC that runs the eGuard for Windows agent is part of that PC and takes no device slot; a browser on a computer without the agent still takes one.
- **Reasons:** the agent forces the extension into Chrome, Edge and Firefox, so one PC could take up to 4 slots and a Free family could not use the extension at all.
- **Options rejected:** raising device limits for PCs.
- **Affects:** device counting; the extension, which still has to read the link from its managed policy.
- **Status:** [TO CONFIRM: whether a browser on a paired Windows PC takes a device slot]. pricing-desktop.md and browser-extension-api.md record the rule as built on 2026-10-23; faq.md quotes the pricing page FAQ, "Chrome and Edge on one laptop count as two devices" (see Open questions).

## eguard decision D7: PC launch offer built but switched off

- **Date:** 2026-10-23
- **Decided by:** Owner
- **Decision:** A family with no paid time that pairs its first PC gets one month of eGuard Plus, once; the offer is built and stays off until a launch date is set.
- **Reasons:** recorded as an optional launch offer.
- **Options rejected:** issuing it as sponsor codes, because sponsor codes belong to an organization's paid batch; it is eGuard's own promotional purchase instead.
- **Affects:** billing; to be switched on when eGuard for Windows ships.
- **Status:** In force (off). Sources: pricing-desktop.md, subscriptions.md.

## eguard decision D8: Price review 90 days after eGuard for Windows leaves beta

- **Date:** 2026-10-23
- **Decided by:** Owner
- **Decision:** 90 days after the agent leaves beta, prices for new subscribers only rise to ₱179 (eGuard Plus) and ₱299 (eGuard Family), yearly ₱1,790 and ₱2,990, if all four thresholds hold: at least 25% of paying families paired a PC; Free-to-Plus conversion with a PC at least 1.5 times that without; churn with a PC no worse; fewer than 5% of PCs with tamper alerts that were eGuard's fault.
- **Reasons:** recommended as written; if conversion rises but churn also rises, the price is held and the product fixed first.
- **Options rejected:** none recorded.
- **Affects:** existing subscribers keep their price (new PayMongo plan; new Google Play price cohort). Since 2026-10-28, conversion is compared from the 2026-10-28 cohort on.
- **Status:** In force; review not yet due. Source: pricing-desktop.md.

## eguard decision D9: Plan limits changed and Family Pro renamed

- **Date:** 2026-10-28
- **Decided by:** Owner
- **Decision:** Limits became Free 1 child / 1 device, eGuard Plus 3 / 5 and eGuard Family 6 / 12; "Family Pro" was renamed "eGuard Family"; alerts when a setting changes moved to eGuard Plus and up; families paying at release keep 5 / 10 (eGuard Plus) or 10 / 20 (eGuard Family) while subscribed (legacy limits).
- **Reasons:** [TO CONFIRM: reasons for the plan-limit change; not stated in the sources]
- **Options rejected:** none recorded.
- **Affects:** every family's limits; service notices sent from the console; the Google Play listing for the eGuard Family product. Replaces the Free "one phone and one PC" device count in D3 to D6.
- **Status:** In force. Sources: pricing-desktop.md, plan-change-2026-10.md, subscriptions.md.

## eguard decision D10: More than one parent and configuration history on every plan

- **Date:** 2026-10-28
- **Decided by:** [TO CONFIRM: role]
- **Decision:** More than one parent per family and configuration history stay on every plan, Free included.
- **Reasons:** removing a co-parent would lock real parents out, and a child's limits should not depend on which parent pays; on Free, history is how a parent sees a setting that changed on the device without an alert, and the Free notice promises it.
- **Options rejected:** making them paid, as earlier pricing notes listed.
- **Affects:** Free plan features. The 30-day reports and CSV export stay eGuard Family only.
- **Status:** In force. Source: subscriptions.md.

## eguard decision D11: Plans are sold on the web only

- **Date:** [TO CONFIRM: date]
- **Decided by:** [TO CONFIRM: role]
- **Decision:** All plans are bought on the web through PayMongo, by the family admin only; the apps show the plan but do not sell it, and Google Play billing is turned off.
- **Reasons:** Google Play policy generally forbids steering users to outside payment, so the apps have no buy button and no link to the website.
- **Options rejected:** none recorded; the Google Play billing code remains but is off.
- **Affects:** app store listings, help copy, sponsor-code redemption (website only).
- **Status:** In force. Sources: subscriptions.md, app-listing.md.

## eguard decision D12: Windows agent screens use plain Win32 windows

- **Date:** 2026-10-23
- **Decided by:** Owner
- **Decision:** The agent's block screen, warnings and overlay are plain Win32 windows.
- **Reasons:** they keep working even when WebView2 is broken or removed.
- **Options rejected:** Tauri for these screens (it can come later for settings screens).
- **Affects:** the agent build; overrules desktop-agent-prompt.md.
- **Status:** In force. Source: desktop-agent-spec.md.

## eguard decision D13: Parent picks which Windows accounts are the child's

- **Date:** 2026-10-23
- **Decided by:** Owner
- **Decision:** At pairing, the parent picks the Windows accounts eGuard applies the child's rules in, with every standard account preselected; a Windows account added later raises an alert.
- **Reasons:** family PCs often hold the parent's own account, whose games and apps would otherwise be blocked and counted.
- **Options rejected:** preselecting only the signed-in account, because the parent usually installs from their own administrator account.
- **Affects:** pairing, reports and alerts for computers.
- **Status:** In force. Sources: desktop-agent-open-questions.md (Q2), desktop-agent-spec.md.

## eguard decision D14: Computers sync every 60 seconds

- **Date:** 2026-10-23
- **Decided by:** Owner
- **Decision:** Computers always sync every 60 seconds.
- **Reasons:** a removal, a parent's "allow" and extra time then reach the PC within a minute; it is the cheapest option.
- **Options rejected:** a long-poll or streaming endpoint (kept as an option if load matters); Windows push notifications (needs a Store identity).
- **Affects:** removal timing and server load.
- **Status:** In force. Sources: desktop-agent-open-questions.md (Q4), desktop-agent-spec.md. pricing-desktop.md gives a different interval (see Open questions).

## eguard decision D15: Lockout for guessing the removal code

- **Date:** 2026-10-23
- **Decided by:** Owner
- **Decision:** Five wrong removal codes in a row lock the input for 15 minutes, doubling with each lockout up to 24 hours and kept across restarts; each lockout alerts the parent. A valid code no longer removes a computer the parent chose to keep; it raises an alert instead.
- **Reasons:** without a limit, a child could keep guessing codes.
- **Options rejected:** none recorded.
- **Affects:** the agent and the alert list.
- **Status:** In force. Sources: desktop-agent-open-questions.md (Q5), desktop-agent-spec.md.

## eguard decision D16: Administrator accounts in the removal acceptance test

- **Date:** 2026-10-24
- **Decided by:** [TO CONFIRM: role]
- **Decision:** As the standard child account, every removal route must fail and alert; as a local administrator, every route must alert the parent while it happens, and failing is a bonus.
- **Reasons:** no user-mode software holds against an administrator; otherwise the agent "chases a goal it can't reach".
- **Options rejected:** requiring every route to fail as an administrator too.
- **Affects:** desktop-agent-spec.md acceptance test 8.
- **Status:** In force. Sources: desktop-agent-open-questions.md (Q1), desktop-agent-spec.md.

## eguard decision D17: Visible uninstall entry and refused service stops

- **Date:** 2026-10-24
- **Decided by:** Owner
- **Decision:** eGuard's entry in Windows Settings stays visible and its Uninstall opens eGuard's "Remove eGuard" window, where a parent types the code; a request to stop the service is refused outside an authorized removal and alerts the parent.
- **Reasons:** Windows 11 cannot both hide Uninstall and open a window from it.
- **Options rejected:** hiding the uninstall entry, as desktop-agent-prompt.md proposed.
- **Affects:** the agent's installer and service.
- **Status:** In force. Source: desktop-agent-spec.md.

## eguard decision D18: Further Windows agent rules of 2026-10-24

- **Date:** 2026-10-24
- **Decided by:** Owner
- **Decision:** A removal that has waited 7 days with no check-in from the computer is finished by the server; browsers the eGuard browser extension cannot run in wait for the parent while web filtering is on; a service that ends without being asked raises an alert.
- **Reasons:** not recorded beyond the rules themselves.
- **Options rejected:** none recorded.
- **Affects:** server maintenance and the alert list (built 2026-10-24).
- **Status:** In force. Source: desktop-agent-spec.md section 13.

## eguard decision D19: Windows agent self-update

- **Date:** 2026-10-24
- **Decided by:** [TO CONFIRM: role]
- **Decision:** The agent updates itself from a signed manifest, accepting only files whose size and checksum match and that carry eGuard's code-signing certificate, and rolls back if the new version does not report healthy within 10 minutes.
- **Reasons:** without an update path the guard would undo every update; the gap blocked shipping as much as the certificate.
- **Options rejected:** none recorded.
- **Affects:** the agent; waits for the virtual-machine test and the certificate (D22). The dashboard does not yet show a failed update.
- **Status:** In force; built 2026-10-24. Sources: desktop-agent-open-questions.md (Q7), desktop-agent-spec.md.

## eguard decision D20: Recovery if eGuard goes away

- **Date:** 2026-10-24
- **Decided by:** [TO CONFIRM: role]
- **Decision:** Support can issue a signed removal for one computer after checking the parent's identity, valid 7 days; before any shutdown of the service, signed uninstall commands go to every computer for at least 90 days and parents are emailed, with a dated end-of-life notice as a fallback. The terms and privacy policy say both.
- **Reasons:** without a route that does not depend on the live server, there is no way off the PC short of reinstalling Windows, a consumer-law risk that also makes Microsoft Defender more likely to flag the agent.
- **Options rejected:** none recorded.
- **Affects:** the agent, support and the legal pages.
- **Status:** In force; not built. Sources: desktop-agent-open-questions.md (Q8), desktop-agent-spec.md.

## eguard decision D21: Exclusive fullscreen games are ended first

- **Date:** 2026-10-24 (approved)
- **Decided by:** [TO CONFIRM: role]
- **Decision:** When time runs out or bedtime starts, the agent ends the foreground app first (unless it is always allowed), then shows the overlay.
- **Reasons:** no window can draw over a game in exclusive fullscreen.
- **Options rejected:** none recorded.
- **Affects:** the agent's time and bedtime enforcement.
- **Status:** Approved, not built; the source still lists the question as "Open". Source: desktop-agent-open-questions.md (Q9).

## eguard decision D22: OV code-signing certificate with cloud signing

- **Date:** [TO CONFIRM: date; the document's status is dated 2026-10-23]
- **Decided by:** [TO CONFIRM: role]
- **Decision:** eGuard for Windows is signed with an Organization Validation (OV) certificate with cloud signing, issued to the registered business, not to an individual.
- **Reasons:** the key stays with the certificate authority, signing works from a build server, and nothing is shipped; an individual certificate would show a personal name to parents.
- **Options rejected:** Azure Artifact Signing (open only to organizations in the US, Canada, the EU and the UK); an EV certificate (since 2024 it no longer skips SmartScreen, and is only needed for kernel drivers); an OV certificate on a USB token (must be shipped and cannot sign in an automated build).
- **Affects:** Windows release timing and yearly cost (about 200–500 US dollars a year).
- **Status:** In force; certificate not bought as of 2026-10-23. Source: code-signing.md.

## eguard decision D23: Organization responses send "kind" and "kindLabel"

- **Date:** [TO CONFIRM: date]
- **Decided by:** [TO CONFIRM: role]
- **Decision:** The new mobile organization routes always send both a kind code and a readable label.
- **Reasons:** it is a new API, so no clients break.
- **Options rejected:** keeping the service's existing mix.
- **Affects:** the mobile parent API.
- **Status:** In force. Source: mobile-organizations.md (its decision M7).

## eguard decision D24: Social proof only when real

- **Date:** 2026-10-17 (built)
- **Decided by:** [TO CONFIRM: role]
- **Decision:** The website shows social proof only when it is true: a parent's quote only after written consent, a Google Play rating only from 20 reviews and never in structured data, press only after an article has run.
- **Reasons:** the site had no testimonials and rightly avoided a fake rating; anything untrue costs parents' trust and gets the site flagged by ad platforms and app store reviewers.
- **Options rejected:** none recorded.
- **Affects:** landing page, About page.
- **Status:** In force. Sources: marketing-site-review.md, launch-visibility.md.

## eguard decision D25: The blog becomes product news

- **Date:** 2026-10-17 (built)
- **Decided by:** [TO CONFIRM: role]
- **Decision:** The blog is repositioned as product news, pointing readers to the Knowledge Center for guides.
- **Reasons:** its title overlapped with the Knowledge Center, and three posts from one day make a site look abandoned.
- **Options rejected:** folding the blog into the Knowledge Center as "Product notes".
- **Affects:** the blog and its posting schedule.
- **Status:** In force. Source: marketing-site-review.md.

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | eguard: Project Brief; eguard: Requirements and Acceptance Criteria; eguard: Risks, Assumptions and Constraints; Pricing and Discount Rules |

## Open questions

1. [TO CONFIRM: owner role] for this log, its effective date and review date. Suggested, not confirmed: review every 3 months.
2. [TO CONFIRM: role] for D1, D2, D10, D16, D19, D20, D21, D24 and D25; the sources give dates but not who decided. For D16 to D21, desktop-agent-spec.md records "owner decisions" on 2026-10-23 and 2026-10-24 without naming each question.
3. [TO CONFIRM: date] and [TO CONFIRM: role] for D11, D22 and D23.
4. [TO CONFIRM: reasons for the plan-limit change; not stated in the sources] (D9).
5. Undecided, child device app (child-app-spec.md section 15): D2 block screen on Android (recommended: overlay); D4 iOS app identity and usage data (prototype first); D5 always-allowed apps (recommended: fixed list in version 1); D6 certificate pinning (recommended: pin the CA with a backup); D7 parent PIN on the child's device (recommended: none in version 1); D8 launch languages (recommended: English, Filipino in the first update). The Android minimum version is also marked "Decide".
6. Undecided, organizations in the app (mobile-organizations.md section 11): M1 no sponsor-code redemption in the app; M2 no buying codes in the app; M3 full organization admin minus buying, API keys and CSV; M4 parent-to-child shortcut; M5 reuse the install after removal; M6 join links or QR codes later. These are recommendations; mobile-api.md describes M1 and M5 as built behaviour, so the owner may confirm them as decisions.
7. Undecided, eGuard for Windows (desktop-agent-open-questions.md): Q3 anti-cheat and ending a game's process (a test is suggested before the enforcement phase); Q6 clock changes while offline. Also open in desktop-agent-spec.md: removing the log folders left behind, and showing a failed update on the dashboard.
8. Undecided, iPhone and iPad: build StoreKit subscriptions or ship iOS with Free features only (app-listing.md blocker 3).
9. Undecided, Parent care: asking for push and email consent at sign-up "needs a product and legal decision"; how to select the pilot group (features/parent-care.md).
10. desktop-agent-open-questions.md says "None is decided yet" in its introduction, while its own table marks six questions Settled. This log follows the table.
11. Device slots for browsers on a paired PC (D6): faq.md quotes the pricing page FAQ, "Chrome and Edge on one laptop count as two devices"; pricing-desktop.md and browser-extension-api.md say browsers on a paired PC take no slot since 2026-10-23. [TO CONFIRM]
12. Code signing (D22): pricing-desktop.md gives "About $10 a month (Azure Trusted Signing), or $200–400 a year (OV certificate)"; code-signing.md says Azure is not available and OV costs about $200–500 a year.
13. Sync interval (D14): pricing-desktop.md says "A PC syncs every 5 minutes, like a phone"; desktop-agent-spec.md and mobile-api.md say every 60 seconds.
14. Plan limits (D9): faq.md, facebook-page.md (About text), features/children.md section 6, features/devices.md section 6 and the mobile-api.md plan examples show older limits and look out of date.
15. subscriptions.md says "The only thing a plan changes is the device limit", while its own entitlement table lists child limits, location sharing, alerts and reports by plan; its section 4 diagram shows "Pay ₱199", which matches no price.
16. pricing-desktop.md section 5 suggests checking whether sponsor codes could carry the launch offer; its section 8 records the decision to use eGuard's own promotional purchase instead (D7).
