/** Help & Support content for the apps. Static for now; a CMS can replace `HELP_ARTICLES` later. */
import { FREE_APP_LIMIT, childCount, planById, webPrice, type PaidPlanId } from "./plans";

const free = planById("FREE").entitlements;
/** What Free covers: every protection and its status, checked when you look; paid plans add alerts on drift */
const FREE_LINE = `Free covers ${childCount(free.childLimit, { digits: true })} and ${free.deviceLimit} ${free.deviceLimit === 1 ? "device" : "devices"} with the setup wizard, all 10 protections, basic Configuration Health you can check any time, screen time and per-app limits, ${FREE_APP_LIMIT} apps per child, alerts if eGuard is removed or tampered with, and email support.`;
/** What both paid plans add over Free */
const PAID_ADDS = "alerts when a setting changes on the device, push for every alert, location sharing, full app monitoring, category limits like gaming time";

/** Price and limits from the plan catalogue, since prices can change without a release (PRICE_*_MONTHLY). */
function planLine(id: PaidPlanId) {
  const c = webPrice(id), e = planById(id).entitlements;
  return `${planById(id).name} (₱${c % 100 ? (c / 100).toFixed(2) : c / 100} a month) covers up to ${e.childLimit} children and ${e.deviceLimit} devices`;
}

/** planLine without the price, for the iPhone app */
function planLimits(id: PaidPlanId) {
  const e = planById(id).entitlements;
  return `${planById(id).name} covers up to ${e.childLimit} children and ${e.deviceLimit} devices`;
}

export type HelpCategory = "SETUP" | "TROUBLESHOOTING" | "PRIVACY" | "FAQ";

export const HELP_CATEGORIES: { id: HelpCategory; name: string; description: string; icon: string }[] = [
  { id: "SETUP", name: "Setup Guides", description: "Step-by-step instructions", icon: "book-open" },
  { id: "TROUBLESHOOTING", name: "Troubleshooting", description: "Common solutions", icon: "wrench" },
  { id: "PRIVACY", name: "Privacy & Security", description: "How we protect your data", icon: "lock" },
  { id: "FAQ", name: "FAQs", description: "Frequently asked questions", icon: "circle-help" },
];

/**
 * `iosApp`: the summary and body the iPhone app gets instead, for an article that prices plans or says where to buy
 * them. Apps on the App Store may not point to buying outside the app (guideline 3.1.1).
 */
export type HelpArticle = { slug: string; category: HelpCategory; title: string; summary: string; body: string[]; iosApp?: { summary: string; body: string[] } };

/** YYYY-MM-DD: when the articles were last revised (JSON-LD dateModified and the sitemap). Bump it with the content. */
export const HELP_UPDATED = "2026-11-19";

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "pair-a-device", category: "SETUP", title: "Add your child's device",
    summary: "Pair your child's phone or tablet with a one-time 8-character code from your eGuard app. The code works for 15 minutes.",
    body: [
      "Open your child's profile and tap Add device. eGuard shows an 8-character code that works for 15 minutes.",
      "Install eGuard on your child's device, choose This is my child's device, and enter the code.",
      "eGuard checks every protection on the new device right away, so Configuration Health is accurate from the start.",
    ],
  },
  {
    slug: "ios-family-sharing", category: "SETUP", title: "Set up supervision on iPhone and iPad",
    summary: "Use Family Sharing so eGuard can apply Screen Time settings on your child's iPhone or iPad, with guided steps for the rest.",
    body: [
      "On your iPhone, open Settings, tap your name, then Family Sharing. Add your child if they aren't there yet.",
      "Some protections (web filtering, location, downloads) use guided setup on iOS. eGuard shows each step and verifies the result.",
    ],
  },
  {
    // The slug stays: the apps and docs/mobile-api.md link to it, and parents still search for Family Link
    slug: "android-family-link", category: "SETUP", title: "Set up supervision on Android",
    summary: "eGuard supervises your child's Android phone or tablet itself. You don't need Google Family Link.",
    body: [
      "Install eGuard from Google Play on your child's phone or tablet, choose This is my child's device, and enter the pairing code from your eGuard app or the web.",
      "eGuard then asks for a few permissions: usage access for screen time and app limits, location if you turn it on, and device admin for uninstall protection. Each one is explained before Android asks for it.",
      "Web filtering is one guided step: eGuard shows you how to set the phone's Private DNS to a family filter, then checks it's set.",
      "You don't need Google Family Link. eGuard applies and verifies every protection directly on Android.",
      "eGuard shows a notification on your child's device whenever it's active, so it's never hidden. Tell your child what it does before you set it up.",
    ],
  },
  {
    slug: "protection-profiles", category: "SETUP", title: "Choose a protection profile",
    summary: "Balanced, Protected or Custom: what each protection profile sets for your child's age, and how to change it later.",
    body: [
      // lib/profiles: Protected is the age defaults; Balanced adds an hour, starts bedtime an hour later and raises ratings a tier
      "Protected uses eGuard's standard settings for your child's age. Balanced allows an hour more screen time, a bedtime an hour later and a higher age rating. eGuard suggests Protected for children under 13 and Balanced from 13.",
      "Custom starts from the recommended settings and lets you change each one. You can change any setting later from Protection & Controls.",
    ],
  },
  {
    slug: "device-offline", category: "TROUBLESHOOTING", title: "A device shows as offline",
    summary: "Settings stay active, but eGuard can't verify them until the device reconnects.",
    body: [
      "Your child's device checks in with eGuard about every 5 minutes, and also when the app starts, when the network comes back and after a restart. A device shows as offline when it hasn't checked in for more than a day, and you get an alert naming it.",
      "Offline doesn't mean unprotected. The device keeps following the last rules it received, so screen time, bedtime, app limits and web filtering stay on. What eGuard can't do while it's offline is confirm those settings or send it the changes you make.",
      "While a device is offline, Configuration Health counts it with its last known state, so the score doesn't drop just because a tablet is in a drawer. Your family shows as \"Last known: all set\" rather than \"Fully protected\" until every device is back.",
      "To bring it back online, check on your child's device that it's switched on and charged, and connected to Wi-Fi or mobile data (try opening a website to be sure).",
      "Then check that eGuard isn't restricted by battery saver. On Android, open Settings › Apps › eGuard › Battery and choose Unrestricted; the wording varies by phone maker. Some phones also close apps they think are unused, so allow eGuard to run in the background. It helps to keep eGuard up to date in Google Play, too.",
      "Opening eGuard on your child's device makes it check in straight away. When it does, eGuard verifies every protection again, applies any changes you made while it was away, and clears the offline alert.",
      "If it still shows offline, make sure eGuard on your child's device is still paired. If the device was reset or removed from your family, pair it again from your child's profile with a new code.",
    ],
  },
  {
    slug: "upgrade-plan", category: "FAQ", title: "Plans: Free, eGuard Plus and eGuard Family",
    summary: "What the Free, eGuard Plus and eGuard Family plans include, what they cost in pesos, and how to upgrade or cancel.",
    body: [
      FREE_LINE,
      `${planLine("PLUS")}, and adds ${PAID_ADDS}, and priority support. ${planLine("PRO")}, and adds everything in ${planById("PLUS").name}, advanced reports, API access for schools and organizations, and top-priority support.`,
      "Upgrade in Settings › Subscription on the web, with a card, Maya, GCash or QR Ph. If you move to a smaller plan, children and devices you already added stay protected; you just can't add more until you upgrade.",
      "Subscribed before October 28, 2026? You keep the limits you signed up with for as long as you stay subscribed.",
      "You can cancel any time. Your plan stays active until the end of the paid period.",
      "Only the family admin can change the plan.",
    ],
    iosApp: {
      summary: "What each plan includes.",
      body: [
        FREE_LINE,
        `${planLimits("PLUS")}, and adds ${PAID_ADDS}, and priority support. ${planLimits("PRO")}, and adds everything in ${planById("PLUS").name}, advanced reports, API access for schools and organizations, and top-priority support.`,
        "Subscribed before October 28, 2026? You keep the limits you signed up with for as long as you stay subscribed.",
        "If your family moves to a smaller plan, children and devices you already added stay protected; you just can't add more.",
        "Only the family admin can change the plan.",
      ],
    },
  },
  {
    slug: "setting-not-verified", category: "TROUBLESHOOTING", title: "A setting says \"Waiting for device\"",
    summary: "eGuard only reports a setting once the device confirms it. Why a change can wait, and what to do when it doesn't go through.",
    body: [
      "When you change a setting, eGuard doesn't mark it as done when you tap Save. It waits until your child's device applies the change and reports back what it actually has. Until then, the setting says \"Waiting for device\". We'd rather say we don't know yet than tell you something that isn't true.",
      "Most changes reach the device the next time it checks in, about every 5 minutes, and are confirmed straight after. The status moves from Waiting for device to Delivered, not yet verified, and then to Verified.",
      "If a setting stays on Waiting for device for longer, check whether the device is offline. A device that's switched off, out of battery or without internet can't pick up changes; see \"A device shows as offline\". Opening eGuard on your child's device makes it check in straight away.",
      "Some settings can't be applied by an app and need a few steps from you instead, such as Private DNS for web filtering on Android, or Screen Time settings on iPhone and iPad. These show as Waiting for guided setup. Follow the steps eGuard shows, finish them on your child's device, then tap Verify now.",
      "If the device reports a different value from the one you chose, eGuard marks the change as Didn't match and shows what the device reported, so you can see exactly what's on and fix it.",
    ],
  },
  {
    slug: "health-score", category: "FAQ", title: "What does Configuration Health measure?",
    summary: "Whether each protection is set up and verified. It never scores your child's behavior.",
    body: [
      "Configuration Health tells you how many of eGuard's protections are set up and verified across your family's devices. It's about settings only: it never scores what your child does, how much screen time they use or which apps they open.",
      "There are 10 checks, one per protection: Screen Time, Bedtime, Apps, App Approval, Content, Web, Downloads, Location, Notifications and Uninstall Protection. Each check uses the least healthy device, so if a phone has a protection on and a tablet doesn't, the check shows the tablet's problem and links you to it.",
      "Protections a platform doesn't support are marked Unsupported and never count against the score. Neither do protections you set up yourself through guided steps, once you've confirmed them.",
      "The score comes with a label. Fully protected means every check passes and every device is online. Last known: all set means every check passed, but at least one device is offline, so eGuard is going by what it last reported. Good protection means no more than two checks need attention, Needs attention means at least half pass, and Action required means fewer than half do.",
      "An offline device counts with its last known state, so the score doesn't drop just because a tablet is switched off. eGuard won't call your family fully protected until it can check again, though.",
      "To raise the score, open a check that isn't passing. It names the device and the protection, and walks you through fixing it.",
    ],
  },
  {
    slug: "location-privacy", category: "PRIVACY", title: "How location sharing works",
    summary: "eGuard stores the current location only, unless you turn on location history.",
    body: [
      "Location sharing is part of eGuard Plus and eGuard Family, and it's off until you turn it on. While it's off, eGuard doesn't store any location from your child's device.",
      "By default, eGuard keeps only your child's latest location and overwrites it with each update. There's no trail of where they've been unless you choose to keep one.",
      "If you turn on Keep location history in Settings › Privacy, eGuard also keeps the places your child visited for your family's retention period (90 days unless you change it), then deletes them. Turning location history off deletes the history already kept.",
      "You can name the places your child goes, such as Home or School. Their location then shows the place name, and you can choose to be told when they arrive or leave.",
      "A location that reaches eGuard more than a day after it was taken isn't stored, since it says nothing about where your child is now.",
      "eGuard is never hidden on your child's device, and the page for children explains what parents can and can't see. You can export your family's data, or delete a child's data, at any time from Settings.",
    ],
  },
  {
    slug: "data-we-keep", category: "PRIVACY", title: "What data eGuard keeps",
    summary: "Configuration, daily screen-time totals and alerts. Never messages or browsing content.",
    body: [
      "eGuard stores protection settings, daily and hourly screen-time totals, app names and usage, alerts, and the current location if location is on. For browsers, it keeps a daily count of blocked pages by category, never which sites, apart from a blocked site your child asks you to open, with their reason.",
      "You can export all of your family's data or delete a child's data at any time from Settings.",
    ],
  },
];

/** The article as a client may show it: the iPhone app gets `iosApp`'s text where there is one. */
export function helpForClient(a: HelpArticle, ios: boolean): Omit<HelpArticle, "iosApp"> {
  const { iosApp, ...rest } = a;
  return ios && iosApp ? { ...rest, ...iosApp } : rest;
}

export function searchHelp(q: string, category?: HelpCategory, ios = false) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return HELP_ARTICLES.map((a) => helpForClient(a, ios)).filter((a) => {
    if (category && a.category !== category) return false;
    const hay = `${a.title} ${a.summary} ${a.body.join(" ")}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}
