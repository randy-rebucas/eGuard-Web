/** Help & Support content for the apps. Static for now; a CMS can replace `HELP_ARTICLES` later. */

export type HelpCategory = "SETUP" | "TROUBLESHOOTING" | "PRIVACY" | "FAQ";

export const HELP_CATEGORIES: { id: HelpCategory; name: string; description: string; icon: string }[] = [
  { id: "SETUP", name: "Setup Guides", description: "Step-by-step instructions", icon: "book-open" },
  { id: "TROUBLESHOOTING", name: "Troubleshooting", description: "Common solutions", icon: "wrench" },
  { id: "PRIVACY", name: "Privacy & Security", description: "How we protect your data", icon: "lock" },
  { id: "FAQ", name: "FAQs", description: "Frequently asked questions", icon: "circle-help" },
];

export type HelpArticle = { slug: string; category: HelpCategory; title: string; summary: string; body: string[] };

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "pair-a-device", category: "SETUP", title: "Add your child's device",
    summary: "Pair an Android or iOS device with a one-time code.",
    body: [
      "Open your child's profile and tap Add device. eGuard shows an 8-character code that works for 15 minutes.",
      "Install eGuard on your child's device, choose I'm setting up my child's device, and enter the code.",
      "eGuard checks every protection on the new device right away, so Configuration Health is accurate from the start.",
    ],
  },
  {
    slug: "ios-family-sharing", category: "SETUP", title: "Set up supervision on iPhone and iPad",
    summary: "Use Family Sharing so eGuard can apply Screen Time settings.",
    body: [
      "On your iPhone, open Settings, tap your name, then Family Sharing. Add your child if they aren't there yet.",
      "Some protections (web filtering, location, downloads) use guided setup on iOS. eGuard shows each step and verifies the result.",
    ],
  },
  {
    slug: "android-family-link", category: "SETUP", title: "Set up supervision on Android",
    summary: "Use Google Family Link so eGuard can manage your child's Android device.",
    body: [
      "Install Google Family Link on your phone, open it, and add your child's Google account. Follow the steps on your child's device to supervise it.",
      "Then install eGuard on your child's device and enter the pairing code from your eGuard app. eGuard applies and verifies every protection directly on Android.",
      "If your child is 13 or older, they'll be asked to agree to supervision on their device.",
    ],
  },
  {
    slug: "protection-profiles", category: "SETUP", title: "Choose a protection profile",
    summary: "Balanced, Protected or Custom, and how to change it later.",
    body: [
      "Protected uses eGuard's recommended settings for your child's age. Balanced allows more screen time, a later bedtime and a higher age rating.",
      "Custom starts from the recommended settings and lets you change each one. You can change any setting later from Protection & Controls.",
    ],
  },
  {
    slug: "device-offline", category: "TROUBLESHOOTING", title: "A device shows as offline",
    summary: "Settings stay active, but eGuard can't verify them until the device reconnects.",
    body: [
      "A device is offline when it hasn't synced for more than a day. Check that it's charged, connected to the internet, and that eGuard isn't restricted by battery saver.",
      "Once the device reconnects, eGuard verifies every protection again automatically.",
    ],
  },
  {
    slug: "upgrade-plan", category: "FAQ", title: "Upgrade to eGuard Family",
    summary: "More devices and priority support, billed through Google Play.",
    body: [
      "eGuard Family covers up to 15 devices and includes priority support. On Android, tap Upgrade to Family in Settings › Subscription and pay with Google Play.",
      "You can cancel any time in the Google Play Store under Payments & subscriptions. Your plan stays active until the end of the paid period.",
      "Only the family admin can change the plan.",
    ],
  },
  {
    slug: "setting-not-verified", category: "TROUBLESHOOTING", title: "A setting says \"Waiting for device\"",
    summary: "eGuard only reports a setting once the device confirms it.",
    body: [
      "Changes are applied the next time the device syncs, usually within a few minutes.",
      "For guided setup on iOS, finish the steps on your child's device, then tap Verify now.",
      "If the device reports a different value, eGuard marks the change as failed and shows what the device reported.",
    ],
  },
  {
    slug: "health-score", category: "FAQ", title: "What does Configuration Health measure?",
    summary: "Whether each protection is set up and verified. It never scores your child's behavior.",
    body: [
      "Configuration Health has 10 checks, one per protection. Each check uses the least healthy device.",
      "Protections a platform doesn't support are marked Unsupported and never count against the score.",
    ],
  },
  {
    slug: "location-privacy", category: "PRIVACY", title: "How location sharing works",
    summary: "eGuard stores the current location only, unless you turn on location history.",
    body: [
      "By default eGuard keeps only the latest location and overwrites it with each update.",
      "If you turn on location history in Privacy settings, eGuard keeps the places your child visited for your retention period.",
    ],
  },
  {
    slug: "data-we-keep", category: "PRIVACY", title: "What data eGuard keeps",
    summary: "Configuration, daily screen-time totals and alerts. Never messages or browsing content.",
    body: [
      "eGuard stores protection settings, daily and hourly screen-time totals, app names and usage, alerts, and the current location.",
      "You can export all of your family's data or delete a child's data at any time from Settings.",
    ],
  },
];

export function searchHelp(q: string, category?: HelpCategory) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return HELP_ARTICLES.filter((a) => {
    if (category && a.category !== category) return false;
    const hay = `${a.title} ${a.summary} ${a.body.join(" ")}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}
