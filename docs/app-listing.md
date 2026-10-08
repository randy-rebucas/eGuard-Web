# App store listing

Everything needed to publish eGuard on Google Play and the App Store: listing copy, graphics, the privacy and
data-safety forms, permission declarations, content rating, pricing, reviewer notes and a pre-submission checklist.

The native apps aren't built yet (see the README's "Not built yet"). This document is written against the parent
web app, the device API and the parent mobile API as they are today. Wherever the answer depends on how the native
apps end up being built (permissions, SDKs, the Android manifest), it says **Confirm against the build**.

## Contents

1. [App identity](#1-app-identity)
2. [One app, two modes](#2-one-app-two-modes)
3. [Google Play listing copy](#3-google-play-listing-copy)
4. [App Store listing copy](#4-app-store-listing-copy)
5. [Graphics and screenshots](#5-graphics-and-screenshots)
6. [Pricing and in-app purchases](#6-pricing-and-in-app-purchases)
7. [Google Play Data safety form](#7-google-play-data-safety-form)
8. [App Store privacy labels](#8-app-store-privacy-labels)
9. [Permissions and sensitive APIs](#9-permissions-and-sensitive-apis)
10. [Monitoring-app policies](#10-monitoring-app-policies)
11. [Content rating and audience](#11-content-rating-and-audience)
12. [Reviewer notes and demo account](#12-reviewer-notes-and-demo-account)
13. [URLs and contact details](#13-urls-and-contact-details)
14. [Blockers found while writing this](#14-blockers-found-while-writing-this)
15. [Pre-submission checklist](#15-pre-submission-checklist)

---

## 1. App identity

| Field | Google Play | App Store |
|---|---|---|
| App name | eGuard: Parental Controls | eGuard: Parental Controls |
| Package / bundle ID | `app.eguard.android` (already used in `GET /subscription`) | `app.eguard.ios` *(proposed; must match `APPLE_CLIENT_IDS`)* |
| Category | Parenting | Primary: Lifestyle · Secondary: Productivity |
| Tags (Play) | Parental control, Family, Screen time | n/a |
| Default language | English (United States) | English (U.S.) |
| Primary market | Philippines (prices are in ₱) | Philippines |
| Price | Free | Free |
| Contains ads | No | No |
| In-app purchases | None for now (section 6) | None for now (section 6) |

The name has to fit both stores' 30-character limit. "eGuard: Parental Controls" is 25 characters.

---

## 2. One app, two modes

A single app is installed on both phones. On first launch it asks who is using it:

- **Parent mode**: sign in or create an account, add children, choose protections, pair devices, read alerts,
  screen time, apps and location. It uses the parent mobile API (`/api/mobile/v1`).
- **Child device mode** ("I'm setting up my child's device"): enter the 8-character pairing code, grant the
  permissions the protections need, then sync settings and report the configuration the device actually has. It
  uses the device API (`/api/device/v1`).

The listing, screenshots and privacy forms have to cover both modes, because the stores review one binary. Almost
all sensitive permissions (section 9) come from child device mode.

---

## 3. Google Play listing copy

### Title (30 max)

```
eGuard: Parental Controls
```

### Short description (80 max)

```
Set screen time, bedtime and app rules for your child, and know they're working.
```

### Full description (4,000 max)

```
eGuard helps parents set up digital safety protections on their children's phones and tablets, then shows whether each one is actually working.

Most parental control apps tell you a setting was saved. eGuard waits until your child's device confirms it. If a setting fails, is turned off, or a device stops checking in, you'll know.

SET UP PROTECTION IN MINUTES
• Add your child, pick a profile (Protected, Balanced or Custom), and eGuard suggests settings for their age
• Pair your child's device with a one-time code
• eGuard applies each setting and checks it on the device

PROTECTIONS YOU CAN MANAGE
• Screen time: daily limits, with a separate weekend limit
• Bedtime: pause the device overnight, every day or on school nights
• Apps: age-rating limits, per-app daily limits and blocking
• App approval: your child asks, you approve or decline
• Content: age ratings for movies, TV and books
• Web filtering: block adult sites or allow only the sites you choose
• Downloads: require your approval to install apps
• Location: see where your child's device is now
• Notifications: keep the device quiet during bedtime
• Uninstall protection: stop eGuard from being removed without you

CONFIGURATION HEALTH
One score shows how well each child's devices are protected. It has 10 checks, one per protection, and every check is based on what the device reports. It measures settings, never your child's behavior.

ALERTS WHEN SOMETHING CHANGES
eGuard tells you when a protection is turned off, a device goes offline, your child reaches a limit, a new app is installed, or an app is waiting for your approval. Each alert takes you to the fix.

SCREEN TIME AND APP REPORTS
See today's screen time against the limit, a 7-day trend, an hour-by-hour chart and the most-used apps.

BUILT FOR THE WHOLE FAMILY
• Add a second parent to share the work
• Works with Android phones and tablets, iPhone and iPad
• Also available on the web at www.eguard.family

PRIVACY FIRST
• eGuard never reads messages, browsing content or photos on your child's device
• By default only the current location is kept, not a trail. Location history is off unless you turn it on
• Activity is deleted automatically after 90 days
• Export or delete your family's data at any time

PLANS
eGuard is free for 1 child and 2 devices. eGuard Plus and Family Pro add more children and devices, location sharing, full app monitoring and advanced reports.

eGuard is a parental control app. Your child's device shows that eGuard is active, with a notification whenever it's running.
```

About 2,600 characters. Before publishing:

- The web address is the production domain, `www.eguard.family` (`APP_URL`).
- Keep the **PLANS** paragraph as long as nothing is sold in the app. It describes plans without a price or a link,
  which Play's payments policy allows. Don't add "subscribe at our website" (section 6).
- The last paragraph is there for the monitoring-app policy (section 10). Keep it only if the build shows a
  persistent notification on the child's device.

### Release notes (500 max), first release

```
Welcome to eGuard. Set up screen time, bedtime, app, web and location protections for your children, and see each one verified on their devices.
```

---

## 4. App Store listing copy

### Name (30 max)

```
eGuard: Parental Controls
```

### Subtitle (30 max)

```
Screen time you can verify
```

### Promotional text (170 max, editable without review)

```
Set screen time, bedtime and app rules on your child's iPhone or iPad, and see each one confirmed on the device, not just saved.
```

### Description (4,000 max)

Use the Google Play full description with these changes:

- In **PROTECTIONS YOU CAN MANAGE**, drop "Notifications", which iOS doesn't support. Change Web filtering, Location
  and Downloads to say they use guided setup:
  `• Web filtering, location and downloads: eGuard walks you through Apple's Screen Time settings step by step, then confirms them`
- In the last paragraph, replace "Your child's device shows that eGuard is active…" with
  `eGuard uses Apple's Screen Time and Family Sharing. Your child's device must be part of your Family Sharing group.`
- Leave out the **PLANS** paragraph unless StoreKit purchases are built (section 6).

### Keywords (100 max, comma-separated, no spaces)

```
parental,control,screen,time,kids,family,child,safety,limit,bedtime,app,blocker,location,monitor
```

96 characters. The name and subtitle are indexed already, so these words aren't repeated there.

### What's New, first release

Same as the Play release notes.

---

## 5. Graphics and screenshots

### Required assets

| Asset | Google Play | App Store |
|---|---|---|
| App icon | 512 × 512 PNG, 32-bit, ≤ 1 MB | 1024 × 1024 PNG, no transparency (comes from the build) |
| Feature graphic | 1024 × 500 JPG or 24-bit PNG | n/a |
| Phone screenshots | 2 to 8, 9:16, 1080 × 1920 recommended | 6.9" display: 1320 × 2868, 3 to 10 |
| Tablet screenshots | 7" and 10", 4 or more to qualify for tablet placement | 13" iPad: 2064 × 2752, required if the app runs on iPad |
| Preview video | Optional YouTube link | Optional, 15 to 30 s |

Brand source files are in [public/brand](../public/brand). The existing `public/ios.png` shows the parent app's
screens.

### Screenshot set (same order in both stores)

| # | Screen | Caption |
|---|---|---|
| 1 | Dashboard with Family Protection score | See every child's protection at a glance |
| 2 | Configuration Health ring and 10 checks | Know each setting is really on |
| 3 | Setup progress, devices confirming | Settings confirmed by the device, not just saved |
| 4 | Screen time: today vs limit, hourly chart | Screen time limits that fit your family |
| 5 | Apps: pending approval | Approve new apps before they're used |
| 6 | Bedtime and protection controls | Bedtime, web filtering and more |
| 7 | Alerts list | Get told when something changes |
| 8 | Location map (Plus) | See where your child's device is |

Rules for the images:

- Use the seeded demo family's names (Mia, Lucas, Sophie) or other made-up names. Never a real child's photo or a
  real address. Move the location pin to a public landmark.
- Don't show prices or a buy button in store screenshots while the apps don't sell plans.
- Screenshot 8 shows a Plus feature. Label it "eGuard Plus" in the frame so the listing doesn't suggest it's free.

### Feature graphic (Play)

The logo and "Screen time you can verify" on the brand gradient, with the Configuration Health ring on the right.
Keep text inside the middle 924 × 400 area, because Play crops the edges on some surfaces.

---

## 6. Pricing and in-app purchases

Right now plans are sold on the web only, through PayMongo, and the apps show the plan without selling it (see
[subscriptions.md › 1](subscriptions.md#1-overview)). What that means in each store:

**Google Play.** List the app as free with no in-app products. Don't link to the website's subscription page or
say where to buy, because Play's payments policy doesn't allow steering users to outside payment for digital
features. When Play Billing is turned on (`GOOGLE_PLAY_*`), create these subscriptions in Play Console:

| Product ID | Plan | Base plan | Price |
|---|---|---|---|
| `eguard_plus` | eGuard Plus | monthly, auto-renewing | ₱149 |
| `eguard_pro` | Family Pro | monthly, auto-renewing | ₱249 |

`eguard_family` is a legacy product. Keep it active so existing subscribers keep their plan, but don't offer it.

**App Store.** Apple's guideline 3.1.3(b) (multiplatform services) lets people use a subscription bought
elsewhere only if the same subscription can also be bought in the app. An iOS app that unlocks Plus or Pro
features for web subscribers, with no StoreKit purchase, is likely to be rejected. Choose one before submitting:

1. **Build StoreKit subscriptions** for Plus and Pro. This is the lowest-risk option.
2. **Ship iOS with Free features only.** Paid features stay hidden on iOS even for paying families. This avoids
   the rule but costs paying users features.

Either way, the iOS app must not mention web prices or link to the web checkout.

---

## 7. Google Play Data safety form

Answers are based on what the server stores (`prisma/schema.prisma`, the "What data eGuard keeps" help article).
**Confirm against the build** that the apps add no analytics, crash-reporting or ads SDKs. If they do, those SDKs'
data has to be added here.

### General questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | Yes |
| Is all user data encrypted in transit? | Yes (HTTPS only) |
| Do you provide a way for users to request that their data is deleted? | Yes: in the app (Settings › Delete account, `DELETE /me`) and on the web |
| Delete-account URL | `https://www.eguard.family/delete-account` (public, no sign-in needed) |

### Data collected

Nothing is **shared** with third parties in the Play sense. PayMongo handles web payments, but that happens on the
website, not in the app, and service providers acting for eGuard don't count as sharing.

| Data type | Collected | Required or optional | Purposes | Notes |
|---|---|---|---|---|
| Name | Yes | Required | Account management, App functionality | Parent's name; child's first name |
| Email address | Yes | Required | Account management, Developer communications | Parent only |
| User IDs | Yes | Required | Account management | Apple/Google sign-in subject ID |
| Approximate location | Yes | Optional | App functionality | Child device, when Location is on (Plus and up) |
| Precise location | Yes | Optional | App functionality | Same as above. Current fix only, unless the family turns on history |
| Photos | Yes | Optional | App functionality | Child profile photo, uploaded by the parent |
| Installed apps | Yes | Required in child device mode | App functionality | App names, for approvals and limits |
| App interactions | Yes | Required in child device mode | App functionality, Analytics | Daily and hourly screen-time totals, per-app minutes |
| Other user-generated content | Yes | Optional | App functionality | Support ticket messages |
| Purchase history | Yes | Optional | App functionality | Plan and renewal, if the family pays |
| Device or other IDs | Yes | Required in child device mode | App functionality | Device token issued at pairing, model, OS version |
| Crash logs, diagnostics | **Confirm against the build** | | | |

Data is processed ephemerally: **No** for all of the above, because it's stored.

Not collected: messages, contacts, browsing history, web content, photos or files on the child's device, audio,
calendar, health or financial information. Payment details go straight to PayMongo on the web and never reach
eGuard.

"Share anonymous product analytics" is off by default and says it never includes children's data. If it ever turns
into an analytics SDK, list it here.

---

## 8. App Store privacy labels

In App Store Connect › App Privacy. Tracking: **No**, because eGuard doesn't link data with other companies' data
for advertising and has no ads.

| Apple data type | Linked to the user | Used for tracking | Purpose |
|---|---|---|---|
| Contact Info › Name | Yes | No | App Functionality |
| Contact Info › Email Address | Yes | No | App Functionality |
| Location › Precise Location | Yes | No | App Functionality |
| Location › Coarse Location | Yes | No | App Functionality |
| User Content › Photos or Videos | Yes | No | App Functionality |
| User Content › Customer Support | Yes | No | App Functionality |
| Identifiers › User ID | Yes | No | App Functionality |
| Identifiers › Device ID | Yes | No | App Functionality |
| Usage Data › Product Interaction | Yes | No | App Functionality |
| Purchases › Purchase History | Yes | No | App Functionality *(only if StoreKit is built)* |
| Diagnostics | **Confirm against the build** | | |

On iOS, installed apps and screen time come through the Screen Time API, which gives app tokens and totals
rather than a readable app list. Record that under Usage Data › Product Interaction. Don't list a separate
"installed apps" category.

---

## 9. Permissions and sensitive APIs

**Confirm against the build.** The tables list what each protection is expected to need. Play and Apple both
reject permissions the app requests but doesn't use.

### Android

| Permission or API | Protection | Declaration needed |
|---|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE` | Sync, report | No |
| `PACKAGE_USAGE_STATS` (Usage access) | Screen time, per-app limits | Usage access is granted in Settings; justify it in the listing and onboarding |
| `QUERY_ALL_PACKAGES` | Installed apps, app approval | **Yes**: Play Console › Permissions declaration, core purpose "parental control" |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | Location | Yes if background: see the next row |
| `ACCESS_BACKGROUND_LOCATION` | Location while the app is closed | **Yes**: location permissions declaration and a video of the in-app disclosure |
| `FOREGROUND_SERVICE` (+ type) | Keeping sync alive, the persistent notification | Foreground service type declaration on Android 14+ |
| `POST_NOTIFICATIONS` | Parent alerts, the "eGuard is active" notice | No |
| `RECEIVE_BOOT_COMPLETED` | Restart sync after reboot | No |
| Device administrator (`BIND_DEVICE_ADMIN`) | Uninstall protection | Explain it in the listing; the child sees a system prompt |
| `VpnService` | Web filtering | **Yes**: VpnService declaration. Filtering must happen on the device and not route traffic to eGuard servers |
| AccessibilityService | Only if used for app blocking or web filtering | **Yes**: accessibility declaration and a prominent in-app disclosure. Avoid if Usage access and VPN are enough |
| `CAMERA` / photo picker | Child photo in parent mode | Use the Android photo picker so no media permission is needed |

Decided 2026-10-08: the Android app applies protections with these on-device APIs, not Google Family Link
(child-app-spec D1). The help article `android-family-link` now says Family Link isn't needed.

Every sensitive permission needs an **in-app disclosure before the system prompt**: what's collected, why, and
that it's for parental control. Background location, accessibility and VPN reviewers look for it.

### iOS

| Capability or key | Protection | Notes |
|---|---|---|
| Family Controls entitlement (`com.apple.developer.family-controls`) | Screen time, bedtime, apps, content | **Request the distribution entitlement from Apple.** Development works without it; App Store builds don't. Ask early, since approval can take weeks |
| `DeviceActivity`, `ManagedSettings` extensions | Screen time reports, shields | Each extension needs the entitlement too |
| `NSLocationWhenInUseUsageDescription` | Location | "eGuard shares this device's location with your parent so they can see where you are." |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | Location in the background | Same text, plus "even when eGuard is closed." |
| `NSPhotoLibraryUsageDescription` | Child photo | Or use `PHPickerViewController`, which needs no key |
| Push notifications | Parent alerts | APNs isn't wired up yet (README) |
| Sign in with Apple | Parent sign-in | Required by guideline 4.8 because Google sign-in is offered |

---

## 10. Monitoring-app policies

Both stores accept parental control apps but watch them closely for stalkerware.

**Google Play (Stalkerware and Device and Network Abuse policies)**

- Declare the app as a monitoring tool with the `IsMonitoringTool` manifest flag, value `parental_control`. Check
  Google's current Stalkerware policy page for the exact syntax when building the manifest.
- The child's device must show a **persistent notification** while eGuard is active, and a unique icon.
- The app must not hide its icon or pretend to be something else.
- Don't describe eGuard as spying, secret or hidden in the listing, the screenshots or the app.
- Only parents or guardians may install it, and the listing has to say so. The full description's last paragraph
  covers this.

**App Store**

- Guideline 5.1.1(iv) and 5.4: use Apple's Screen Time and Family Controls APIs, not MDM profiles or a VPN, to
  control a child's device.
- Guideline 5.1.2: data collected from children may be used only to provide the parental control service. No
  analytics or ads SDKs in child device mode.
- The child's device has to be in the parent's Family Sharing group. Say so in onboarding.

---

## 11. Content rating and audience

### Google Play: target audience and content

| Question | Answer |
|---|---|
| Target age groups | **18 and over** only. The user is the parent, even in child device mode. Don't pick under-13 age groups, which would bring the app under the Families policy |
| Could the app unintentionally appeal to children? | No |
| Ads | No ads |
| News app | No |
| Government app | No |
| Financial features | None |
| Health app | No |

### IARC questionnaire (Play) and Age Rating (App Store)

- Category: Utility, Productivity, Communication or Other (not a game).
- Violence, fear, sexuality, gambling, language, controlled substances, crude humor: **None**.
- Users can interact or exchange content with each other: **No**. Parents in a family see the same data, but
  there's no messaging or public content.
- Shares the user's current physical location with other users: **Yes**. The child device shares location with
  the family's parents.
- Digital purchases: **No** until in-app billing is turned on.
- Unrestricted web access (Apple): **No**.

Expected result: IARC 3+ / Everyone with the "Shares Location" notice. App Store: 4+.

App Store's "Made for Kids" category: **don't select it**. The customer is the parent.

---

## 12. Reviewer notes and demo account

Both stores need working credentials. Don't use the seed accounts (`randy@example.com`), and never run
`npm run db:seed` against production: it deletes every family.

**Demo account (created).** `review@eguard.family` exists in the production database: Family Pro, with Mia, Lucas
and Sophie, 5 devices, two weeks of screen time, alerts and history. Its alert emails are off. The password was
printed once when it was created; keep it in your password manager. To refresh the data (the demo devices show as
offline after about a day, because they don't sync) or reset the password, run:

```
DATABASE_URL=<production url> npm run seed:demo            # dry run
DATABASE_URL=<production url> npm run seed:demo -- --apply # replace the demo family (new password unless DEMO_PASSWORD is set)
```

The script only ever touches the "eGuard Demo Family" and refuses if the email belongs to anything else. For the
richest review, also pair real test devices as below:

1. Create `review@eguard.family` in production with a strong password, and verify its email.
2. Give the family **Family Pro** so reviewers can see every feature, location included.
3. Add one child ("Mia", 11, Protected profile) and pair a test Android phone and a test iPhone, so health, alerts,
   screen time and location have real data.
4. Leave one app waiting for approval and one open alert, so those screens aren't empty.
5. Keep the test devices charged and online during review, or reviewers will see "Offline".

### Notes for the reviewer (paste into both stores)

```
eGuard is a parental control app. The same app runs in two modes, chosen on first launch.

PARENT MODE (use this to review)
Sign in with the demo account below. The family already has a child (Mia) with paired Android and iOS devices, so every screen has data: Dashboard, Configuration Health, Protection & Controls, Screen Time, Apps, Location, Alerts and Settings.

CHILD DEVICE MODE
To try pairing, open the app on a second device, choose "I'm setting up my child's device", and enter a pairing code from Parent mode › Mia › Add device. Codes last 15 minutes.

WHY WE ASK FOR SENSITIVE PERMISSIONS
Permissions are requested only in child device mode, after a screen that explains each one:
- Usage access / Screen Time: to enforce screen time limits and show daily totals to the parent
- Location: to show the child's current location to the parent, if the parent turns Location on
- [Confirm against the build: device admin, VPN, accessibility]
eGuard never reads messages, browsing content or files. A persistent notification on the child's device shows eGuard is active.

PURCHASES
The app has no purchases. Plans are managed on our website. The demo family is on Family Pro so every feature can be reviewed.

Demo account: review@eguard.family / {password}
Contact: support@devcomdigital.com, {phone}
```

Adjust **PURCHASES** if StoreKit or Play Billing ships (section 6). Play asks for the same credentials under
App content › App access.

---

## 13. URLs and contact details

| Field | Value | Status |
|---|---|---|
| Privacy policy URL | `https://www.eguard.family/privacy` | Live |
| Terms of use URL | `https://www.eguard.family/terms` | Live |
| Support URL | `https://www.eguard.family/help` | Live: the public Help Center, same articles as `GET /help` |
| Marketing URL (App Store, optional) | `https://www.eguard.family` | Landing page exists |
| Delete-account URL (Play) | `https://www.eguard.family/delete-account` | Live: steps for the web and app, an email request for people who can't sign in, what's deleted and kept |
| Support email | `support@devcomdigital.com` (`SUPPORT_EMAIL`) | Set in production env |
| Developer name, address, phone | DevCom Digital Marketing Services, Brgy. Hipusngo, Baybay City, Leyte 6521, Philippines | Must match the store accounts. Organization accounts must be verified (D-U-N-S for Apple) |

The privacy policy at `/privacy` covers all of this: the data in section 7; that data is collected from children's
devices on the parent's instruction; the 90-day retention; location history being opt-in; PayMongo as the payment
processor; how to export and delete data; and DevCom's Data Protection Officer as the contact for privacy requests
(RA 10173). If section 7 changes when the apps are built, update the policy's "What we collect" table to match.

---

## 14. Blockers found while writing this

| # | Problem | Where | Fix |
|---|---|---|---|
| 1 | ~~No privacy policy or terms pages~~ | `src/app/(site)` | **Fixed.** `/privacy` and `/terms` are live and linked from the footer |
| 2 | The Plans help article says where to upgrade, which the apps can't (section 6) | [src/lib/help.ts](../src/lib/help.ts), `upgrade-plan` | **Partly fixed.** The Google Play mention is gone. It now says to upgrade "on the web", which is fine on the website but not in the apps: give the apps a version that only names the plans |
| 3 | iOS paid features without StoreKit likely break guideline 3.1.3(b) | Section 6 | Decide on StoreKit, or Free-only on iOS |
| 4 | Family Controls distribution entitlement not requested | Apple Developer account | Request it now |
| 5 | ~~The landing page says "Join thousands of parents who trust eGuard" and "Trusted by modern families"~~ | [src/app/page.tsx](../src/app/page.tsx) | **Fixed.** Removed from the site and the sign-in panel. Keep claims like this out of store copy too |
| 6 | Push notifications aren't wired up | README, `realtimeAlerts` | **Copy fixed:** Plus now lists "Push alerts (coming soon)". Wire up FCM/APNs before the apps launch, or describe alerts as in-app and email in the listing |

---

## 15. Pre-submission checklist

**Both stores**

- [x] Privacy policy and terms pages live at public URLs (blocker 1)
- [ ] Help copy fixed (blocker 2) *(Google Play mention removed; the apps still need a version without "on the web")*
- [ ] Production demo account set up as in section 12, with test devices online
- [ ] Screenshots made from the demo family, no real names, photos or addresses
- [ ] Every permission in section 9 confirmed against the build; unused ones removed
- [ ] In-app disclosure screen before each sensitive permission prompt
- [ ] No SDKs that collect data beyond sections 7 and 8, or the forms updated to match
- [ ] Account deletion works in the app and deletes server data (`DELETE /me`)
- [ ] `GET /app-info` minimum app version set for the release

**Google Play**

- [ ] `IsMonitoringTool` flag in the manifest; persistent notification on the child's device
- [ ] Permissions declarations: `QUERY_ALL_PACKAGES`, background location (with video), VPN and accessibility if used
- [ ] Foreground service type declared (Android 14+)
- [ ] Data safety form (section 7)
- [ ] Target audience 18+, content rating questionnaire (section 11)
- [ ] App access: demo credentials and reviewer notes
- [ ] Closed test with at least 12 testers for 14 days, if the developer account is a new personal account
- [ ] Feature graphic, icon, phone and tablet screenshots

**App Store**

- [ ] Family Controls distribution entitlement granted (blocker 4)
- [ ] StoreKit decision made and built, or paid features hidden on iOS (blocker 3)
- [ ] Sign in with Apple works; `APPLE_CLIENT_IDS` includes the bundle ID
- [ ] Location and photo usage strings (section 9)
- [ ] App Privacy labels (section 8)
- [ ] Age rating 4+, not Made for Kids
- [ ] 6.9" iPhone and 13" iPad screenshots
- [ ] Review notes with demo account (section 12)
