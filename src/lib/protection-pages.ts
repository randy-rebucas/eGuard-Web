import type { ProtectionKey } from "@prisma/client";
import { PLANS, type Entitlements } from "./plans";
import { fmtMinutes, describeConfig, type ProtectionConfig } from "./protections";

/** "eGuard Plus and Family Pro": the plans that include a feature, from the catalogue so the copy follows it. */
const plansWith = (has: (e: Entitlements) => boolean) => PLANS.filter((p) => has(p.entitlements)).map((p) => p.name).join(" and ");

/**
 * Public copy for the /protections pages, one entry per protection in protections.ts.
 * Written for parents. Platform support, guided steps and suggested settings are not repeated here:
 * the pages read them from protections.ts and profiles.ts, so they stay in step with the product.
 */
export type ProtectionPage = {
  /** Page heading and search title */
  title: string;
  /** One line for cards, meta description and the page lede */
  summary: string;
  what: string[];
  childSees: string;
  /** What the device reports, and what the parent hears when it changes */
  check: string;
  /** Extra platform notes shown beside the capability, when there's more to say */
  android?: string;
  ios?: string;
  /** Show the suggested-settings-by-age table (only where the value changes with age) */
  byAge?: boolean;
  faqs: [string, string][];
};

export const PROTECTION_PAGES: Record<ProtectionKey, ProtectionPage> = {
  SCREEN_TIME: {
    title: "Daily screen time limits",
    summary: "Set how long your child can use their phone or tablet each day, with a separate limit for weekends.",
    what: [
      "Choose a daily limit for school days and another for Saturday and Sunday. When the time is used up, apps are paused until the next day.",
      "You can also give single apps their own daily limit, like an hour of games, from the Apps tab.",
    ],
    childSees: "How much time is left today, right on the eGuard home screen. When the limit is reached, a screen explains that today's time is used up and who set the limit.",
    check: "The device reports the limits it's actually enforcing. If they don't match what you set, you see it on the dashboard. You also get a daily total, the apps used most, and a weekly trend.",
    byAge: true,
    faqs: [
      ["Does the limit count every app?", "It counts time on the phone or tablet. Apps you've given their own limit also stop when that limit runs out, even if daily time is left."],
      ["What counts as the weekend?", "Saturday and Sunday, in the device's own time zone."],
      ["Can I see how the time was spent?", `Yes. The Screen Time view shows today or the last 7 days, with the top apps and the hours of the day they were used. ${plansWith((e) => e.advancedReports)} adds 30 days and CSV export.`],
    ],
  },
  BEDTIME: {
    title: "Bedtime for phones and tablets",
    summary: "Lock apps overnight on a schedule you choose, every night or only on school nights.",
    what: [
      "Pick a start and end time, such as 9:30 PM to 6:00 AM. During bedtime, apps are locked. The schedule can run past midnight.",
      "Choose every night, or school nights only (Sunday to Thursday), so weekends can run a little later.",
    ],
    childSees: "A calm bedtime screen when they open an app, with the time bedtime ends. The eGuard home screen always shows tonight's bedtime.",
    check: "The device reports the schedule it has registered. If bedtime is switched off or changed on the phone, eGuard alerts you with “Protection setting changed”.",
    android: "On Android, pair bedtime with Notification Controls to keep the phone quiet overnight too.",
    byAge: true,
    faqs: [
      ["Can my child still make calls during bedtime?", "Bedtime locks apps. The phone's built-in emergency calling isn't affected."],
      ["Does bedtime follow our time zone?", "It uses the device's local time, so it works the same when you travel."],
    ],
  },
  APP_RESTRICTIONS: {
    title: "Age ratings for apps",
    summary: "Allow only apps rated for your child's age, and block the rest automatically.",
    what: [
      "Pick the highest app age rating you're comfortable with. Apps rated above it are blocked on the device.",
      "It works alongside App Approval: ratings handle the obvious cases, and approval lets you look at each new app yourself.",
    ],
    childSees: "A block screen on apps above their rating, explaining why and how to ask you about it.",
    check: "The device reports the rating it's applying. If it changes, you're told, and Configuration Health shows the difference until it's fixed.",
    byAge: true,
    faqs: [
      ["Can I see which apps are blocked?", "Yes. The Apps tab lists installed, blocked and pending apps for each child."],
    ],
  },
  APP_APPROVAL: {
    title: "Approve new apps first",
    summary: "New apps stay locked until you say yes. Your child can ask from their phone, and you answer from yours.",
    what: [
      "When App Approval is on, any newly installed app is blocked until you approve it.",
      "Your child can tap Ask for an app, and the request lands in your Alerts and on the web dashboard. Approve it, decline it, or approve it with a daily time limit.",
      "You can also add apps ahead of time, so the ones you already trust are ready to go.",
    ],
    childSees: "A “Waiting for your parent” screen on new apps, and an Ask for an app button on the eGuard home screen.",
    check: "The device reports whether approval is switched on. New apps and requests show up in your alerts, so nothing is installed quietly.",
    faqs: [
      ["How quickly does my answer reach the phone?", "Usually within about 5 minutes, the next time the phone checks in."],
      ["What if I decline by mistake?", "Change it any time from the Apps tab. The new decision reaches the phone at its next check-in."],
    ],
  },
  CONTENT: {
    title: "Age ratings for movies, TV and books",
    summary: "Limit movies, TV shows and books on the device to the age rating you choose.",
    what: [
      "Choose the highest age rating for media on the device. Content rated above it isn't available in the device's media apps.",
      "Use it with App age ratings, so both apps and what's inside them fit your child's age.",
    ],
    childSees: "Content above the rating simply isn't offered, or shows as restricted.",
    check: "The device reports the rating it's applying, and eGuard shows it as Verified only when it matches yours.",
    byAge: true,
    faqs: [
      ["Does this filter YouTube or streaming apps?", "It applies the device's own media ratings. For apps like YouTube, use App age ratings, App Approval and per-app time limits."],
    ],
  },
  WEB: {
    title: "Web filtering",
    summary: "Block harmful sites on your child's phone and in their computer's browser, or allow only the sites you choose.",
    what: [
      "Choose Filter to block harmful sites and any you add, or Allowed sites only for younger children, so only sites you've approved open.",
      "On computers, the eGuard extension for Chrome, Edge and Firefox adds more: SafeSearch, blocked categories, focus hours, and a way for your child to ask for a blocked site.",
    ],
    childSees: "A clear “This site is blocked” page with an Ask a parent button, instead of a broken page.",
    check: "Phones report the filter mode they're using. The browser extension keeps checking itself and alerts you if private windows aren't covered or protection was changed.",
    android: "On Android, eGuard filters the web on the phone itself, in every browser.",
    ios: "Apple doesn't let apps filter the web directly, so eGuard walks you through turning on Apple's own Limit Adult Websites, then checks it.",
    faqs: [
      ["Does eGuard see which websites my child visits?", "No. The browser extension sends only a count of blocked pages per day, by category. The one address eGuard receives is a blocked site your child asks you to open, with the reason they type."],
      ["What happens when my child asks for a site?", "You get the request and can allow it for 15 minutes, an hour, the rest of today or always. The site opens right away, and the rule returns when the time's up."],
      ["Does it work in private or incognito windows?", "The extension checks this and tells you if private windows aren't protected, with the setting to change."],
    ],
  },
  DOWNLOADS: {
    title: "Approval for downloads",
    summary: "Make app store installs wait for a parent's OK.",
    what: [
      "When this is on, your child can't install from the app store without your approval.",
      "Together with App Approval, it means new apps reach the phone only with your say-so.",
    ],
    childSees: "The install waits for approval, and they can ask you from eGuard.",
    check: "The device reports whether installs need approval. If that changes, eGuard tells you.",
    ios: "On iPhone and iPad, you set this in Screen Time or turn on Ask to Buy in Family Sharing. eGuard shows you where, then confirms it's on.",
    faqs: [
      ["What's the difference from App Approval?", "Downloads stops installs at the app store. App Approval blocks any new app that does get installed until you allow it. Using both covers both paths."],
    ],
  },
  LOCATION: {
    title: "Location sharing",
    summary: "See where your child's phone is on a map, with sharing your child can see and you control.",
    what: [
      "When sharing is on, your child's current location appears on the family map in the app and on the web.",
      "A history of places visited is kept only if your family turns on location history. Otherwise eGuard keeps just the latest location.",
      `Location sharing is included with ${plansWith((e) => e.locationSharing)}.`,
    ],
    childSees: "eGuard's home screen shows that location is shared with the family. It's never hidden.",
    check: "The device reports whether location permission and sharing are on. If location is switched off, you get “Location sharing turned off”.",
    ios: "On iPhone and iPad, eGuard guides you through turning on location for eGuard in Settings, then checks it's on.",
    faqs: [
      ["Who can see the location?", "Only the parents in your family account. eGuard fetches the map itself, so the map provider never learns who is looking."],
      ["Can I turn off the history?", "Yes. History is off unless an admin in your family turns it on in Settings > Privacy."],
    ],
  },
  NOTIFICATIONS: {
    title: "Quiet notifications at bedtime",
    summary: "Silence notifications during bedtime, so the phone doesn't wake your child up.",
    what: [
      "Turns on Do Not Disturb automatically for the bedtime hours you've set.",
      "It follows the Bedtime schedule, so there's nothing extra to keep in sync.",
    ],
    childSees: "A quiet phone overnight. Notifications arrive in the morning.",
    check: "The device reports whether quiet hours are set up. If the permission eGuard needs is removed, you're told.",
    ios: "Apple doesn't allow apps to control notifications, so this isn't available on iPhone or iPad. It never counts against your Configuration Health there.",
    faqs: [
      ["Does it block alarms?", "Do Not Disturb silences notifications. The phone's own alarms keep working."],
    ],
  },
  UNINSTALL_PROTECTION: {
    title: "Uninstall protection",
    summary: "Stop eGuard from being removed from your child's phone without you.",
    what: [
      "Keeps the eGuard app from being deleted, so the protections you set stay in place.",
      "eGuard stays visible on the device the whole time. This protection stops removal, not your child's view of what's on.",
    ],
    childSees: "eGuard's icon and home screen as usual. Trying to remove it doesn't work.",
    check: "The device reports whether uninstall protection is active. If it's switched off, eGuard alerts you. A device that stops checking in shows as offline, so you'd notice either way.",
    faqs: [
      ["What if I want to remove eGuard myself?", "Remove the device from Devices in the app or on the web first. That releases the phone."],
    ],
  },
};

/** The ages shown in the suggested-settings table. */
export const SAMPLE_AGES = [7, 10, 12, 15] as const;

/** One cell of the suggested-settings table. */
export function describeSuggested(cfg: ProtectionConfig) {
  return cfg.key === "SCREEN_TIME"
    ? `${fmtMinutes(cfg.dailyMinutes)} school days, ${fmtMinutes(cfg.weekendMinutes)} weekends`
    : describeConfig(cfg);
}
