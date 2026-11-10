# M5 contradiction check

The M5 contradiction check was run on 2026-11-10 across all 26 eguard drafts in 01-company-foundations, 02-project-documents, 03-department-documents and 04-training-material (the "… - Index" files excluded). It looked for the same fact (price, limit, period, date, owner, term, product name, document title) stated with a different value or wording in different drafts, measured against the [drafting conventions](../00-intro/drafting-conventions.md). Differences between drafts were fixed in place: 24 edits in 10 drafts, grouped below into 12 facts. Contradictions that come from the source files were not resolved. They are listed with both sides quoted. No [TO CONFIRM] marker was removed, no Open questions item was deleted, and no fact was added that is not in the sources.

For the four open points in the drafting conventions (eGuard for Android on Google Play, push alerts, a browser on a paired Windows PC, the Google Play package name), every draft that states the fact now carries the same marker:

- [TO CONFIRM: whether eGuard for Android is live on Google Play]
- [TO CONFIRM: whether push alerts work]
- [TO CONFIRM: whether a browser on a paired Windows PC takes a device slot]
- [TO CONFIRM: Google Play package name]

The fifth open point, [TO CONFIRM: project objective], already read the same in every project draft.

## Checks that found no difference

These facts already had the same value and wording in every draft:

- prices (₱149 / ₱1,490 and ₱249 / ₱2,490, yearly = 10 months)
- the current and legacy plan limits
- payment methods, the 3-day pass reminder and the 3-day grace period
- sponsor-code lengths, batch size, the 12-month redemption window and volume discounts
- 90-day activity retention and location history
- the support address and "replies within 1 business day"
- www.eguard.family and its paths
- the 10-minute maintenance job
- the 15-minute pairing code
- product, plan and term spellings (no "Eguard", "organisation", "Family plan", "PHP 149" or "DevCom Digital" alone)

Every document title cited in a draft body or in a "Related documents" cell matches a real draft title. The only exception is "Teams and Responsibilities" (C4, skipped), which appears only in the Company Glossary's Open questions.

## Differences between drafts that were fixed

| Fact | Was | Now | Documents |
|---|---|---|---|
| Browser on a paired Windows PC (decision D6 status) | "In force according to pricing-desktop.md; see Open questions for a conflicting source." (D6 held as in force, while the drafting conventions hold the point open and the Customer FAQ says every browser counts) | "[TO CONFIRM: whether a browser on a paired Windows PC takes a device slot]. pricing-desktop.md and browser-extension-api.md record the rule as built on 2026-10-23; faq.md quotes the pricing page FAQ, "Chrome and Edge on one laptop count as two devices" (see Open questions)." | eguard: Decision Log (D6) |
| Device slot rule stated without the open exception | "A phone, tablet, browser or PC each takes one"; "A phone, a tablet, a computer and a browser each count as one device on an eGuard plan." | Same sentence, followed by "Whether a browser on a paired Windows PC takes its own slot is [TO CONFIRM: whether a browser on a paired Windows PC takes a device slot]" (the same wording the Products and Services Catalogue already used) | Company Glossary ("Device slot"); Customer FAQ ("What counts as a device?") |
| Marker wording for the browser-slot point | [TO CONFIRM: device-slot rule for browsers on a paired PC] | [TO CONFIRM: whether a browser on a paired Windows PC takes a device slot] | Customer Support Playbook ("Common issue: the plan is full…" and Open question 13) |
| Push alerts stated as fact | "the 'security alerts' that are pushed on Free"; "with push for security alerts"; "push for every alert"; the standard answer "eGuard Plus and eGuard Family push every alert"; "The maintenance job sends them by email and push" | Same text with [TO CONFIRM: whether push alerts work] | Company Glossary ("Tamper and removal alerts"); Products and Services Catalogue (Free and eGuard Plus "Included"); Customer FAQ ("How will I know if something stops working?"); Customer Support Playbook ("Common issue: questions about iPhone, Windows and alerts"); Systems Overview ("How data flows…", step 3) |
| Push alerts stated as not live | "\"Push alerts (coming soon)\" while push was not live" | "\"Push alerts (coming soon)\" while push is not confirmed as working [TO CONFIRM: whether push alerts work]" | Brand Voice and Writing Style Guide ("Voice trait: honest and provable") |
| eGuard for Android on Google Play stated as fact | "eGuard works on Android phones and tablets through the eGuard app on Google Play"; claims table "Platforms today: Android phones and tablets" | Same text with [TO CONFIRM: whether eGuard for Android is live on Google Play] | Customer FAQ ("Which devices does eGuard work on?"); Brand Voice and Writing Style Guide (claims table) |
| eGuard for Android described as disputed without the marker | "see Open questions"; "is disputed"; "Other sources disagree"; "Whether push alerts and the Android app are live is disputed between sources" | The same statements now carry [TO CONFIRM: whether eGuard for Android is live on Google Play] (and the push marker where push is named) | Products and Services Catalogue ("eGuard for Android", Availability); eguard: Project Brief ("eguard: Scope included"); Systems Overview ("eGuard for Android and eGuard for iPhone and iPad"); Customer Support Playbook ("Common issue: questions about iPhone, Windows and alerts") |
| Google Play package name marker | [TO CONFIRM: package name, see Open questions] | [TO CONFIRM: Google Play package name] (see Open questions) | Submitting the App to Google Play and the App Store |
| Windows PC sync interval (decision D14) | "Status: In force." with no note of the conflicting source (D6 had one) | "Status: In force. … pricing-desktop.md gives a different interval (see Open questions)." | eguard: Decision Log (D14) |
| Date of the plan-limit change in internal documents | "28 October 2026" | "2026-10-28", as in every other internal draft | Customer Support Playbook; Brand Voice and Writing Style Guide (words table) |
| Code-signing cost | "About $200–500 a year"; "About 200–500 US dollars (USD) a year" | "About 200–500 US dollars a year", as in the Decision Log and the code-signing SOP | Pricing and Discount Rules ("Costs behind eGuard prices"); eguard: Project Brief ("eguard: Budget and cost limits") |
| When the Windows server side was built | "The server side was built 2026-10-23" | "The server side was built 2026-10-23 and 2026-10-24", as in the Project Brief (desktop-agent-spec.md section 13 lists work on both dates) | Systems Overview ("eGuard for Windows (desktop agent)") |

## Contradictions that come from the sources (not resolved)

These contradictions are in the source files. The drafts follow the conventions and list each one in their Open questions. Items 1 to 15 are the numbered contradictions in the [source inventory](../_review/source-inventory.md). Items 16 onward were found by the drafts.

1. **Children and devices per plan.** subscriptions.md, profile.md and plan-change-2026-10.md give Free 1 child / 1 device, eGuard Plus 3 / 5, eGuard Family 6 / 12. faq.md says "eGuard Plus … Up to 5" and "eGuard Family … Up to 10". facebook-page.md About says "eGuard Family is ₱249 a month for up to 10", while its Messenger FAQ says "(up to 6)". features/children.md §6 gives "Free 1, Plus 5, Pro 10". features/devices.md §6 gives "Free 2, Plus 10, Pro 20". mobile-api.md shows Free `deviceLimit: 2`, Plus 5/10 and Family 10/20. Drafts that carry it: Company Glossary, Company Overview, Products and Services Catalogue, Decision Log, Project Brief, Requirements, Brand Voice, Customer FAQ, Customer Support Playbook, Pricing and Discount Rules, Engineering Standards, Releasing a Plan-Limit or Price Change, Sales Playbook, Systems Overview, Lesson Pack.
2. **Browser on a paired Windows PC.** faq.md (pricing page FAQ): "Chrome and Edge on one laptop count as two devices". pricing-desktop.md and browser-extension-api.md (pairing): a browser on a paired computer "takes no device slot" (built 2026-10-23). Drafts: Glossary, Catalogue, Decision Log, Brief, Risks, Customer FAQ, Support Playbook, Pricing, Releasing, Systems Overview, Lesson Pack.
3. **Google Play package name.** app-listing.md and mobile-api.md give `app.eguard.android`. facebook-page.md links `com.devcom.eguard`. Drafts: Brand Voice, Releasing, Submitting, Systems Overview.
4. **Are the native apps live?** app-listing.md and child-app-spec.md: "The native apps aren't built yet". faq.md, profile.md, press-release.md and facebook-page.md: Android works now "through the eGuard app on Google Play". child-app-spec.md also mentions "Android 1.0.9". Drafts: Overview, Catalogue, Brief, Requirements, Risks, Brand Voice, Customer FAQ, Support Playbook, Go-Live, Demo Account, Submitting, Sales, Systems Overview, Lesson Pack.
5. **Push alerts.** launch-visibility.md: "Push alerts (coming soon)". app-listing.md: "Push notifications aren't wired up". organizations.md: "push isn't wired up for any alert yet". On the other side, faq.md, profile.md and press-release.md say every plan gets push for security alerts, and mobile-api.md says alerts are pushed through FCM. Drafts: Glossary, Data Handling, Catalogue, Brief, Requirements, Risks, Brand Voice, Customer FAQ, Support Playbook, Parent Care, Go-Live, Submitting, Sales, Systems Overview, Lesson Pack.
6. **iPhone in store copy.** app-listing.md Play description: "Works with Android phones and tablets, iPhone and iPad". Every other file: "coming soon". Drafts: Catalogue, Risks, Brand Voice, Submitting, Demo Account.
7. **Volume discount.** organizations.md and profile.md give 10% off for 10–49 codes and 15% for 50–99. organization-api.md's example is "10 codes × 3 months of Plus = ₱4,470.00", and mobile-organizations.md's is "50 codes × 3 months = ₱22,350"; neither applies the discount. Drafts: Catalogue, Pricing, Sales.
8. **Code-signing cost and option.** pricing-desktop.md: "About $10 a month (Azure Trusted Signing), or $200–400 a year (OV certificate)". code-signing.md: Azure is "not available to us", and OV costs about $200–500 a year. Drafts: Decision Log, Brief, Risks, Code-Signing SOP, Engineering Standards, Pricing.
9. **PC sync interval.** pricing-desktop.md: "A PC syncs every 5 minutes, like a phone". desktop-agent-spec.md and mobile-api.md: every 60 seconds. Drafts: Glossary, Decision Log, Requirements, Risks, Pricing, Releasing, Systems Overview.
10. **Windows agent build status.** desktop-agent-spec.md status: "not built yet". Its section 10: updates "built 2026-10-24". desktop-agent-prompt.md disagrees with the spec on Firefox policy, UI toolkit and uninstall entry. code-signing.md step 5 still names Tauri and WiX. Drafts: Brief, Requirements, Risks, Engineering Standards, Systems Overview, Code-Signing SOP.
11. **Capabilities per platform and age tiers.** child-app-spec.md §3 says Android App Restrictions and Content are "Available", while its §6 and mobile-api.md say "Set by you". Age-rating tiers: mobile-api.md "4, 9, 13, 16, 18"; child-app-spec.md "4, 9, 12, 13 or 17"; features/protection.md "4, 9, 12, 13, 16, 17, 18". Drafts: Glossary, Requirements, Systems Overview.
12. **After a device is removed.** mobile-api.md and mobile-organizations.md: the app offers to set eGuard up again. child-app-spec.md: "You can now uninstall eGuard". Drafts: Requirements, Systems Overview.
13. **Organizations in the apps.** organizations.md §13: joining in the mobile apps is "Not in Phase 1". mobile-organizations.md: "The family side is built". Drafts: Requirements, Customer FAQ, Support Playbook, Sales, Systems Overview.
14. **Launch checklist.** launch-visibility.md §1: latest copy "not deployed yet" and email records "Needs attention". Its §9 ticks both as done, while §2 says "don't announce it until these are done". Drafts: Brief, Requirements, Risks, Engineering Standards, Systems Overview, Go-Live.
15. **₱199 in a flow diagram.** subscriptions.md §4: "Pay ₱199". Every price table: ₱149 or ₱249 a month. Drafts: Catalogue, Decision Log, Pricing, Refunding, PayMongo.
16. **Browser slots, general rule and exception, in one file.** browser-extension-api.md §4 says "Connected browsers count toward the plan's device limit, the same as phones". Its pairing section says a browser on a paired computer "takes no device slot". This is probably a general rule and an exception, but it reads as a contradiction when quoted alone. Draft: Systems Overview.
17. **Maintenance job interval.** subscriptions.md §7.4: "every 5–15 minutes". launch-visibility.md, features/parent-care.md and console.md: every 10 minutes. mobile-api.md: "every few minutes". Drafts: Parent Care, PayMongo, Systems Overview.
18. **Profiles.** profile.md lists Protected, Balanced and Custom. features/children.md offers only Protected or Balanced. Draft: Glossary.
19. **Free plan app wording.** faq.md: "limited app monitoring". plan-change-2026-10.md: "limits for up to 5 apps". subscriptions.md: lists show 5 apps, but blocking by name works on every plan. Drafts: Catalogue, Customer FAQ.
20. **Pass length.** profile.md: "a one-month pass that doesn't renew". subscriptions.md and faq.md also offer a one-year pass. Draft: Catalogue.
21. **Priority support.** mobile-api.md lists "Priority support" as a plan feature. subscriptions.md: `priority_support` "is shown in the feature list but not enforced". Drafts: Catalogue, Support Playbook.
22. **What a plan changes.** subscriptions.md: "The only thing a plan changes is the device limit". Its own entitlement table lists child limits, location sharing, alerts and reports by plan. Draft: Decision Log.
23. **Price settings.** subscriptions.md §2 lists monthly and yearly settings, while §10 lists only `PRICE_PLUS_MONTHLY` and `PRICE_PRO_MONTHLY`. pricing-desktop.md §7 sets only monthly values, while §6 names yearly prices. Drafts: Pricing, Releasing, PayMongo.
24. **Google Play base plans and billing.** app-listing.md §6 lists only monthly base plans, while subscriptions.md §2 says each product needs monthly and yearly ones. subscriptions.md §14 says Play billing is off, while plan-change-2026-10.md step 5 asks for Play Console updates and launch-visibility.md says to set "Google Play billing and RTDN variables". Drafts: Releasing, Go-Live.
25. **Refund webhook event.** subscriptions.md §7.2 acts on `refund.updated`, but the §10 set-up list does not subscribe to it. Draft: PayMongo.
26. **Console page name.** console.md: broadcasts are sent from "**Email**". plan-change-2026-10.md: "**Console › Broadcasts**". Draft: Sending a Broadcast.
27. **Parent care start-up and privacy policy.** features/parent-care.md says "Deploy with all automations paused". Its deployment steps say the next cron run "starts planning". Its §10 says the privacy policy should mention the messages before the pilot, while §11 says "Policy updated 2026-10-28" but "the holdout cohort isn't described yet". Draft: Parent Care.
28. **Demo account set-up.** app-listing.md §12 seeds three children and 5 non-syncing devices, while its reviewer notes describe "a child … with paired Android and iOS devices". The same section treats the account as both already created and to be created. Draft: Demo Account.
29. **Sign-up email.** launch-visibility.md's end-to-end test expects a "verification email". features/authentication.md says sign-up sends a 6-digit code. Draft: Go-Live.
30. **Deleting an organization.** organizations.md: "Support can do it". console.md has no delete action. Draft: Support Playbook.
31. **Windows open questions file.** desktop-agent-open-questions.md says "None is decided yet", while its table marks six questions Settled. Draft: Decision Log.
32. **Server gaps G1 and G5.** child-app-prompts.md marks them open. child-app-spec.md §13 marks them done (2026-10-14 and 2026-10-13). Draft: Systems Overview.

## Wording differences left as they are

| Difference | Documents | Reason |
|---|---|---|
| Dates in prose ("28 October 2026") versus ISO dates ("2026-10-28") | Customer FAQ (prose) versus all internal drafts (ISO) | The Customer FAQ is customer-facing and follows the Brand Voice rule "Dates in prose: day, month in words, year". The house date format is held as [TO CONFIRM: house date format] in the Brand Voice guide. Dates quoted from a source as written ("4 October 2026", the date the Knowledge Center articles were written) were also kept |
| Old limits (5/10, 10/20), "eGuard Free", "a computer and a browser each count as one device" and "push notification" in Notice A and Notice B | Releasing a Plan-Limit or Price Change | The notices are the dated text sent on 2026-10-28 and are kept as a record. The draft's Open question 14 already says not to reuse the text until the browser-slot point is settled |
| Source quotes with "$" amounts ("$200–400 a year", "$10 a month") | Open questions in the Decision Log, Brief, Risks, Code-Signing SOP, Engineering Standards, Pricing | Exact quotes from pricing-desktop.md and code-signing.md. Running text uses "US dollars" |
| Compound markers containing the project objective ("[TO CONFIRM: project objective, deadline and main deliverable]", "[TO CONFIRM: project objective and definition of done]") | eguard: Project Brief; eguard: Requirements and Acceptance Criteria | Each marker contains the canonical phrase and asks for more than one item; splitting them would add markers, not align them |
| Decision headings D6 "Browsers on a paired PC take no device slot" and D14 "Computers sync every 60 seconds" | eguard: Decision Log | A decision log records each decision as the source states it. The Status lines now show that the value is disputed |
| "Works on Android, Chrome, Edge and Firefox" in the "writes like this" column | Brand Voice and Writing Style Guide | Quoted as an example of concrete copy from marketing-site-review.md, not as a claim. The claims table now carries the Android marker |
| Phone sync given as "about every 5 minutes" (Glossary, Customer FAQ, Support Playbook, Lesson Pack) and "300 seconds today" (Systems Overview) | Several | Same value. The Systems Overview gives the technical setting for engineers |
| Firebase Cloud Messaging described as a working system | Data Handling and Confidentiality (approved tools); Systems Overview (FCM section) | Both describe how the system is built, not a promise to customers. Each draft already flags the push question in its Open questions (and the Systems Overview FCM section says so in its text) |
