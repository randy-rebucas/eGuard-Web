# Source inventory

Step 1 of filling the eguard knowledge folder. Written 2026-11-10 from every file in `docs/` except `docs/prompt-resources/`. 32 source files.

Document codes in the last column follow the catalogue in `docs/prompt-resources/README.md`.

## Files

| File | What it covers | Date (if stated) | Looks out of date? | Feeds documents |
|---|---|---|---|---|
| app-listing.md | Google Play and App Store listing copy, data-safety and privacy forms, permissions, monitoring-app policies, content rating, reviewer notes and the demo account, pre-submission checklist | Decision 2026-10-08 (no Family Link) | Yes, in part. It says "the native apps aren't built yet", but other files describe an Android app on Google Play. Its Play description says it works with iPhone and iPad, which other files call "coming soon" | C3, C6, D4, D6, P4, P5, S1 (app store submission) |
| browser-extension-api.md | API for the eGuard browser extension: pairing, rotating tokens, signed policy, site-access requests, health reports, block counts, signing-key setup | Changes "since 2026-10-13" | No | C2, D6 |
| child-app-prompts.md | Ordered build prompts for the child device app (server gaps, Android, iOS, acceptance). **Written as instructions to an AI** | 2026-10-02 status notes | Yes. Marks gaps G1 and G5 as open, which child-app-spec.md says were done on 2026-10-13 and 2026-10-14 | D6, D7 (background only) |
| child-app-spec.md | Product and technical spec for child device mode: setup, the 10 protections on Android and iOS, sync, tamper resistance, privacy, targets, gaps G1–G10, decisions D1–D8 | Written 2026-09-30; decisions 2026-10-08, 2026-10-14 | Yes, in part. Status line says the native apps aren't built, but the text refers to Android 1.0.9. Its capability table (section 3) disagrees with its own section 6 | C2, D6, P2, P4, P5 |
| code-signing.md | Choosing, buying and using a code-signing certificate for the Windows agent; providers, costs, step-by-step checklist. Step 5 says "Claude can do this step" | Status 2026-10-23: not bought yet | Possibly: status may have moved since 2026-10-23 | D7, P4, P5, S1 (code-signing certificate) |
| console.md | Staff back office at console.eguard.family: privacy rule, staff accounts and sign-in, pages, audit log, broadcasts, mailing lists, "Write with AI" drafting | v1 2026-10-07; broadcasts 2026-10-12; mailing lists 2026-10-17 | No | C2, C6, D1, D6, S1 (sending a broadcast) |
| desktop-agent-open-questions.md | Open questions Q1–Q9 for the Windows agent, with status | Written 2026-10-23; settled 2026-10-23 and 2026-10-24 | Yes. Intro says "None is decided yet" while its table marks six questions Settled | P4, P5 |
| desktop-agent-prompt.md | Build prompt for the Windows agent in 7 phases. **Written as instructions to an AI** | None | Yes. Several points (Firefox policies.json, Tauri UI, ARPNOREMOVE, open questions) were overruled by desktop-agent-spec.md | P4 (background only) |
| desktop-agent-spec.md | Product and technical spec for "eGuard for Windows": the agent's parts, pairing, app scanning, enforcement, removal protection, updates, tamper alerts, acceptance tests | Written 2026-10-23; owner decisions 2026-10-23 and 2026-10-24 | Mixed. Status line says the agent "is not built yet", while section 10 says updates were built 2026-10-24 | C3, D6, P2, P4, P5 |
| facebook-page.md | Everything to fill in on the eGuard Facebook Page: identity, bio, contact, address, action button, photos, first posts | None | Yes, in part. Its About text says eGuard Family covers "up to 10" children; its own Messenger FAQ says "up to 6" | D2, D4, S1 (Facebook Page setup) |
| faq.md | Answers to parents' questions for podcast, support, social and press | Prices as of 26 October 2026 | **Yes.** Plan table shows Plus "Up to 5" and eGuard Family "Up to 10" children, from before the 2026-10-28 plan change | D2, C3, D1 |
| features/README.md | Index of the parent web app's feature docs, with completeness | None | No | D6 |
| features/authentication.md | Sign-up, sign-in, passwords, sessions, bot check, new-device email; production switch-on steps | Hardened 2026-10-15; legacy cookie read until 2026-11-14 | Deadline 2026-11-14 is 4 days after this inventory | C6, D6, D7 |
| features/children.md | Children list, adding a child with profiles, child profile tabs, plan limits, statuses | Written 2026-10-04 | **Yes.** Section 6 gives child limits Free 1, Plus 5, Pro 10; sections 2–3 give 3 and 6 | C2, D2, D6 |
| features/dashboard.md | Parent home page, the 10 protection checks, scoring, statuses, plan gating | Last updated 2026-10-04 | Partly (dated before the plan change, though its limits match the new ones) | C2, D6 |
| features/devices.md | Pairing phones, tablets, browsers and Windows PCs; device states and management | Written 2026-10-04; computers 2026-10-23 | **Yes.** Device limits Free 2, Plus 10, Pro 20 | C2, D6 |
| features/location.md | Family map, places, visits, saved places, retention | Written 2026-10-04; additions 2026-10-07 | No | C6, D6 |
| features/parent-care.md | "Parent care" engine: tips, weekly plans, reminders, check-ins, monthly reports; pilot checklist, deploy and rollback | Status 2026-10-21 ("Nothing has been deployed"); policy updated 2026-10-28 | Possibly: deployment status may have changed | C2, C6, D6, D7, P2, P5, S1 (parent care deploy and rollback) |
| features/protection.md | Family-wide protection page, 6-step setup, configuration check, how a change is verified | Written 2026-10-04 | No | C2, D6 |
| knowledge-center.md | The `/learn` library: 100 articles in 11 topics, where they live, writing rules, pre-launch fact checks | Articles written 4 October 2026 | Re-check every six months is due by about April 2027 | C3, D4, S1 (Knowledge Center article) |
| launch-visibility.md | Website audit, fixes before launch, domain and email, search, measurement, where to announce, 30-day plan, checklist | Audits 28 September and 4 October 2026 | Partly. Section 1 lists two "Needs attention" items that the checklist at the end marks done | D3, D4, D6, P1, P2, P5, S1 (production go-live) |
| marketing-site-review.md | Review of the public website pages with ranked suggestions and build status | 2026-10-17 | No | D4, P4 |
| mobile-api.md | Wire reference for the single Android/iOS app: parent API and child device API, limits, enums, plans | Plan change 2026-10-28; gaps done 2026-10-13, 2026-10-14 | **Yes, in part.** Prose gives the new plan limits; the `/subscription/plans` examples show the old ones (Free 2 devices, Plus 5/10, Family 10/20) without saying they are legacy | C2, C6, D1, D6 |
| mobile-organizations-prompts.md | Build prompts for organizations in the apps. **Written as instructions to an AI** | None | Yes. Some endpoints were later built under different paths | D6 (background only) |
| mobile-organizations.md | Organizations in parent mode: join and leave screens, admin screens, store policy, decisions M1–M7 | Draft 2026-10-01; updated 2026-10-13 | Yes, in part. Sections 6–7 use endpoint paths its own status note says were replaced | D3, D6, P4 |
| organization-api.md | API for schools and organizations: counts, sponsor codes, batches, activity; key rules and recipes | None | Example batch amount ignores the volume discount (see contradictions) | C3, D3, D6 |
| organizations.md | Organizations feature: phases, join codes, sponsor-code batches, discounts, redemption, refunds, security | Phase 1 built 2026-10-01 | Yes, in part. Says joining in the apps and push are not built; other files say they are | C2, C3, D3, D5, P2 |
| plan-change-2026-10.md | Release steps and customer notices for the 2026-10-28 plan-limit change | 2026-10-28 | No (it is the newest statement on limits) | C3, D5, P4, S1 (plan-limit change release) |
| press-release.md | Pitch email and press release for Philippine tech media; send checklist | Checked 4 October 2026 | Odd: dated before the 2026-10-28 change but already shows the new limits (3 and 6 children). Placeholders for founder, date, phone | C1, D3, D4 |
| pricing-desktop.md | How plans and prices handle Windows PCs: competitors, costs, device slots, prices, price-review rules, owner decisions | Written 2026-10-23; superseded in part 2026-10-28 | Partly; the file says which parts were superseded | C3, D3, D5, P4, P5 |
| profile.md | One-page overview of eGuard and DevCom for partners, schools, press | Checked 7 October 2026 | Odd: dated before the plan change but shows the new limits | C1, C3, C6, D2, D3 |
| subscriptions.md | Plans, prices, web billing through PayMongo, passes and auto-renew, entitlements, enforcement, configuration, refunds, troubleshooting | Decisions 2026-10-23 and 2026-10-28 | No | C3, D1, D5, D6, P4, S1 (refunds) |

## Files that contradict each other

Each item quotes both sides. None is resolved here; step 3 asks the owner.

1. **Children and devices per plan.**
   - subscriptions.md, profile.md, plan-change-2026-10.md: Free 1 child / 1 device; eGuard Plus 3 / 5; eGuard Family 6 / 12 (families subscribed before 2026-10-28 keep 5/10 or 10/20).
   - faq.md (26 October): "eGuard Plus … Up to 5"; "eGuard Family … Up to 10".
   - facebook-page.md About: "eGuard Family is ₱249 a month for up to 10"; same file's Messenger FAQ: "(up to 6)".
   - features/children.md section 6: "Free 1, Plus 5, Pro 10".
   - features/devices.md section 6: "Free 2, Plus 10, Pro 20".
   - mobile-api.md `/subscription/plans` example: Free `deviceLimit: 2`, Plus 5/10, Family 10/20.
2. **Does a browser on a Windows PC take a device slot?** faq.md: the pricing page's FAQ says "Chrome and Edge on one laptop count as two devices". pricing-desktop.md: browsers on a paired PC take no slot since 2026-10-23 (built). browser-extension-api.md disagrees with itself: its pairing section agrees with pricing-desktop.md, while its §4 says "Connected browsers count toward the plan's device limit, the same as phones".
3. **Google Play package name.** app-listing.md and mobile-api.md: `app.eguard.android`. facebook-page.md: `play.google.com/store/apps/details?id=com.devcom.eguard`.
4. **Are the native apps live?** app-listing.md and child-app-spec.md: "The native apps aren't built yet". faq.md, profile.md, press-release.md, facebook-page.md: Android works now "through the eGuard app on Google Play". child-app-spec.md also refers to "Android 1.0.9".
5. **Push alerts.** launch-visibility.md: Plus lists "Push alerts (coming soon)". app-listing.md blocker 6: "Push notifications aren't wired up". organizations.md: "push isn't wired up for any alert yet". faq.md, profile.md, press-release.md: every plan gets push for security alerts; Plus and eGuard Family push every alert. mobile-api.md: alerts are pushed through FCM.
6. **iPhone support in store copy.** app-listing.md Play description: "Works with Android phones and tablets, iPhone and iPad". Every other file: iPhone and iPad are "coming soon".
7. **Volume discount on sponsor codes.** organizations.md and profile.md: 10–49 codes get 10% off, 50–99 get 15%. organization-api.md example: 10 codes × 3 months of Plus = ₱4,470.00 (no discount). mobile-organizations.md example: 50 codes × 3 months of Plus = ₱22,350 (no discount).
8. **Code-signing cost and option.** pricing-desktop.md: "About $10 a month (Azure Trusted Signing), or $200–400 a year (OV certificate)". code-signing.md: Azure Artifact Signing is only for organizations in the US, Canada, the EU and the UK, "so not available to us"; OV costs about $200–500 a year.
9. **How often a Windows PC syncs.** pricing-desktop.md: "A PC syncs every 5 minutes, like a phone". desktop-agent-spec.md and mobile-api.md: computers sync every 60 seconds / every minute.
10. **Windows agent build status.** desktop-agent-spec.md status: "not built yet"; section 10: updates "built 2026-10-24". desktop-agent-prompt.md disagrees with the spec on Firefox policy, UI toolkit and uninstall entry; the prompt itself says "the spec wins".
11. **Protection capabilities per platform.** child-app-spec.md section 3: Android App Restrictions and Content "Available"; iOS Downloads "Verify only". child-app-spec.md section 6 and mobile-api.md: Android App Restrictions and Content are "Set by you" (PARENT_SET); iOS Downloads applied by eGuard. Age-rating tiers: mobile-api.md "4, 9, 13, 16, 18"; child-app-spec.md "4, 9, 12, 13 or 17"; features/protection.md "4, 9, 12, 13, 16, 17, 18".
12. **What happens after a device is removed.** mobile-api.md and mobile-organizations.md: the app offers to set eGuard up again (reuse the install). child-app-spec.md: "You can now uninstall eGuard".
13. **Organizations in the apps.** organizations.md section 13: joining in the mobile apps is "Not in Phase 1". mobile-organizations.md: "The family side is built" in both apps.
14. **Launch checklist.** launch-visibility.md section 1: "Latest copy … not deployed yet" and email records "Needs attention". Same file's section 9 checklist ticks both as done.
15. **Price shown in a flow diagram.** subscriptions.md section 4 diagram: "Pay ₱199". Every price table: ₱149 or ₱249 a month.

## Instructions addressed to an AI (ignored, summarised only)

- desktop-agent-prompt.md: the whole file is a build prompt.
- child-app-prompts.md: the whole file is a set of build prompts.
- mobile-organizations-prompts.md: the whole file is a set of build prompts.
- code-signing.md: step 5 says "Claude can do this step".
- console.md: describes the system prompt of the console's "Write with AI" feature. This is a product fact, not an instruction.

## Sensitive content found (values not copied)

- code-signing.md: the company's D-U-N-S number in the "Business details" table.
- app-listing.md: the review demo account's email address and a note on where its password is kept (no password value). Seed account email.
- mobile-api.md, mobile-organizations.md, browser-extension-api.md: example personal names and a family surname that may belong to a real person; sample coordinates in Metro Manila and Leyte.
- desktop-agent-prompt.md, desktop-agent-spec.md, child-app-prompts.md: local folder paths under a personal Windows user folder.
- profile.md, app-listing.md, facebook-page.md: the company's street address (published on the site's legal pages per launch-visibility.md). The fact sheet uses the city only until the owner confirms.
- subscriptions.md: PayMongo's public test card numbers (published by PayMongo; not real cards). Left out anyway.
