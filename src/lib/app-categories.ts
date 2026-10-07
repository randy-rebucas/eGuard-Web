import type { AppCategory } from "@prisma/client";
import { planWith } from "./plans";

/**
 * App categories, so parents can limit a kind of app ("Gaming time") rather than each game. Devices report apps by
 * name only, so eGuard guesses the category from the name; a parent's choice (ChildApp.category) always wins.
 * Client-safe: the web form and the server share the labels.
 */

export const APP_CATEGORIES: { key: AppCategory; label: string; limitLabel: string; icon: string }[] = [
  { key: "GAMES", label: "Games", limitLabel: "Gaming time", icon: "gamepad" },
  { key: "SOCIAL", label: "Social media", limitLabel: "Social media time", icon: "users" },
  { key: "VIDEO", label: "Video", limitLabel: "Video time", icon: "film" },
  { key: "MESSAGING", label: "Messaging", limitLabel: "Messaging time", icon: "message-circle" },
  { key: "EDUCATION", label: "Learning", limitLabel: "Learning time", icon: "book-open" },
  { key: "CREATIVITY", label: "Creativity", limitLabel: "Creativity time", icon: "palette" },
  { key: "BROWSERS", label: "Browsers", limitLabel: "Browser time", icon: "globe" },
  { key: "OTHER", label: "Other", limitLabel: "Other apps' time", icon: "app-window" },
];

export const CATEGORY_KEYS = APP_CATEGORIES.map((c) => c.key) as [AppCategory, ...AppCategory[]];
export const CATEGORY_BY_KEY = Object.fromEntries(APP_CATEGORIES.map((c) => [c.key, c])) as Record<AppCategory, (typeof APP_CATEGORIES)[number]>;

/** Well-known apps, by name with everything but letters and digits removed, lower case. */
const KNOWN: Record<Exclude<AppCategory, "OTHER">, string[]> = {
  GAMES: [
    "roblox", "minecraft", "fortnite", "pubgmobile", "pubg", "freefire", "garenafreefire", "mobilelegends", "mobilelegendsbangbang",
    "callofdutymobile", "callofduty", "genshinimpact", "honkaistarrail", "clashofclans", "clashroyale", "brawlstars", "candycrushsaga",
    "subwaysurfers", "amongus", "pokemongo", "pokemonunite", "stumbleguys", "8ballpool", "templerun2", "geometrydash", "fallguys",
    "valorant", "leagueoflegends", "wildrift", "leagueoflegendswildrift", "codm", "asphalt9", "hayday", "plantsvszombies", "angrybirds2",
    "steam", "epicgames", "xbox", "playstation", "playgames", "googleplaygames", "gamecenter",
  ],
  SOCIAL: ["tiktok", "instagram", "facebook", "snapchat", "x", "twitter", "threads", "pinterest", "reddit", "tumblr", "bereal", "lemon8", "likee", "kwai", "facebooklite"],
  VIDEO: ["youtube", "youtubekids", "netflix", "disney", "disneyplus", "primevideo", "hbomax", "max", "viu", "iqiyi", "wetv", "twitch", "vimeo", "bilibili", "appletv", "crunchyroll"],
  MESSAGING: ["messenger", "messengerkids", "whatsapp", "telegram", "viber", "discord", "line", "signal", "wechat", "kakaotalk", "messages", "imessage", "googlemessages"],
  EDUCATION: ["khanacademy", "khanacademykids", "duolingo", "googleclassroom", "classroom", "brainly", "photomath", "quizlet", "scratchjr", "scratch", "kahoot", "byjus", "mathway", "canvasstudent", "microsoftteams", "teams", "zoom", "googlemeet"],
  CREATIVITY: ["canva", "capcut", "ibispaintx", "ibispaint", "procreate", "picsart", "garageband", "inshot", "sketchbook", "lightroom"],
  BROWSERS: ["chrome", "googlechrome", "safari", "firefox", "edge", "microsoftedge", "opera", "operamini", "samsunginternet", "brave", "duckduckgo"],
};
const BY_NAME = new Map<string, AppCategory>(Object.entries(KNOWN).flatMap(([cat, names]) => names.map((n) => [n, cat as AppCategory])));

const normalize = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/** eGuard's guess for an app it hasn't been told about: a known app, a name that says "game", or OTHER. */
export function guessCategory(name: string): AppCategory {
  const known = BY_NAME.get(normalize(name));
  if (known) return known;
  if (/\bgames?\b/i.test(name)) return "GAMES";
  return "OTHER";
}

/** The app's category: the parent's choice, or eGuard's guess. `auto` says which. */
export function categoryOf(app: { name: string; category: AppCategory | null }) {
  return app.category ? { category: app.category, auto: false } : { category: guessCategory(app.name), auto: true };
}

export const CATEGORY_UPGRADE = `Limits for a kind of app, like gaming time, are included with ${planWith((e) => e.categoryLimits).name} and above.`;

/** What eGuard suggests for gaming time on Recommended Setup, by protection profile (Custom starts from Protected). */
export const recommendedGamingMinutes = (profile: string) => (profile === "BALANCED" ? 90 : 60);
