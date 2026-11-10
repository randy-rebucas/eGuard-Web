# M7 final checks

M7 final checks records the final check before upload (prompt M7) run on 2026-11-10 on all 26 eguard drafts, against the house rules and the [drafting conventions](../00-intro/drafting-conventions.md). Each draft was checked for sections that do not make sense on their own, vague openers, sections over about 300 words, facts stated twice, inconsistent spellings, missing units, currency or time zones, text addressed to an AI, sensitive content, and more than one subject. Problems fixable from the sources were fixed in place; the rest are listed per document.

The check ignored the expected [TO CONFIRM] markers and Open questions sections. No marker was removed, no Open questions item was deleted, and no contradiction that comes from the sources was resolved. Missing owner roles, effective dates and review dates are shared by every draft and are not repeated below. In the SOPs, repeats between a "Time targets" table and the steps were accepted as part of the S1 template.

## Company Glossary

Fixed:
- Summary opener "This glossary defines…" changed to "The Company Glossary defines…".
- "Plans and billing terms" (357 words) split into "Plan terms" (plans, limits, legacy limits, device slot, entitlement) and "Billing and payment terms" (pass, auto-renew, grace period, sponsored plan, PayMongo, Philippine peso).
- "Organization terms" (344 words) split into "Organization terms: organizations and membership" and "Organization terms: sponsor codes and the Organization API".
- "Protections" (315 words) split into "Protections" (the 10 protections) and "Protection tools" (profiles, category limits, extra time); the "Protections" opener now points to the new section.

Remaining (not fixable from the sources):
- The "Tamper and removal alerts" entry says security alerts are pushed on Free; whether push works at all is disputed between sources (Open question 8).
- The "Sync" entry gives only the phone interval because the PC interval is disputed (5 minutes or 60 seconds).
- No team or department terms can be added; the sources name none, and "Teams and Responsibilities" is marked Skip in the Company Foundations index.

## Company Overview

Fixed:
- Summary opener "This document describes…" changed to "The Company Overview describes…".
- "organised" changed to "organized" in the Summary and the section heading, to match "organization" everywhere else.
- "Customers and markets" no longer repeats that prices are in Philippine pesos; it refers to "Working hours, time zone and currency".
- "How work is requested and approved" item 4 repeated who may buy plans and sponsor codes; it now refers to "Customers and markets".
- Wrong document title "Sending a broadcast to parents from the console" corrected to "Sending a Broadcast to Parents".
- "Working hours, time zone and currency" started with a bare table; an opening sentence now names the subject.
- "Teams and Responsibilities" removed from Related documents, because the Company Foundations index marks that document Skip (no source material).

Remaining (not fixable from the sources):
- Departments, owner and founder names, working hours, spending approval limits and the DPO's name are not in the sources.
- The positioning follows the customer-facing sources on eGuard for Android being live on Google Play; app-listing.md disagrees (Open question 14).

## Data Handling and Confidentiality

Fixed:
- Summary opener "This policy sets out…" changed to "The Data Handling and Confidentiality policy sets out…".
- Opening sentences added to three sections that started with a bare table: "Data categories: financial, partner and employee data", "Who may share what with whom: families, organizations and the public" and "Rules for personal data: retention periods".

Remaining (not fixable from the sources):
- Incident contact and deadline, DPO name and contact, retention for account, purchase and support data, and what Google reCAPTCHA v3 and Have I Been Pwned receive are not in the sources.
- Card details are mentioned in three places (never collected; how financial data is stored; what PayMongo receives). Each covers a different aspect, so all three were kept; the owner may prefer one statement with references.
- The Firebase Cloud Messaging row depends on whether push alerts are live, which the sources dispute.

## Products and Services Catalogue

Fixed:
- Summary opener "This catalogue lists…" changed to "The Products and Services Catalogue lists…".
- Children and device limits were repeated in the Free, eGuard Plus and eGuard Family tables ("Who it is for" and "Included"). They are now stated once in "Plan limits and legacy limits", and the plan tables refer to it.
- The eGuard for Windows row repeated "a PC counts as one device"; it now refers to "Plan limits and legacy limits".
- "No card needed" was stated in both "How plans are bought and paid for" and the Free table; the Free table no longer repeats it.

Remaining (not fixable from the sources):
- Free "push for security alerts" and eGuard Plus "push for every alert" follow profile.md and faq.md; other sources say push is not wired up (Open question 9).
- eGuard for Android availability on Google Play is disputed (Open question 8).
- Whether a browser on a paired Windows PC takes a device slot, whether creating an organization is free, and the iPhone and Windows release dates are not in the sources.
- Volume-discount examples in the sources disagree with the published tiers (Open question 13).

## eguard: Decision Log

Fixed:
- Summary opener "This log records…" changed to "The eguard Decision Log records…".
- D10 used the internal alias "drift"; it now uses the canonical wording ("a setting that changed on the device").

Remaining (not fixable from the sources):
- D6 is recorded as in force (browsers on a paired PC take no device slot) because pricing-desktop.md says so, while faq.md says the opposite and the brief treats the rule as [TO CONFIRM]. The draft already flags this.
- The deciding role is missing for D1, D2, D10, D16 and D19 to D25, and the date is missing for D11, D22 and D23.
- D8 holds the conditional future prices (₱179, ₱299, ₱1,790, ₱2,990) and the price-review thresholds. "Data Handling and Confidentiality" classes these as Confidential, but the rest of the log is Internal. See the split proposal.

## eguard: Project Brief

Fixed:
- Summary opener "This brief describes…" changed to "The eguard Project Brief describes…".
- "eguard: Teams and roles involved" and "eguard: Constraints" now start by naming their subject instead of "The sources name…" and "The main constraints…".
- The separate "eguard: Related documents" section repeated the Document control list. It was removed, its extra titles were moved into Document control, and the Summary now points there.

Remaining (not fixable from the sources):
- The objective, scope, exclusions, deliverables, deadline, budget and spending approver are all missing because the owner has not chosen the project objective.
- The sources disagree on the Windows build status ("not built yet" versus self-update "built 2026-10-24") and on whether the launch checklist is done.

## eguard: Requirements and Acceptance Criteria

Fixed:
- Summary opener "This document lists…" changed to "The eguard Requirements and Acceptance Criteria document lists…".
- "How priorities were set" and "Definition of done" now start by naming their subject.
- Eleven sections started with "Source: …"; each now opens with a sentence that names the requirement area and its source.
- "Core verification rule" (303 words) split: R1 and R2 stay, and R3 moves to a new "eguard requirements: Tamper alerts".
- "eGuard for Windows acceptance tests" (304 words) split into "…: pairing and enforcement" (R11) and "…: removal" (R12).
- "Website production go-live" went over 300 words after the new opener, so it was split: R13 stays, and R14 and R15 move to "eguard requirements: Website legal, trust and measurement".
- R13 quoted the source's "leaves you unaware…"; it is now paraphrased in the third person ("leaves the team unaware…").

Remaining (not fixable from the sources):
- Must and Should priorities are the drafter's rule and need the owner's confirmation.
- R12 check 4 assumes a 60-second PC sync, which pricing-desktop.md disputes (5 minutes).
- Likely missing requirement areas (store submission, the browser extension, organizations in the apps) cannot be written from the sources.

## eguard: Risks, Assumptions and Constraints

Fixed:
- Summary opener "This document lists…" changed to "The eguard Risks, Assumptions and Constraints document lists…".
- "eguard risks: platform and store" (346 words) split into "…: Apple and Google Play approval" (RK1–RK3) and "…: store copy, privacy forms and push alerts" (RK4–RK6).
- "eguard risks: eGuard for Windows" (455 words) split into "…: signing, anti-cheat and administrator accounts" (RK7–RK10) and "…: enforcement gaps, support and competition" (RK11–RK14).
- "eguard risks: operations and billing" (346 words) split into "…: Parent care operations and billing" (RK20–RK23) and "…: device reporting gaps" (RK24–RK26).
- "eguard constraints" (315 words with its opener) split into "…: law and store policies" and "…: company promises and technical choices".
- Every risk, assumption and constraint section started with a bare table; each now opens with a sentence that names its subject.
- RK18's mitigation repeated the claims and screenshots constraint; it now refers to that constraint.

Remaining (not fixable from the sources):
- Likelihood, impact and owner role are [TO CONFIRM] for almost every risk.
- Assumption A2 (about ₱58 to the US dollar; Qustodio's October 2026 US prices) may be out of date and has to be re-checked before use.

## Customer Support Agent: Lesson Pack

Fixed:
- Summary opener "This lesson pack teaches…" changed to "The Customer Support Agent Lesson Pack teaches…".
- "What the customer support agent is not responsible for" repeated the list of child-activity data from Rule 1; it now refers to Rule 1.
- The "Promising a date" mistake repeated Rule 5's availability wording; it now refers to Rule 5.
- The closing line of "Where to find more" repeated the Help Center and Knowledge Center links; it now refers to the responsibilities section.
- "Common mistakes and how to avoid them" and "Where to find more" started with a bare table; each now has an opening sentence.

Remaining (not fixable from the sources):
- The "customer support agent" role is proposed and not defined in the sources. The fact sheet also mentions possible "AI employees", so the word "agent" could be read either way. The owner should confirm the role name.
- Rule 5 restates the current plan limits that "Products and Services Catalogue" holds. They were kept because the rule itself is about quoting them correctly; the owner may prefer a reference only.
- Escalation contacts and who carries out refunds and plan changes are not in the sources.

## Customer FAQ

Fixed:
- Summary opener "This FAQ answers…" changed to "The Customer FAQ answers…".
- "Philippine pesos (₱)" was stated in both the Summary and the pricing answer; it is now stated once, in "How much does eGuard cost?".
- "How is eGuard different…?" repeated the definitions of Verified and Failed; it now refers to "What do Verified and Failed mean?".
- "Can schools or organizations use eGuard?" repeated the counts-only rule; it now refers to "What does an organization see if my family joins?".
- "What's the difference between a pass and auto-renew?" repeated the auto-renew payment methods; it now refers to "How can I pay?".
- The pricing answer repeated the eGuard Plus alerts, location sharing and category limits; it now refers to the answers that explain them.
- Related document title "Data Handling and Confidentiality Policy" corrected to "Data Handling and Confidentiality".

Remaining (not fixable from the sources):
- "What counts as a device?" says each browser counts as one device, which may not hold for a browser on a paired Windows PC. That rule is [TO CONFIRM], and the draft deliberately leaves the exception out.
- The push-alert answer and the "Android … on Google Play" answer follow customer-facing sources that other sources dispute.
- The answers to refunds, free trials, official receipts, the support phone, Filipino-language help and the minimum Android version are not in the sources.
- The question headings use the customer's own words ("I", "my") by design; the answers are in the third person.
- The FAQ uses the date style "28 October 2026", while the project documents use 2026-10-28. The house date format is [TO CONFIRM] in the Brand Voice guide.

## Customer Support Playbook

Fixed:
- Summary opener "This playbook describes…" changed to "The Customer Support Playbook describes…".
- UK spellings "prioritised" and "Apologise" changed to "prioritized" and "Apologize", to match the rest of the library.
- Procedure step 5 repeated the console's list of hidden child data; it now refers to "What staff can and cannot do in the console".
- The console table repeated where refunds are done; it now refers to "Refunds, credits and exceptions".
- The pairing-code step repeated "15 minutes"; it now says "before it expires", and the expiry stays in the section opener.
- Wrong document titles corrected in the text and in Document control: "Refunding a Purchase", "Sending a Broadcast to Parents" and "Data Handling and Confidentiality".

Remaining (not fixable from the sources):
- Working hours, priority levels, resolution targets, refund limits and approvers, the identity check and escalation contacts are all [TO CONFIRM].
- The answer "Will I get push alerts?" follows the customer-facing sources; push status is disputed.
- The Messenger instant reply quotes "within a working day", while the published promise is "within 1 business day". Both are quoted from the sources.

## Sales Playbook

Fixed:
- Summary opener "This playbook describes…" changed to "The Sales Playbook describes…".
- "Qualification questions" opener "These questions help…" changed to "The organization qualification questions help…".
- The counts-only rule was repeated in the organization fit table and in question 10; both now refer to "Objection: what will the school, the company or eGuard see about us".
- "Objection: it is too expensive" repeated the Free plan's limits; it now refers to the Family Safety objection.
- Onboarding step 6 repeated how sponsor codes are redeemed; it now refers to "Objection: we want to pay or redeem in the app".
- The barangay value message repeated the 12-month redeem rule held in onboarding step 8; the duplicate was removed.
- "about ₱58 to the dollar" changed to "about ₱58 to the US dollar" (currency stated).
- "labelled" changed to "labeled".
- The cross-reference to the FAQ answer now uses the FAQ's real heading, "Can my child switch eGuard off or uninstall it?".

Remaining (not fixable from the sources):
- Approver roles, the CRM or lead list, the onboarding owner, the official-receipt process and typical customer sizes are not in the sources.
- Internal competitor pricing (Qustodio at about ₱290 a month) sits in an otherwise Internal playbook. See the split proposal.
- The value messages still briefly restate some facts from the objection sections, because each message is meant to be quoted alone. The owner may prefer references.

## Brand Voice and Writing Style Guide

Fixed:
- Summary opener "This guide sets out…" changed to "The Brand Voice and Writing Style Guide sets out…".
- First-person headings and table headers changed to the third person: "Who eGuard writes for", "Claims eGuard may make", "Claims eGuard may not make", and "eGuard writes like this".
- "Words we use and words we avoid" (307 words after edits) split into "Words eGuard uses: product, plan and status terms" and "Words eGuard uses: customer, organization and messaging terms".
- The eGuard capitalization rule was stated in both the words table and "Formatting conventions"; the words table now refers to "Formatting conventions".
- Four rows of the words table (iPhone, Windows, spy and secret, and trusted by) repeated rules from "Claims eGuard may not make"; they now refer to it.
- UK spellings "Capitalised" (twice), "judgement" and "labelled" changed to US spelling, to match "behavior" and "organization".
- Wrong document titles in Related documents corrected: "Company Glossary", "Writing and Checking a Knowledge Center Article" and "Sending a Broadcast to Parents".

Remaining (not fixable from the sources):
- The example "'Push alerts (coming soon)' while push was not live" says push was not live, while the FAQ, Catalogue and Support Playbook follow sources that say push is sent. This cross-document inconsistency comes from the sources (inventory contradiction 5).
- The house date format, support reply structure and approvers for publishing are [TO CONFIRM].

## Pricing and Discount Rules

Fixed:

1. Facts stated twice: the competitor table repeated eGuard's own monthly prices. The two eGuard rows were removed and replaced with a pointer to "Price list for eGuard plans".
2. Facts stated twice: "What never gets discounted at eGuard" restated the reasons already given in other sections. Items 1, 2, 3 and 5 now name the section that holds the rule.
3. Broken reference: "Standard Terms Summary" does not exist and is not planned. The refund-approval pointer and the Related documents entry now name "Refunding a Purchase".
4. Inconsistent document title: "Decision Log" changed to "eguard: Decision Log".

Remaining (not fixable from the sources):

- Who approves a list-price change or any discount outside the automatic volume discounts, target margins, PayMongo fees, the Windows release date and the end date of the launch offer are not in the sources.
- The sources give the costs and competitor prices in US dollars only. The document marks the currency and the assumed rate of about ₱58 to the dollar, but has no peso figures for the costs.
- The sources give no time zone for the legacy-limits cutoff (paid before 2026-10-28), so none was added.
- The yearly price ("two months free") is listed both as a price rule and as a row in the discount table. It was kept in both places so the discount table stays the complete list of discounts.
- The contradictions taken from the sources (code-signing cost, how often a PC syncs, sponsor-code examples without the discount, the "Pay ₱199" diagram, plan limits, device slots for browsers) are still open.

## Systems Overview

Fixed:

1. Missing time zone: Parent care quiet hours read "21:00–07:00 local". They now say the times are in the parent's own time zone and that the family default is Asia/Manila.
2. Inconsistent spelling: the heading and opener "eGuard app for Android and iOS" now use the canonical names "eGuard for Android and eGuard for iPhone and iPad", with "the eGuard app" defined once as the name for the shared app.
3. Inconsistent spelling: the Firebase Cloud Messaging "Talks to" row now uses the canonical app names.
4. Facts stated twice: "Known limitations" repeated the broadcast rate of about 600 emails an hour and the email and push delivery limits. Those items now point to the email and push sections.
5. Facts stated twice: the "no staff tool to grant a plan or issue refunds" limitation now points to "Console (staff back office)".
6. Section over 300 words: "How data flows between eGuard systems" (301 words) was split into two sections. The first covers settings, device data, alerts and payments. The second covers sponsor codes, browser policy, broadcasts and the Organization API.
7. Inconsistent document titles in Related documents: "Data Handling and Confidentiality Policy" changed to "Data Handling and Confidentiality", and "Glossary" changed to "Company Glossary".

Remaining (not fixable from the sources):

- No system has a named owner, and the sources do not say whether a staging environment, on-call cover or uptime monitoring exists.
- The source contradictions are still open: whether the native apps are live, whether push alerts work, the PC sync interval, the Windows agent's build status, protection capabilities per platform, the maintenance job interval, and the Google Play package name.

## Engineering Standards and Release Procedure

Fixed:

1. Restated SOP: "Production go-live checks for eGuard" repeated the seven checks from "Production Go-Live Checks". It now has a one-line pointer to that SOP. The production seed warning stays in this document, and demo-family refreshes point to "Refreshing the Store-Review Demo Account".
2. Restated SOP: "Switching on sign-in hardening in production" repeated the switch-on steps. It now points to "Production Go-Live Checks", section "Procedure: switching on sign-in protections".
3. Restated SOP: the Windows release steps for signing, timestamps, publisher name, beta group and Defender false positives, plus the certificate's lead time and renewal, now point to "Buying and Renewing the Code-Signing Certificate" (steps 5 to 8). One fact is not in that SOP and was kept here: publishing the release on the server (`DESKTOP_RELEASE`) and the agents' signed-manifest check.
4. Restated SOP: the three Parent care rollback steps now point to "Deploying, Pausing and Rolling Back Parent Care", section "Procedure: rolling back Parent care".
5. Restated SOP: the plan-limit rollback note now points to "Releasing a Plan-Limit or Price Change".
6. Restated SOP: the Parent care deployment detail and the price-change line under "Release steps for an eGuard server release" now point to the Parent care SOP and to "Releasing a Plan-Limit or Price Change".
7. Inconsistent spelling and restated SOP: the section on releasing the apps and eGuard for Windows now uses the canonical app names. App releases now point to "Submitting the App to Google Play and the App Store".
8. Facts stated twice: the Parent care message-spike line under incidents now refers to the Parent care SOP.
9. Inconsistent document titles in Related documents: changed to "Data Handling and Confidentiality", "eguard: Decision Log" and "eguard: Risks, Assumptions and Constraints".

Remaining (not fixable from the sources):

- The sources do not cover code style, code review, branch naming, repository hosting, a general rollback procedure, incident hand-over, or who approves a release, a migration or an emergency change.
- The generic server release steps were kept, because no other SOP holds a general release procedure.
- The 12 pre-existing API test failures conflict with the merge rule. The Windows agent's build status, the go-live checklist, and the Parent care deployment status are also still open.

## Refunding a Purchase

Fixed:

1. Section opener: the Summary began "This SOP describes". It now names "The refund procedure".
2. Missing currency: two refund-approval limits (auto-renew invoice, sponsor-code batch) now ask for the amount in Philippine pesos (₱), matching the pass row. The [TO CONFIRM] markers stay.
3. Inconsistent document title in Related documents: "Data Handling and Confidentiality Policy" changed to "Data Handling and Confidentiality".

Remaining (not fixable from the sources):

- The sources set no refund approvers or amount limits and give no refund eligibility rules. They also leave open the steps for a partial batch refund, the route for refunding a legacy Google Play purchase, and how official receipts (BIR) are issued.
- Ending an auto-renew plan immediately still needs a direct database change, because the console has no tool for it.

## Sending a Broadcast to Parents

Fixed:

1. Section opener: the Summary began "This SOP describes". It now names "The broadcast procedure".
2. Inconsistent time zone wording: step 9 said "Philippine time". It now says "Philippine time (Asia/Manila)".
3. Facts stated twice: the delivery rate of about 600 emails an hour in "Time targets" now refers to "Sending limits for broadcasts".
4. Inconsistent spelling: the iPhone launch list's promise "when the iPhone app is out" now reads "when eGuard for iPhone and iPad is out".
5. Inconsistent document title in Related documents: corrected to "Data Handling and Confidentiality".

Remaining (not fixable from the sources):

- The sources name no broadcast approver and give no rule for corrections or resends, and no notice period before a Terms or privacy change.
- The console page is named "Email" in console.md and "Broadcasts" in plan-change-2026-10.md.
- The "Using Write with AI in a broadcast" section describes how the product's AI drafting works. It is reference material for staff and is not addressed to an AI, so it was kept.

## Releasing a Plan-Limit or Price Change

Fixed:

1. Section opener: the Summary began "This SOP describes". It now names "The plan-change release procedure".
2. Facts stated twice: Inputs item 2 repeated the price rule for existing subscribers. It now points to step 4 of "Release procedure for a price change on the web".
3. Inconsistent document title: "Decision Log" changed to "eguard: Decision Log" in three places.

Remaining (not fixable from the sources):

- The sources do not say who owns store and social copy, who approves the release and the notices, what the rollback steps are, where backups are kept, or what the notice period before a price change is.
- Customer notices A and B are quoted word for word. They address parents as "you" and repeat prices and legacy limits on purpose, because they are the record of what was sent. They are not text addressed to an AI.
- Notice B says a browser counts as one device, which conflicts with pricing-desktop.md. The price settings for the yearly price and the Google Play yearly base plans are also still open.

## Buying and Renewing the Code-Signing Certificate

Fixed:

1. Section opener: the Summary began "This SOP describes". It now names "The code-signing procedure".
2. Inconsistent date format: "March 1, 2026" changed to "2026-03-01".
3. Facts stated twice: the budget figure of about 200–500 US dollars in Inputs item 6 now refers to the Summary.
4. Facts stated twice: the lead time of 3–4 weeks before the beta in Inputs item 7 now refers to "Time targets for code signing".
5. Facts stated twice: the validation time ("a few days to two weeks") in step 3 now refers to "Time targets for code signing".
6. Facts stated twice: the D&B correction time in step 1 now refers to "Time targets for code signing".
7. Inconsistent document titles in Related documents: changed to "eguard: Decision Log", "eguard: Risks, Assumptions and Constraints" and "Data Handling and Confidentiality".

Remaining (not fixable from the sources):

- The sources do not give the registered business name, whether the business is registered with the DTI or the SEC, where the D-U-N-S number is kept, the Windows beta date, the approvers and spending limit, or how to revoke cloud-signing credentials.
- The source cost is in US dollars only.
- The sources disagree on which build tools take the sign command: Tauri and WiX in code-signing.md, plain Win32 windows in desktop-agent-spec.md.
- The D-U-N-S number is correctly left out of the document.

## Writing and Checking a Knowledge Center Article

Fixed:

1. Section opener: the Summary began "This SOP describes". It now names "The Knowledge Center article procedure".
2. Facts stated twice: step 2 repeated the 170-character description limit. It now refers to "Inputs needed before writing a Knowledge Center article".
3. Facts stated twice: the "renamed or moved setting" exception repeated a content rule. It now points to the "Hedge platform details" rule.

Remaining (not fixable from the sources):

- The sources do not name the writer, fact checker, partner reviewer or approver roles. They also give no process for reported errors or Tagalog versions, and no record of whether the pre-launch fact check was done.
- Dates in this draft are written "4 October 2026", as in the source, while other drafts use ISO dates. The draft is consistent within itself, so the format was left for the library-wide style decision.

## Deploying, Pausing and Rolling Back Parent Care

Fixed:

1. Section opener: the Summary began "This procedure explains". It now names "The Parent care deployment procedure".
2. Inconsistent term: "runs inside the existing eGuard app" now reads "eGuard web application". In the other drafts, "eGuard app" means the mobile app.
3. Sections that do not make sense on their own: eight generic headings ("Purpose", "When this procedure applies", "Roles involved", "Inputs needed before starting", "Approvals required", "Exceptions and what to do", "Outputs and where they are recorded", "Time targets") now name Parent care. Cross-references inside the document were updated to match.
4. Broken cross-reference: step 7 sent readers to "Procedure: pausing Parent care", which does not exist. It now points to "Procedure: pausing and resuming Parent care".
5. Wrong document title: "Sending a Broadcast to Parents from the Console" corrected to "Sending a Broadcast to Parents" in two places.

Remaining (not fixable from the sources):

- The sources do not say whether Parent care is deployed, whether automations can be paused before the first cron run, who deploys and approves, who the Data Protection Officer is, how many runs to watch before resuming, how the export is made, or where rollbacks are recorded.
- Whether push works in production is still contradicted across sources.

## Submitting the App to Google Play and the App Store

Fixed:

1. Section opener and inconsistent spelling: the Summary began "This procedure describes how the eGuard mobile app". It now names the procedure and uses the canonical names "eGuard for Android and eGuard for iPhone and iPad".
2. Sections that do not make sense on their own: eight generic headings now name the app store submission.
3. Sections that do not make sense on their own: "Procedure: preparing both stores", "Preparing screenshots and graphics" and "Writing the reviewer notes" were renamed to name the stores. Cross-references were updated.
4. Missing units: the Play feature graphic sizes (1024 × 500 and 924 × 400) now give the unit, pixels.
5. Facts stated twice: the "no prices or buy buttons" limit in the approvals table now points to "Preparing app store screenshots and graphics".

Remaining (not fixable from the sources):

- The sources disagree on the Google Play package name and on whether the apps are built or live.
- The sources leave open the iOS purchase option, the final permissions, SDKs and diagnostics, the account type, the developer phone and full address, and who handles rejections.
- The full address and the D-U-N-S number are correctly left out of the document.

## Refreshing the Store-Review Demo Account

Fixed:

1. Section opener: the Summary began "This procedure explains". It now names "The demo account refresh procedure".
2. Sections that do not make sense on their own: eight generic headings now name the demo account refresh, and the cross-reference in step 2 was updated.
3. Section heading: "Procedure: pairing real test devices for review" now says "for store review", and the cross-reference in step 7 was updated.

Remaining (not fixable from the sources):

- The sources do not say which password manager is used, who has access, who approves or how close to submission the refresh runs.
- Within app-listing.md, the seeded demo family and the reviewer notes describe different set-ups.
- Pairing a test iPhone conflicts with the sources that say the iPhone app is "coming soon".
- The demo account's email address and password are correctly left out of the document.

## Production Go-Live Checks

Fixed:

1. Section opener: the Summary began "This procedure lists". It now names "The production go-live procedure".
2. Sections that do not make sense on their own: eight generic headings now name the production go-live checks.
3. Internal inconsistency: "Procedure: switching on sign-in protections" introduced "three production steps" but listed six. The intro now says steps 1 to 3 are the production steps and steps 4 to 6 are follow-up checks, as in features/authentication.md.

Remaining (not fixable from the sources):

- launch-visibility.md contradicts itself: §1 lists two items as "Needs attention" while the §9 checklist ticks them. The current state is unknown.
- The sources do not say where `TWO_FACTOR_KEY` is backed up, who the backup provider is, who receives alerts, who approves, or whether `PWNED_PASSWORDS` should be on.
- The sources disagree on whether the end-to-end test should check a verification email or the emailed code, and on whether Play Billing is meant to be turned on.

## Setting Up PayMongo

Fixed:

1. Section opener: the Summary began "This procedure explains". It now names "The PayMongo set-up procedure".
2. Sections that do not make sense on their own: eight generic headings now name PayMongo set-up.
3. Sections that do not make sense on their own: "Configuration variables", "Procedure: registering the webhook", "How the webhook handles events", "Procedure: configuring and testing the server" and "Common problems and causes" now name PayMongo. The reference in step 4 was updated.

Remaining (not fixable from the sources):

- The sources do not say who holds the PayMongo account, which business documents verification needs, how long PayMongo takes, or where configuration changes are logged.
- Whether `refund.updated` must be registered is still open.
- The sources disagree on the maintenance job interval and on the price variables.
- PayMongo test card numbers are correctly left out of the document.
