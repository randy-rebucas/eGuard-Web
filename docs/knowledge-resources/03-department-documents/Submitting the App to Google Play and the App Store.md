# Submitting the App to Google Play and the App Store

## Summary

The app store submission procedure describes how eGuard for Android and eGuard for iPhone and iPad (one mobile app, the eGuard app) are prepared and submitted for review on Google Play and the Apple App Store. The app runs in two modes, parent mode and child device mode, so the listing, screenshots and privacy forms must cover both. The app is listed as free, with no ads and no in-app purchases: plans are sold only on the web, and neither store listing may point to the website's checkout. Many answers (permissions, SDKs, diagnostics) depend on the final build and are marked to be confirmed against it. The procedure is for the engineering team and the owner; it is thin because the source was written before the native apps were built.

## Purpose of the app store submission procedure

The purpose of the app store submission procedure is to get eGuard for Android and eGuard for iPhone and iPad approved on the first review, without breaking the stores' payment, privacy and monitoring-app policies. Parental control apps are reviewed closely for stalkerware, so the listing must be honest about what the app does and must never describe it as hidden or secret.

## When the app store submission procedure applies

The app store submission procedure applies to the first submission of each app and to any later release that changes the listing, permissions, data collected or purchase options. It does not apply to the parent web dashboard or the eGuard browser extension. [TO CONFIRM: whether routine app updates with no listing or permission change follow a shorter path]

## Roles involved in an app store submission

| Role | Responsibility |
|---|---|
| Engineering | Confirms permissions, SDKs and the manifest against the build; fills the data-safety and privacy forms; uploads builds; sets the minimum app version. [TO CONFIRM: which role or person] |
| Owner | Decides the iOS purchase option (StoreKit or Free-only on iOS) and approves the listing. [TO CONFIRM: who approves] |
| Store account holder | Holds the Google Play Console and Apple Developer accounts; keeps developer name, address and phone matching DevCom Digital Marketing Services' verified details. [TO CONFIRM: who holds the accounts] |

## Inputs needed before an app store submission

| Input | Detail |
|---|---|
| App identity | App name "eGuard: Parental Controls" (25 characters, under both stores' 30-character limit). Google Play category Parenting; App Store primary category Lifestyle, secondary Productivity. Default language English (United States). Primary market: the Philippines |
| Package and bundle ID | Google Play package name [TO CONFIRM: Google Play package name] (see Open questions). App Store bundle ID `app.eguard.ios` (proposed; must match `APPLE_CLIENT_IDS`) |
| Listing copy | Title, short description, full description, release notes; App Store subtitle, promotional text, description and keywords, as drafted in app-listing.md §3–4 |
| Graphics | Icons, Play feature graphic, phone and tablet screenshots made from the demo family only (see "Preparing app store screenshots and graphics") |
| Review demo account | A demo account exists; credentials are kept in the password manager. See "Refreshing the Store-Review Demo Account" |
| Public URLs | Privacy policy `https://www.eguard.family/privacy`, terms `https://www.eguard.family/terms`, support `https://www.eguard.family/help`, delete-account `https://www.eguard.family/delete-account`, marketing `https://www.eguard.family` |
| Contact details | Support email support@devcomdigital.com; developer name DevCom Digital Marketing Services; address in Baybay City, Leyte, Philippines [TO CONFIRM: full registered address as on the store accounts]; phone [TO CONFIRM: support phone number]. Apple organization accounts need D-U-N-S verification |

## Procedure: preparing Google Play and the App Store

1. Engineering confirms every permission against the build and removes any the app does not use; both stores reject unused permissions. [TO CONFIRM: final permission list from the build]
2. Engineering confirms that the build contains no analytics, crash-reporting or ads SDKs. If it does, then the data-safety form and privacy labels must list those SDKs' data. [TO CONFIRM: SDKs in the build]
3. Engineering checks that an in-app disclosure screen appears before each sensitive permission prompt, saying what is collected, why, and that it is for parental control.
4. Engineering checks that account deletion works in the app and deletes server data (`DELETE /me`).
5. Engineering sets the minimum app version for the release (`GET /app-info`).
6. Engineering makes sure the help copy the apps show does not say where to upgrade. The Plans help article still says to upgrade "on the web", which is fine on the website but not in the apps; the apps need a version that only names the plans.
7. Engineering refreshes the review demo family and, for the richest review, keeps real test devices paired and online (see "Refreshing the Store-Review Demo Account").
8. Engineering prepares the reviewer notes (see "Writing the app store reviewer notes").

## Procedure: submitting to Google Play

1. Engineering adds the `IsMonitoringTool` manifest flag with value `parental_control`, checking Google's current Stalkerware policy page for the exact syntax.
2. Engineering confirms the child's device shows a persistent notification while eGuard is active, and that the app never hides its icon. If the build has no persistent notification, then remove the last paragraph of the full description, which promises one.
3. Engineering files the Play Console permission declarations: `QUERY_ALL_PACKAGES` (core purpose "parental control"), background location (with a video of the in-app disclosure), the VpnService declaration and the accessibility declaration if those are used, and the foreground service type on Android 14 and later. [TO CONFIRM: whether device admin, VPN and accessibility are used in the build]
4. Engineering completes the Data safety form from app-listing.md §7: data encrypted in transit; nothing shared with third parties; deletion available in the app and on the web. [TO CONFIRM: crash logs and diagnostics]
5. Engineering sets the target audience to 18 and over only (never an under-13 group, which would bring the app under the Families policy), answers the IARC questionnaire (no violence, sexuality, gambling or similar; shares location with other users: yes; digital purchases: no) and expects IARC 3+ / Everyone with a "Shares Location" notice.
6. Engineering lists the app as free with no in-app products, and keeps the **PLANS** paragraph without a price or a link.
7. Engineering enters the demo credentials and reviewer notes under App content › App access.
8. If the developer account is a new personal account, then engineering runs a closed test with at least 12 testers for 14 days before production. [TO CONFIRM: account type]
9. Engineering uploads the feature graphic, icon, and phone and tablet screenshots, then submits.

## Procedure: submitting to the App Store

1. The store account holder requests the Family Controls distribution entitlement from Apple early; development builds work without it, App Store builds do not, and approval can take weeks. If the entitlement is not granted, then the app cannot be submitted.
2. The owner decides the iOS purchase option before submission: build StoreKit subscriptions for eGuard Plus and eGuard Family (the lower-risk option), or ship iOS with Free features only. An iOS app that unlocks paid features for web subscribers without a StoreKit purchase is likely to be rejected under guideline 3.1.3(b). [TO CONFIRM: decision]
3. Engineering confirms Sign in with Apple works (guideline 4.8, because Google sign-in is offered) and that `APPLE_CLIENT_IDS` includes the bundle ID.
4. Engineering adds the location and photo usage strings from app-listing.md §9.
5. Engineering fills App Privacy: tracking "No"; data types as in app-listing.md §8; installed apps and screen time recorded under Usage Data › Product Interaction. [TO CONFIRM: diagnostics]
6. Engineering sets the age rating to 4+ and does not select "Made for Kids".
7. Engineering adapts the description: drop "Notifications" (iOS does not support it), describe web filtering, location and downloads as guided setup, replace the last paragraph with the Family Sharing sentence, and leave out the **PLANS** paragraph unless StoreKit is built.
8. Engineering uploads 6.9-inch iPhone and 13-inch iPad screenshots, adds the reviewer notes and demo account, and submits.

## Preparing app store screenshots and graphics

The eGuard store screenshot rules are:

- Use the demo family's made-up names only; never a real child's photo or a real address. Move any location pin to a public landmark.
- Do not show prices or a buy button while the apps do not sell plans.
- Label the location screenshot "eGuard Plus", because it shows a paid feature.
- Use the same eight-screen order in both stores (dashboard, Configuration Health, setup progress, screen time, app approval, bedtime and controls, alerts, location).
- Play feature graphic: 1024 × 500 pixels, with text inside the middle 924 × 400 pixel area.

Asset sizes are listed in app-listing.md §5.

## Writing the app store reviewer notes

The reviewer notes for both stores explain that one app runs in two modes; that reviewers should use parent mode with the demo account; how to try child device mode with a pairing code (codes last 15 minutes); why each sensitive permission is requested, only in child device mode and after an explanation screen; that eGuard never reads messages, browsing content or files; and that the app has no purchases. The notes give the demo account (credentials from the password manager, never written into this document) and support@devcomdigital.com as the contact. [TO CONFIRM: device admin, VPN and accessibility lines in the notes] Adjust the purchases paragraph if StoreKit or Play Billing ships.

## Approvals required for an app store submission

| What | Who approves | Limit |
|---|---|---|
| Listing copy and screenshots | [TO CONFIRM: approver] | No user counts, ratings or "trusted by" claims; screenshot limits as in "Preparing app store screenshots and graphics" |
| iOS purchase option (StoreKit or Free-only) | [TO CONFIRM: approver, presumably the owner] | Must be decided before App Store submission |
| Turning on Google Play Billing | [TO CONFIRM: approver] | Billing is off; product IDs and prices are in "Products and Services Catalogue" |

## Exceptions in an app store submission and what to do

| Situation | What to do |
|---|---|
| Push notifications not wired up | Wire up FCM and APNs before the apps launch, or describe alerts as in-app and email in the listing |
| Play Billing turned on later | Create subscriptions `eguard_plus` (eGuard Plus) and `eguard_pro` (eGuard Family), each monthly and yearly; keep the legacy `eguard_family` product active but not offered |
| A store rejects the app | [TO CONFIRM: who handles rejections and appeals] |

## Outputs of an app store submission and where they are recorded

| Output | Where it is recorded |
|---|---|
| Submitted listing, forms and declarations | Google Play Console; App Store Connect |
| Minimum app version | `GET /app-info` setting |
| Submission record and review outcome | [TO CONFIRM: where releases are logged] |

## Time targets for an app store submission

| Step | Target |
|---|---|
| Family Controls distribution entitlement | Request early; approval can take weeks |
| Google Play closed test (new personal account only) | At least 12 testers for 14 days |
| Review demo devices | Keep charged and online during review |
| Store review time | [TO CONFIRM] |

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Refreshing the Store-Review Demo Account; Products and Services Catalogue; Data Handling and Confidentiality; Production Go-Live Checks; Systems Overview |

## Open questions

1. Owner role, effective date and review date of this procedure are not stated in the sources.
2. Who deploys and submits builds, who holds the store accounts, who approves the listing, who decides the iOS purchase option, who approves turning on Play Billing, and who handles rejections.
3. Google Play package name: app-listing.md and mobile-api.md give `app.eguard.android`; facebook-page.md links to `com.devcom.eguard` (source inventory contradiction 3).
4. Are the native apps built and is the Android app live? app-listing.md says "The native apps aren't built yet"; faq.md and profile.md say Android works now "through the eGuard app on Google Play" (source inventory contradiction 4). This procedure is drafted from app-listing.md, which was written before the apps were built.
5. Push alerts: app-listing.md blocker 6 says "Push notifications aren't wired up" and launch-visibility.md lists "Push alerts (coming soon)"; faq.md says Plus and eGuard Family "also get push alerts in the eGuard parent app" (source inventory contradiction 5). The listing's alert wording depends on the answer.
6. iPhone in the Play description: app-listing.md's Google Play full description says "Works with Android phones and tablets, iPhone and iPad"; every other source calls iPhone and iPad "coming soon" (source inventory contradiction 6). The line should probably be removed until the iPhone app ships.
7. Items marked "Confirm against the build" in app-listing.md: final permissions (including device admin, VPN and accessibility), analytics, crash-reporting or ads SDKs, crash logs and diagnostics in both privacy forms, and whether the child's device shows a persistent notification.
8. Developer address, phone number and account type (new personal account or verified organization account) for the stores.
9. Help copy blocker 2 is only partly fixed: the apps still need a Plans help article without "on the web".
10. Where submissions and review outcomes are recorded, and typical review times.
11. The full registered company address and the D-U-N-S number were left out of this document on purpose; they are kept with the store accounts.
