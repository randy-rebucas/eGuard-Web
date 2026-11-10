# eguard: Requirements and Acceptance Criteria

## Summary

The eguard Requirements and Acceptance Criteria document lists the requirements for eGuard that the company's working documents state, each with yes-or-no acceptance checks, for anyone building, testing or releasing eGuard. It covers the core verification rule, the child device app (eGuard for Android and eGuard for iPhone and iPad), eGuard for Windows, the production go-live of the website, the Parent care pilot and organizations. The most important requirement is that eGuard never reports a setting as Verified unless the child's device has confirmed it. The project objective is not yet chosen ([TO CONFIRM: project objective]), so the document records requirements per area rather than for one confirmed scope.

## eguard requirements: How priorities were set

Requirement priorities are rarely given in the sources. In this document, **Must** means the source states the item as a requirement, an acceptance criterion, or something to finish before launch or before a pilot. **Should** means the source recommends it. Where neither applies, the priority is [TO CONFIRM]. Requirements come only from the sources named in each section; likely missing requirements are listed under Open questions.

## eguard requirements: Core verification rule

The core verification rule requirements, R1 and R2, come from features/protection.md section 6 and child-app-spec.md sections 2 and 14. The related tamper-alert requirement is in "eguard requirements: Tamper alerts".

**R1. eGuard marks a protection change Verified only when a device report matches the requested setting.**
- Why it matters: the product's promise is "settings verified on the device, not just saved"; reporting success without the device's confirmation would make Configuration Health false.
- Priority: Must.
- Acceptance criteria:
  1. Saving a change leaves the child's policy unchanged until a device report arrives.
  2. A report whose configuration matches the open request (key order ignored) turns the request Verified and updates the child's policy.
  3. A delivered request that the device reports differently becomes Failed, showing what the device reported.
  4. A request no device confirms within 7 days is cancelled, the earlier setting stays, and the parent gets one Info notice.

**R2. The child device app reports the setting it reads back from the operating system, never the setting it was asked to apply.**
- Why it matters: echoing the request would mark changes Verified that are not in force.
- Priority: Must (child-app-spec.md: "Treat them as requirements").
- Acceptance criteria:
  1. After applying a setting, the app reads the real state back from the operating system before reporting.
  2. If the operating system rejects a setting, the device reports the real value and the request becomes Failed, never Verified.

## eguard requirements: Tamper alerts

The tamper-alert requirement, R3, comes from features/protection.md section 6 and child-app-spec.md sections 2 and 14.

**R3. A protection that goes from passing to failing raises one tamper alert.**
- Why it matters: parents must learn when a protection is turned off on the device.
- Priority: Must.
- Acceptance criteria:
  1. The alert is raised once per change, and a passing report resolves it.
  2. Turning off Uninstall Protection, App Approval or location sharing is raised as Action required.
  3. An alert held back while a parent's change is in flight is held for at most 6 hours.

## eguard requirements: Child device app pairing and verification

The child device app pairing and verification requirements come from child-app-spec.md section 14.

**R4. A child's phone or tablet pairs in one call with a valid pairing code and shows clear messages for invalid codes.**
- Why it matters: pairing is the step at which eGuard starts to deliver value (launch-visibility.md funnel).
- Priority: Must.
- Acceptance criteria:
  1. A valid code pairs in one call; the device appears on the parent's Devices page with its name, and the parent's pairing screen says "Paired".
  2. An expired, used or replaced code shows the invalid-code message.
  3. A browser code shows the server's message.
  4. A full plan shows the device-limit message, and the same code still works after a device is removed.

**R5. Every supported protection reaches Verified after first setup and after each parent change.**
- Why it matters: Configuration Health depends on it.
- Priority: Must.
- Acceptance criteria:
  1. After first setup, Configuration Health shows every supported protection as Verified with no parent action on Android, and after the guided steps on iOS.
  2. A parent change to each protection that eGuard applies reaches Verified within one sync cycle on Android.
  3. Revoking any permission or device admin on the device raises the matching parent alert within one sync of the app next running.
  4. "Run a check" gets a full report within 12 seconds from an online Android device.
  5. iOS never reports Notification Controls; the protection shows as Unsupported and does not lower the score.

## eguard requirements: Child device app enforcement

The child device app enforcement requirements come from child-app-spec.md section 14.

**R6. The child device app enforces limits, bedtime and app rules, online and offline.**
- Why it matters: protections must hold on the device whether or not it can reach eGuard.
- Priority: Must.
- Acceptance criteria:
  1. At the daily limit (weekend limit on Saturday and Sunday), non-allowed apps show the limit screen and the limit event is sent once.
  2. Bedtime windows that cross midnight block from start to end, on the right days.
  3. A blocked app cannot be used, and opening it sends a blocked-app event; an app waiting for approval shows the waiting screen.
  4. Asking for an app creates one "App approval requested" alert, and approving it in parent mode unblocks it on the next sync.
  5. The dialer and emergency calls work during bedtime and after the limit.
  6. All enforcement keeps working in airplane mode, using the last policy.

## eguard requirements: Child device app reporting, privacy and store

The child device app reporting, privacy and store requirements come from child-app-spec.md sections 11 and 14.

**R7. The child device app sends only the data listed in child-app-spec.md section 11, and stops completely when removed.**
- Why it matters: the privacy promise and the store reviews depend on it.
- Priority: Must.
- Acceptance criteria:
  1. Parent screen-time totals match the device's own settings screen within 5 minutes a day (Android).
  2. No location is sent while sharing is off or permission is denied.
  3. A network capture of a full day shows calls to eguard.family only, with only the fields in section 11.
  4. Removing the device in parent mode makes the child app stop enforcing, show the removed screen and delete its token.

**R8. The child device app meets the stores' monitoring-app rules.**
- Why it matters: Google Play and the App Store reject or remove apps that break them.
- Priority: Must.
- Acceptance criteria:
  1. Every sensitive permission has an in-app disclosure before the system prompt.
  2. Android shows the persistent notification whenever eGuard is active.
  3. The Android manifest declares the app as a parental-control monitoring tool.

## eguard requirements: Child device app non-functional

The child device app non-functional requirements come from child-app-spec.md section 12.

**R9. The child device app meets the stated battery, data, speed, accessibility and language requirements.**
- Why it matters: the spec lists them as requirements for the child's device.
- Priority: Must.
- Acceptance criteria:
  1. Battery use is under 3% a day on a mid-range Android phone with location on, measured before beta.
  2. Data use is under 2 MB a day.
  3. The home screen shows the saved state in under 1 second, offline.
  4. Every control has a screen-reader label; text supports dynamic type; contrast is at least 4.5:1; block screens are readable at 200% text.
  5. The app is in English at launch, with strings in resource files so Filipino can follow.
  6. Wording is readable for a 7-year-old (for example "Screen time is up", not "Quota exceeded").
  7. The app sends its version on every call and shows an update screen when the server sets a higher minimum version.
  8. Light and dark themes follow the system.

## eguard requirements: eGuard for Windows principles

The eGuard for Windows principles come from desktop-agent-spec.md section 2.

**R10. The Windows agent never touches a game's process from the inside and fails closed.**
- Why it matters: anti-cheat systems ban or crash on tools that inject, hook or use kernel drivers, and losing contact must never switch protection off.
- Priority: Must.
- Acceptance criteria:
  1. The agent uses no injection, hooks, kernel driver or reading of game memory.
  2. If eGuard cannot be reached, the PC keeps enforcing the last policy; an authentication failure, a timeout or a deleted token never switches protection off.
  3. When the child's Windows account is an administrator, the health check fails visibly and the parent gets an alert.

## eguard requirements: eGuard for Windows acceptance tests: pairing and enforcement

The eGuard for Windows acceptance tests come from desktop-agent-spec.md section 14 and run on a Windows 11 virtual machine with a standard child account. The removal tests are in "eguard requirements: eGuard for Windows acceptance tests: removal".

**R11. eGuard for Windows pairs, finds games and enforces blocks and limits.**
- Why it matters: these are the agent's release tests.
- Priority: Must.
- Acceptance criteria:
  1. Pairing with a dashboard code shows the device as a computer with Windows capabilities.
  2. With Office, Chrome, NVIDIA drivers, Steam with Counter-Strike 2, Roblox and an unsigned itch.io game installed, only the three games reach the Apps tab, the itch.io game is flagged "Unverified publisher", and there is one alert.
  3. A blocked Counter-Strike 2 launched from Steam ends within 2 seconds, the block screen shows, and "Ask parent" reaches the dashboard.
  4. A renamed Counter-Strike 2 program is still blocked.
  5. With Gaming time set to 1 minute, playing Roblox shows the 1-minute warning, then the block, then "Gaming time used up".
  6. Moving the clock forward an hour gains no time and raises a clock-changed alert.

## eguard requirements: eGuard for Windows acceptance tests: removal

The eGuard for Windows removal tests come from desktop-agent-spec.md section 14 and run on the same Windows 11 virtual machine with a standard child account as the pairing and enforcement tests.

**R12. eGuard for Windows resists removal and uninstalls only on the parent's instruction.**
- Why it matters: an eGuard a child can uninstall "would make the whole product look weak" (pricing-desktop.md).
- Priority: Must.
- Acceptance criteria:
  1. Ending the session agent brings it back, with an agent-restarted alert.
  2. As the standard child account, Settings uninstall, the installer's uninstall command, stopping or deleting the service, deleting the install folder and Safe Mode each fail and alert.
  3. As a local administrator, each of those routes alerts the parent while it happens, or is undone (failing is a bonus).
  4. Removing the PC on the dashboard makes the agent uninstall itself within a minute, and the device disappears.
  5. After pairing again, going offline and removing it on the dashboard, typing the offline code on the PC uninstalls eGuard.

## eguard requirements: Website production go-live

The website production go-live requirements come from launch-visibility.md, "Production go-live" and section 9.

**R13. The website is not announced until the production go-live items are done.**
- Why it matters: according to launch-visibility.md, each item stops parents from signing up, paying or getting their emails, or leaves the team unaware when something breaks.
- Priority: Must.
- Acceptance criteria (all ticked in section 9 of the source):
  1. The latest copy changes are deployed.
  2. Production environment variables are confirmed, with the two-step sign-in key backed up.
  3. PayMongo runs on live keys, the webhook points at www.eguard.family, and one real purchase was made and refunded.
  4. The production end-to-end test passes: sign-up, verification email in the Gmail inbox, child added, device paired, setting Verified, password reset, two-step sign-in.
  5. Database migrations are deployed, automated backups are on and one restore was practised.
  6. Test families are removed from production, and error alerts or a log drain are on.

## eguard requirements: Website legal, trust and measurement

The website legal, trust and measurement requirements come from launch-visibility.md, "Production go-live" and section 9.

**R14. The website's legal and trust items are complete.**
- Why it matters: parents decide whether to trust eGuard with their children's devices.
- Priority: Must for items 1–2 ("Still to do" in the source); the others are done.
- Acceptance criteria:
  1. A lawyer has reviewed the privacy policy and terms (open).
  2. The Data Protection Officer is designated by name with the National Privacy Commission (open).
  3. No rating, user-count or unverified "trusted by" claim appears on the site (done).

**R15. Measurement uses cookieless tools on public pages only.**
- Why it matters: eGuard's privacy promise has to hold for its own analytics.
- Priority: Should (open in the source checklist).
- Acceptance criteria:
  1. Cookieless analytics run on public pages only, after the privacy policy's Cookies section is updated.
  2. No ad pixel runs on signed-in pages.
  3. The sign-up funnel is reviewed weekly against production.

## eguard requirements: Parent care pilot

The Parent care pilot requirements come from features/parent-care.md, sections 10 and 11.

**R16. Parent care is piloted only after the four "Before the pilot" steps.**
- Why it matters: the feature has open legal, language and testing items.
- Priority: Must.
- Acceptance criteria:
  1. The local development database's migration history is restored and the test suites run again.
  2. A legal and Data Protection Officer review is complete, with privacy-policy wording (the policy was updated 2026-10-28; the DPO review is open and the holdout group is not described yet).
  3. `/plan` and the Parent care settings section are clicked through on a phone and a desktop.
  4. The deploy starts with all automations paused; `follow_up` and `weekly_plan` resume first, then the rest.

**R17. Parent care never delays or limits safety alerts and respects consent and contact limits.**
- Why it matters: Parent care is optional; safety alerts are not.
- Priority: Must (stated as built and tested).
- Acceptance criteria:
  1. Safety alerts are sent before the Parent care step and never count against its limits.
  2. Push and email go only to parents who gave recorded consent.
  3. No parent receives more than 1 push or email a day and 3 per rolling 7 days, or more than 2 in-app messages a day and 6 per 7 days.
  4. Quiet hours (default 21:00–07:00, the parent's local time) defer push and email.

## eguard requirements: Organizations

The organization requirements come from organizations.md.

**R18. An organization never sees an individual family's data.**
- Why it matters: the public Security and privacy page promises it, and it keeps organizations clear of Data Privacy Act obligations.
- Priority: Must ("The rule every phase follows").
- Acceptance criteria:
  1. An organization sees counts of families joined and codes redeemed, never names, children, devices, settings, activity or locations.
  2. No screen or export shows an organization which family redeemed a code.
  3. The daily activity email contains counts and no names.

**R19. Sponsor codes follow the Phase 1 rules.**
- Why it matters: codes are payments and bearer secrets.
- Priority: Must (Phase 1 specification).
- Acceptance criteria:
  1. Codes are sold for 1, 3, 6 or 12 months, 1 to 200 per batch, redeemable within 12 months of payment, with the volume discounts in "Pricing and Discount Rules".
  2. Codes are created once, only after the payment is re-read from PayMongo.
  3. Two families cannot redeem the same code.
  4. A refund cancels unredeemed codes and keeps redeemed plans running.
  5. Only the family admin joins, leaves or redeems.

## eguard: Definition of done

The eguard project's definition of done depends on its objective: [TO CONFIRM: project objective and definition of done]. Until it is set, a workstream counts as done when:

1. Every Must requirement for its area above passes its acceptance criteria.
2. Customer-facing copy matches what is built (launch-visibility.md: "add a claim only once you can back it up").
3. Legal and privacy items for the area are reviewed (R14, R16).
4. Related documents are updated (desktop-agent-spec.md, child-app-spec.md and the store forms say to update the spec, the capability matrix or the privacy forms when the build differs).

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | eguard: Project Brief; eguard: Decision Log; eguard: Risks, Assumptions and Constraints; Systems Overview |

## Open questions

1. [TO CONFIRM: project objective], which decides which areas above are in scope.
2. [TO CONFIRM: project objective and definition of done] for the project as a whole.
3. [TO CONFIRM: owner role] for this document, plus its effective date and review date.
4. Priorities are not stated in the sources; the Must and Should levels above follow the rule in "How priorities were set" and need the owner's confirmation.
5. Likely missing requirements (not added): app store submission checks in app-listing.md section 15; organizations in the mobile apps (mobile-organizations.md section 10); a device API test suite, which child-app-spec.md says to add before the app's beta; browser extension requirements; requirements for the iOS screen-time reports, which depend on child-app-spec.md decision D4.
6. Platform capabilities disagree: child-app-spec.md section 3 lists Android App Restrictions and Content as "Available" and iOS Downloads as "Verify only"; its section 6 and mobile-api.md say Android App Restrictions and Content are "Set by you" and iOS Downloads is applied by eGuard. Age-rating tiers also differ: mobile-api.md "4, 9, 13, 16, 18"; child-app-spec.md "4, 9, 12, 13 or 17"; features/protection.md "4, 9, 12, 13, 16, 17, 18".
7. What happens after a device is removed: mobile-api.md and mobile-organizations.md say the app offers to set eGuard up again; child-app-spec.md says "You can now uninstall eGuard". R7 follows child-app-spec.md section 14.
8. How often a Windows PC syncs: pricing-desktop.md says "every 5 minutes, like a phone"; desktop-agent-spec.md and mobile-api.md say every 60 seconds. R12 check 4 assumes 60 seconds.
9. Organizations in the apps: organizations.md section 13 says joining in the mobile apps is "Not in Phase 1"; mobile-organizations.md says "The family side is built" in both apps.
10. Launch checklist status: launch-visibility.md section 1 says the latest copy is "not deployed yet" and email records "Needs attention"; the same file's section 9 ticks both as done.
11. Is eGuard for Windows built? desktop-agent-spec.md's status says the agent "is not built yet"; its section 10 says self-update was "built 2026-10-24".
12. Is the Android app live, and do push alerts work? Customer-facing sources (faq.md, profile.md, press-release.md) say Android works now on Google Play and that push alerts are sent; app-listing.md and child-app-spec.md say the native apps are not built, and app-listing.md, launch-visibility.md and organizations.md say push is not wired up.
13. Plan limits used in R4 and elsewhere follow subscriptions.md and plan-change-2026-10.md; faq.md, facebook-page.md (About text), features/children.md section 6, features/devices.md section 6 and the mobile-api.md plan examples show older limits.
