import type { WebCategory } from "./browser-policy";

/**
 * STARTER category lists: a small, hand-picked set of the best-known sites per category, so category blocking
 * does something useful on day one. They are NOT complete, and parents are told so. Replace this module with a
 * maintained feed (open-licensed lists or a commercial classifier) without changing anything else: the policy
 * endpoint only needs `categoryDomains(category)`.
 *
 * A rule for a domain also covers its subdomains (m.facebook.com, www.roblox.com, …).
 */
const LISTS: Partial<Record<WebCategory, readonly string[]>> = {
  ADULT: [
    "pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com", "redtube.com", "youporn.com", "spankbang.com",
    "onlyfans.com", "chaturbate.com", "stripchat.com", "brazzers.com", "eporner.com",
  ],
  GAMBLING: [
    "bet365.com", "pokerstars.com", "draftkings.com", "fanduel.com", "williamhill.com", "888casino.com", "stake.com",
    "betway.com", "bovada.lv", "unibet.com", "pinnacle.com", "betfair.com",
  ],
  DATING: ["tinder.com", "bumble.com", "match.com", "okcupid.com", "hinge.co", "grindr.com", "badoo.com", "pof.com", "zoosk.com"],
  SOCIAL_MEDIA: [
    "facebook.com", "instagram.com", "tiktok.com", "twitter.com", "x.com", "snapchat.com", "threads.net", "pinterest.com",
    "reddit.com", "tumblr.com", "discord.com", "bsky.app",
  ],
  GAMING: [
    "roblox.com", "minecraft.net", "fortnite.com", "epicgames.com", "steampowered.com", "steamcommunity.com", "ea.com",
    "miniclip.com", "poki.com", "crazygames.com", "friv.com", "y8.com",
  ],
  STREAMING: [
    "netflix.com", "youtube.com", "twitch.tv", "disneyplus.com", "primevideo.com", "hulu.com", "max.com", "spotify.com",
    "vimeo.com", "dailymotion.com", "crunchyroll.com", "kick.com",
  ],
  SHOPPING: [
    "amazon.com", "ebay.com", "shopee.ph", "lazada.com.ph", "aliexpress.com", "temu.com", "shein.com", "etsy.com",
    "walmart.com", "zalora.com.ph",
  ],
};

/**
 * Categories the browser's own protection covers far better than any static list could (lists of malware and
 * phishing sites change by the hour). Chrome's Safe Browsing and Edge's SmartScreen handle them; see the
 * "Browser safety warnings" switch.
 */
export const COVERED_BY_BROWSER: readonly WebCategory[] = ["MALWARE", "PHISHING"];

export function categoryDomains(category: WebCategory): readonly string[] {
  return LISTS[category] ?? [];
}

/** What the parent sees under each category checkbox. */
export function categoryCoverage(category: WebCategory): { count: number; note: string } {
  if (COVERED_BY_BROWSER.includes(category)) return { count: 0, note: "Uses the browser's safety warnings" };
  const n = categoryDomains(category).length;
  return n ? { count: n, note: `Starter list: ${n} well-known sites` } : { count: 0, note: "No list yet: add sites below" };
}
