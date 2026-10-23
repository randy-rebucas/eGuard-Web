import type { CheckStatus, Platform, ProtectionKey } from "@prisma/client";

/**
 * PARENT_SET: the parent sets it in another app on the device (Google Play's parental controls) and confirms; the
 * device can't read it back, so it's recorded as set by the parent, never verified, and isn't counted in health.
 */
export type Capability = "AVAILABLE" | "GUIDED" | "VERIFY_ONLY" | "PARENT_SET" | "UNSUPPORTED";

/** Capabilities where the parent does the steps on the device (the request waits for them) */
export const isGuided = (cap: Capability) => cap === "GUIDED" || cap === "VERIFY_ONLY" || cap === "PARENT_SET";

const PLAY_PARENTAL_CONTROLS = [
  "On your child's phone, open the Play Store, tap the profile picture, then Settings.",
  "Tap Family, then Parental controls. Turn them on and choose a PIN your child doesn't know.",
];

/**
 * A computer (the eGuard desktop agent). It controls apps and time itself, but only holds while the child signs in
 * with a standard account: an administrator can switch anything off. Web filtering is the eGuard browser extension,
 * which the agent installs in every browser and keeps there. A Mac uses the same table as Windows.
 */
const COMPUTER_CAPS = {
  SCREEN_TIME: "AVAILABLE", BEDTIME: "AVAILABLE", APP_APPROVAL: "AVAILABLE", DOWNLOADS: "AVAILABLE",
  // Computer games and apps carry no age rating eGuard can read, and there's no film store to restrict
  APP_RESTRICTIONS: "UNSUPPORTED", CONTENT: "UNSUPPORTED",
  WEB: "GUIDED", UNINSTALL_PROTECTION: "GUIDED", LOCATION: "UNSUPPORTED", NOTIFICATIONS: "UNSUPPORTED",
} as const satisfies Record<ProtectionKey, Capability>;
const computer = (key: ProtectionKey) => ({ WINDOWS: COMPUTER_CAPS[key], MACOS: COMPUTER_CAPS[key] });

const WINDOWS_STANDARD_ACCOUNT = [
  "On the computer, sign in with your own administrator account and open Settings, then Accounts, then Other users (Family on some versions).",
  "Choose your child's account, select Change account type, pick Standard User and select OK.",
  "Sign your child in again. eGuard checks that their account can't install or remove apps, then shows this as on.",
];
const MAC_STANDARD_ACCOUNT = [
  "On the Mac, open System Settings, then Users & Groups, and unlock with your administrator password.",
  "Select your child's account and turn off Allow this user to administer this computer.",
  "Restart the Mac and sign your child in. eGuard checks their account, then shows this as on.",
];
const BROWSER_EXTENSION = [
  "In the eGuard dashboard, open your child's page and choose Add a browser to get a code.",
  "On the computer, open each browser. eGuard has already installed its extension there: open it and type the code.",
  "Browsers the extension can't run in stay blocked on the computer until you allow them in the Apps tab.",
];

export type ProtectionDef = {
  key: ProtectionKey;
  name: string;
  /** Name used in the Configuration Health breakdown */
  checkName: string;
  icon: string;
  slug: string;
  caps: Record<Platform, Capability>;
  /** Guided-setup steps shown to the parent, per platform */
  guide?: Partial<Record<Platform, string[]>>;
};

export const PROTECTIONS: ProtectionDef[] = [
  { key: "SCREEN_TIME", slug: "screen-time", name: "Screen Time", checkName: "Screen Time", icon: "hourglass",
    caps: { ANDROID: "AVAILABLE", IOS: "AVAILABLE", ...computer("SCREEN_TIME") } },
  { key: "BEDTIME", slug: "bedtime", name: "Bedtime", checkName: "Bedtime", icon: "moon",
    caps: { ANDROID: "AVAILABLE", IOS: "AVAILABLE", ...computer("BEDTIME") } },
  // Android has no way to read an app's or a film's age rating, so the rating is Google Play's parental controls
  { key: "APP_RESTRICTIONS", slug: "apps", name: "Apps", checkName: "App Restrictions", icon: "layout-grid",
    caps: { ANDROID: "PARENT_SET", IOS: "AVAILABLE", ...computer("APP_RESTRICTIONS") },
    guide: { ANDROID: [
      ...PLAY_PARENTAL_CONTROLS,
      "Tap Apps & games and choose the highest rating that isn't above your setting, then Save.",
    ] } },
  { key: "APP_APPROVAL", slug: "app-approval", name: "App Approval", checkName: "App Approval", icon: "badge-check",
    caps: { ANDROID: "AVAILABLE", IOS: "AVAILABLE", ...computer("APP_APPROVAL") } },
  { key: "CONTENT", slug: "content", name: "Content", checkName: "Content Restrictions", icon: "film",
    caps: { ANDROID: "PARENT_SET", IOS: "AVAILABLE", ...computer("CONTENT") },
    guide: { ANDROID: [
      ...PLAY_PARENTAL_CONTROLS,
      "Tap Movies (and TV, where it's listed) and choose the highest rating that isn't above your setting, then Save.",
    ] } },
  { key: "WEB", slug: "web", name: "Web", checkName: "Web Filtering", icon: "globe",
    // Android: a family-filter Private DNS, which covers every browser and app; eGuard reads it back to verify.
    // iOS: eGuard turns on the Screen Time adult-website filter itself and reads it back.
    // The browser extension covers computers only (Chrome on Android has no extensions).
    caps: { ANDROID: "GUIDED", IOS: "AVAILABLE", ...computer("WEB") },
    guide: {
      WINDOWS: BROWSER_EXTENSION,
      MACOS: BROWSER_EXTENSION,
      ANDROID: [
        "Open Settings, tap Network & internet, then Private DNS. On Samsung: Connections, More connection settings, Private DNS.",
        "Choose Private DNS provider hostname.",
        "Type family.cloudflare-dns.com and tap Save.",
      ],
    } },
  // iOS: eGuard blocks installing apps through Screen Time (the same switch as App Approval) and reads it back
  { key: "DOWNLOADS", slug: "downloads", name: "Downloads", checkName: "Downloads", icon: "download",
    caps: { ANDROID: "AVAILABLE", IOS: "AVAILABLE", ...computer("DOWNLOADS") } },
  { key: "LOCATION", slug: "location", name: "Location", checkName: "Location", icon: "map-pin",
    caps: { ANDROID: "AVAILABLE", IOS: "GUIDED", ...computer("LOCATION") },
    guide: { IOS: [
      "Open Settings and tap your child's name at the top.",
      "Tap Find My, then turn on Share My Location.",
      "Open the eGuard app and tap Allow location if it asks.",
    ] } },
  { key: "NOTIFICATIONS", slug: "notifications", name: "Notifications", checkName: "Notification Controls", icon: "bell-ring",
    caps: { ANDROID: "AVAILABLE", IOS: "UNSUPPORTED", ...computer("NOTIFICATIONS") } },
  { key: "UNINSTALL_PROTECTION", slug: "uninstall-protection", name: "Uninstall Protection", checkName: "Uninstall Protection", icon: "lock",
    caps: { ANDROID: "AVAILABLE", IOS: "AVAILABLE", ...computer("UNINSTALL_PROTECTION") },
    // Computers: the agent can't be removed there, but an administrator account can switch anything off
    guide: { WINDOWS: WINDOWS_STANDARD_ACCOUNT, MACOS: MAC_STANDARD_ACCOUNT } },
];

export const PLATFORM_NAME: Record<Platform, string> = { ANDROID: "Android", IOS: "iOS", WINDOWS: "Windows", MACOS: "macOS" };

export const PROTECTION_BY_KEY = Object.fromEntries(PROTECTIONS.map((p) => [p.key, p])) as Record<ProtectionKey, ProtectionDef>;
export const PROTECTION_BY_SLUG = Object.fromEntries(PROTECTIONS.map((p) => [p.slug, p])) as Record<string, ProtectionDef>;

export const CAPABILITY_META: Record<Capability, { label: string; icon: string; description: string }> = {
  AVAILABLE: { label: "Available", icon: "check", description: "eGuard applies the setting directly and verifies it." },
  GUIDED: { label: "Guided setup", icon: "list-checks", description: "eGuard walks you through the steps on the device, then verifies." },
  VERIFY_ONLY: { label: "Verification only", icon: "eye", description: "You set it on the device. eGuard confirms it's on." },
  PARENT_SET: { label: "Set by you", icon: "user-check", description: "You set it in Google Play on the device. eGuard can't read it back, so it's recorded as set by you, not verified, and isn't counted in health." },
  UNSUPPORTED: { label: "Unsupported", icon: "circle-slash", description: "The platform doesn't allow this. It isn't counted in health." },
};

export const CHECK_META: Record<CheckStatus, { label: string; icon: string; tone: Tone }> = {
  PASS: { label: "Pass", icon: "circle-check", tone: "ok" },
  WARNING: { label: "Warning", icon: "triangle-alert", tone: "warn" },
  ACTION_REQUIRED: { label: "Action required", icon: "octagon-alert", tone: "crit" },
  UNSUPPORTED: { label: "Unsupported", icon: "circle-slash", tone: "muted" },
  NOT_CONFIGURED: { label: "Not configured", icon: "circle-dashed", tone: "muted" },
};

export type Tone = "ok" | "warn" | "crit" | "muted" | "accent";

/* ---------- Config shapes and display ---------- */

/**
 * Days are counted in the family's time zone (/sync returns it). Weekend limits apply on Saturday and Sunday
 * (limitOn). Bedtime `SCHOOL_NIGHTS` means the nights before a school day, Sunday to Thursday: a window that starts on
 * one of those evenings, including the part after midnight. Friday and Saturday nights have no bedtime.
 */
export type ProtectionConfig =
  | { key: "SCREEN_TIME"; dailyMinutes: number; weekendMinutes: number }
  | { key: "BEDTIME"; enabled: boolean; start: string; end: string; days: "EVERY_DAY" | "SCHOOL_NIGHTS" }
  | { key: "APP_RESTRICTIONS"; maxAgeRating: number }
  | { key: "APP_APPROVAL"; enabled: boolean }
  | { key: "CONTENT"; maxAgeRating: number }
  | { key: "WEB"; mode: "OFF" | "FILTER" | "ALLOWLIST"; blockedSites: number }
  | { key: "DOWNLOADS"; requireApproval: boolean }
  | { key: "LOCATION"; sharing: boolean }
  | { key: "NOTIFICATIONS"; quietDuringBedtime: boolean }
  | { key: "UNINSTALL_PROTECTION"; enabled: boolean };

type Bedtime = Extract<ProtectionConfig, { key: "BEDTIME" }>;

/** Sunday (0) to Thursday (4): the evenings before a school day. */
export const isSchoolNight = (weekday: number) => weekday >= 0 && weekday <= 4;

/**
 * Whether a bedtime is in force at a local time: `weekday` 0 = Sunday, `minutes` since local midnight. Each window
 * belongs to a night: the evening it starts on, or the evening before when it starts after midnight (before noon).
 * So with SCHOOL_NIGHTS, 21:30–06:00 covers Thursday 21:30 to Friday 06:00 but not Friday or Saturday night, and
 * 00:30–06:00 on Friday morning is Thursday's. Not used for enforcement on the server; it pins down the meaning the
 * child app must follow (docs/child-app-spec.md section 6).
 */
export function bedtimeActive(c: Bedtime, at: { weekday: number; minutes: number }) {
  if (!c.enabled) return false;
  const start = minutesOf(c.start), end = minutesOf(c.end);
  if (start === end) return false;
  const crosses = start > end;
  const inside = crosses ? at.minutes >= start || at.minutes < end : at.minutes >= start && at.minutes < end;
  if (!inside) return false;
  if (c.days === "EVERY_DAY") return true;
  // The calendar day the window started on, then the night that day's start belongs to
  const startDay = crosses && at.minutes < end ? at.weekday + 6 : at.weekday;
  const night = start < 12 * 60 ? startDay + 6 : startDay;
  return isSchoolNight(night % 7);
}

const minutesOf = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export function to12h(t: string) {
  const [hRaw, m] = t.split(":").map(Number);
  const ap = hRaw >= 12 ? "PM" : "AM";
  const h = hRaw % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

/** Extra time a parent can give at once (web, app and API all offer these). */
export const EXTRA_TIME_MINUTES = [15, 30, 60] as const;

export function fmtMinutes(m: number) {
  const h = Math.floor(m / 60), mm = m % 60;
  return h ? (mm ? `${h}h ${mm}m` : `${h}h`) : `${mm}m`;
}

export function fmtMinutesPadded(m: number) {
  const h = Math.floor(m / 60), mm = m % 60;
  return h ? `${h}h ${String(mm).padStart(2, "0")}m` : `${mm}m`;
}

/** Human-readable summary of a config value. */
export function describeConfig(cfg: unknown): string {
  if (!cfg || typeof cfg !== "object") return "Not configured";
  const c = cfg as ProtectionConfig;
  switch (c.key) {
    // Name the weekend limit when it differs, or a weekend-only change reads the same before and after
    case "SCREEN_TIME": return c.weekendMinutes === c.dailyMinutes || c.weekendMinutes == null
      ? `${fmtMinutes(c.dailyMinutes)} / day`
      : `${fmtMinutes(c.dailyMinutes)} / day, ${fmtMinutes(c.weekendMinutes)} weekends`;
    // Name school nights: without it a school-nights bedtime reads as every night, and a days-only change looks unchanged
    case "BEDTIME": return c.enabled ? `${to12h(c.start)} – ${to12h(c.end)}${c.days === "SCHOOL_NIGHTS" ? ", school nights" : ""}` : "Off";
    case "APP_RESTRICTIONS": return `Apps rated ${c.maxAgeRating}+ and under`;
    case "APP_APPROVAL": return c.enabled ? "Approval required" : "Off";
    case "CONTENT": return `Rated ${c.maxAgeRating}+ and under`;
    // blockedSites isn't named: the policy's number is a placeholder, and devices report the size of their own list
    case "WEB": return c.mode === "OFF" ? "Off" : c.mode === "ALLOWLIST" ? "Allowed sites only" : "Adult and unsafe sites filtered";
    case "DOWNLOADS": return c.requireApproval ? "Parent approval" : "Unrestricted";
    case "LOCATION": return c.sharing ? "Sharing" : "Sharing off";
    case "NOTIFICATIONS": return c.quietDuringBedtime ? "Quiet during bedtime" : "Unrestricted";
    case "UNINSTALL_PROTECTION": return c.enabled ? "On" : "Off";
    default: return "Configured";
  }
}

/** A config counts as "configured" if it turns the protection on. */
export function isConfigured(cfg: unknown): boolean {
  if (!cfg || typeof cfg !== "object") return false;
  const c = cfg as ProtectionConfig;
  switch (c.key) {
    case "BEDTIME": case "APP_APPROVAL": case "UNINSTALL_PROTECTION": return c.enabled;
    case "WEB": return c.mode !== "OFF";
    case "DOWNLOADS": return c.requireApproval;
    case "LOCATION": return c.sharing;
    case "NOTIFICATIONS": return c.quietDuringBedtime;
    default: return true;
  }
}

/**
 * Stable comparison of requested vs reported configuration. Web filtering compares the mode only: a device reports
 * `blockedSites` as the count of sites it actually loaded (docs/child-app-spec.md), which never equals the policy's.
 */
export function configMatches(desired: unknown, reported: unknown): boolean {
  return stableStringify(comparable(desired)) === stableStringify(comparable(reported));
}

function comparable(v: unknown): unknown {
  if (!v || typeof v !== "object" || (v as { key?: unknown }).key !== "WEB") return v;
  const rest = { ...(v as Record<string, unknown>) };
  delete rest.blockedSites;
  return rest;
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

export function defaultConfig(key: ProtectionKey, age: number): ProtectionConfig {
  const rating = age >= 13 ? 13 : age >= 9 ? 9 : 4;
  switch (key) {
    case "SCREEN_TIME": return { key, dailyMinutes: age >= 13 ? 210 : age >= 11 ? 180 : 120, weekendMinutes: age >= 13 ? 270 : 240 };
    case "BEDTIME": return { key, enabled: true, start: age >= 13 ? "22:00" : "21:30", end: "06:00", days: "EVERY_DAY" };
    case "APP_RESTRICTIONS": return { key, maxAgeRating: rating };
    case "APP_APPROVAL": return { key, enabled: true };
    case "CONTENT": return { key, maxAgeRating: rating };
    case "WEB": return { key, mode: "FILTER", blockedSites: 42 };
    case "DOWNLOADS": return { key, requireApproval: true };
    case "LOCATION": return { key, sharing: true };
    case "NOTIFICATIONS": return { key, quietDuringBedtime: true };
    case "UNINSTALL_PROTECTION": return { key, enabled: true };
  }
}
