/** Blog posts for /blog. Static for now, like the help articles; a CMS can replace `POSTS` later. Newest first. */
import { FREE_APP_LIMIT, planById, webPrice, type PaidPlanId } from "./plans";

/** Prices and limits from the plan catalogue, since prices can change without a release (PRICE_*_MONTHLY). */
const price = (id: PaidPlanId) => { const c = webPrice(id); return `₱${c % 100 ? (c / 100).toFixed(2) : c / 100} a month`; };
const limits = (id: PaidPlanId) => planById(id).entitlements;

export type Block =
  | { h2: string }
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  | { note: string };

export type Post = {
  slug: string;
  title: string;
  /** One or two sentences, used on the index card and as the meta description */
  description: string;
  tag: "Guides" | "Product" | "Plans";
  /** YYYY-MM-DD */
  date: string;
  body: Block[];
};

export const POSTS: Post[] = [
  {
    slug: "settings-verified-on-the-device",
    tag: "Product",
    date: "2026-09-28",
    title: "Saved isn't the same as working: why eGuard checks every setting on the device",
    description: "Most parental controls tell you a setting was saved. eGuard waits until your child's phone confirms it, and tells you when that changes.",
    body: [
      { p: "You set a two-hour screen time limit, the app says \"Saved\", and you move on with your day. Three weeks later you find your child on their phone at midnight. The limit was saved. It just wasn't on the phone." },
      { p: "This happens more than it should. A phone was offline when the change went out. An update reset a permission. A setting was switched off on the device itself. From the parent's side, nothing looks different." },
      { h2: "What eGuard does differently" },
      { p: "eGuard only reports a setting as done once your child's device confirms it. Every change goes through the same steps:" },
      { ol: [
        "You choose the setting, for example a bedtime from 9:30 PM to 6:00 AM.",
        "eGuard sends it to each of your child's devices.",
        "The device applies it and reports back the setting it actually has.",
        "If the two match, the setting is marked Verified. If they don't, it's marked Failed, and eGuard shows you what the device reported instead.",
      ] },
      { p: "Until a device answers, the setting says \"Waiting for device\". That's deliberate. We'd rather tell you we don't know yet than tell you something that isn't true." },
      { h2: "It keeps checking after setup" },
      { p: "Devices report their settings every time they sync, not just when you make a change. If a report no longer matches what you chose, and you didn't change anything, eGuard raises a \"Protection setting changed\" alert. If a device stops checking in for more than a day, it shows as offline, so you know eGuard can't vouch for it until it's back." },
      { h2: "One score for the whole picture" },
      { p: "Configuration Health rolls this up into one number per child: 10 checks, one for each protection. Each check uses the least protected device, so a well-set-up tablet can't hide an unprotected phone." },
      { p: "It measures settings, never your child's behavior. A child who uses their full two hours doesn't lower the score. A two-hour limit that isn't on the phone does." },
      { note: "Some platforms don't allow certain settings. Notification controls, for example, aren't available on iPhone. eGuard marks these Unsupported and leaves them out of the score, so you're never marked down for something you can't change." },
    ],
  },
  {
    slug: "bedtime-for-your-childs-phone",
    tag: "Guides",
    date: "2026-09-28",
    title: "A bedtime for your child's phone that actually holds",
    description: "How to pick a device bedtime that fits your child's age and school week, and how to make sure it's really on.",
    body: [
      { p: "A phone on the nightstand is one of the easiest ways for a school night to run late. A device bedtime doesn't replace a conversation about sleep, but it takes the nightly negotiation off your plate." },
      { h2: "Pick a time that fits their age" },
      { p: "There's no single right answer, but a simple rule of thumb works for most families: the phone goes to sleep before your child does, and wakes up after they're up. eGuard's starting points are:" },
      { ul: [
        "Under 13: 9:30 PM to 6:00 AM",
        "13 and older: 10:00 PM to 6:00 AM",
        "On the Balanced profile, bedtime starts an hour later",
      ] },
      { p: "Treat these as a starting point. If your child has an early school start, or a long commute, move bedtime earlier. If they're older and handling it well, give them more room." },
      { h2: "Every night, or school nights only?" },
      { p: "eGuard lets you choose between every night and school nights only. School nights only is a good fit for many teenagers: the rule holds when it matters most, and weekends are theirs to manage. For younger children, a bedtime that's the same every night is usually easier to keep." },
      { h2: "Set it up in eGuard" },
      { ol: [
        "Open your child's profile and go to Protection & Controls.",
        "Choose Bedtime, set the start and end times, and pick every night or school nights.",
        "Wait for each device to confirm. The setting shows Verified once it's on the phone, and Failed if the device reports something else.",
      ] },
      { p: "On Android, you can also turn on Notification controls to keep the phone quiet during bedtime, so late-night messages don't light up the screen." },
      { h2: "Talk about it first" },
      { p: "Rules that come out of nowhere get pushed back on. Rules that were talked through tend to stick. Before you switch bedtime on, tell your child what time it starts, why, and when you'll look at it again together. If they're 13 or older on Android, they'll be asked to agree to supervision on their device, so it's better they hear about it from you first." },
      { note: "Bedtime works best alongside a daily screen time limit. A limit caps how much time they spend; bedtime decides when that time ends." },
    ],
  },
  {
    slug: "what-the-free-plan-covers",
    tag: "Plans",
    date: "2026-09-28",
    title: "What eGuard's Free plan covers",
    description: "Free parental controls for one child, with every setting verified on the device. Here's exactly what's included, and when an upgrade makes sense.",
    body: [
      { p: "eGuard's Free plan isn't a trial. It doesn't expire, and you don't need a card to start. It's built for a family with one child who wants the basics set up properly." },
      { h2: "What's included" },
      { ul: [
        "1 child and up to 2 devices, for example a phone and a tablet",
        "Guided setup for Android (iPhone and iPad coming soon)",
        "Screen time limits, with a separate weekend limit",
        "Bedtime, content age ratings, web filtering, download approval and uninstall protection",
        `App monitoring for up to ${FREE_APP_LIMIT} apps: see usage, set daily limits, block or approve`,
        "Configuration Health, so you can see every setting is verified on the device",
        "Alerts in the dashboard and by email when a setting changes or a device goes offline",
        "Email support",
      ] },
      { p: "Verification isn't a paid extra. Every plan, Free included, only marks a setting as done once the device confirms it." },
      { h2: "When to upgrade" },
      { p: `eGuard Plus (${price("PLUS")}) makes sense when you have more than one child, want to see where your child's device is, or need to manage all of their apps rather than ${FREE_APP_LIMIT}. It covers up to ${limits("PLUS").childLimit} children and ${limits("PLUS").deviceLimit} devices.` },
      { p: `Family Pro (${price("PRO")}) is for larger families and organizations: up to ${limits("PRO").childLimit} children and ${limits("PRO").deviceLimit} devices, 30-day and custom reports with CSV export, and API access for schools.` },
      { p: "You can upgrade on the web with a card, Maya, GCash or QR Ph, and cancel any time. If you move back to Free, the children and devices you already added stay protected; you just can't add more until you upgrade again." },
    ],
  },
];

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug) ?? null;

export const postDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** About 220 words a minute, rounded up. */
export function readMinutes(post: Post) {
  const text = post.body.map((b) => ("ul" in b ? b.ul.join(" ") : "ol" in b ? b.ol.join(" ") : Object.values(b)[0])).join(" ");
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 220));
}
