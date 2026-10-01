import type { CheckStatus, Platform, ProtectionKey } from "@prisma/client";

export type Capability = "AVAILABLE" | "GUIDED" | "VERIFY_ONLY" | "UNSUPPORTED";

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
    caps: { ANDROID: "AVAILABLE", IOS: "AVAILABLE" } },
  { key: "BEDTIME", slug: "bedtime", name: "Bedtime", checkName: "Bedtime", icon: "moon",
    caps: { ANDROID: "AVAILABLE", IOS: "AVAILABLE" } },
  { key: "APP_RESTRICTIONS", slug: "apps", name: "Apps", checkName: "App Restrictions", icon: "layout-grid",
    caps: { ANDROID: "AVAILABLE", IOS: "AVAILABLE" } },
  { key: "APP_APPROVAL", slug: "app-approval", name: "App Approval", checkName: "App Approval", icon: "badge-check",
    caps: { ANDROID: "AVAILABLE", IOS: "AVAILABLE" } },
  { key: "CONTENT", slug: "content", name: "Content", checkName: "Content Restrictions", icon: "film",
    caps: { ANDROID: "AVAILABLE", IOS: "AVAILABLE" } },
  { key: "WEB", slug: "web", name: "Web", checkName: "Web Filtering", icon: "globe",
    caps: { ANDROID: "AVAILABLE", IOS: "GUIDED" },
    guide: { IOS: [
      "Open Settings, tap Screen Time, then Content & Privacy Restrictions.",
      "Tap App Store, Media, Web & Games, then Web Content.",
      "Choose Limit Adult Websites.",
    ] } },
  { key: "DOWNLOADS", slug: "downloads", name: "Downloads", checkName: "Downloads", icon: "download",
    caps: { ANDROID: "AVAILABLE", IOS: "VERIFY_ONLY" },
    guide: { IOS: [
      "Open Settings, tap Screen Time, then Content & Privacy Restrictions.",
      "Tap iTunes & App Store Purchases.",
      "Set Installing Apps to Don't Allow, or turn on Ask to Buy in Family Sharing.",
    ] } },
  { key: "LOCATION", slug: "location", name: "Location", checkName: "Location", icon: "map-pin",
    caps: { ANDROID: "AVAILABLE", IOS: "GUIDED" },
    guide: { IOS: [
      "Open Settings and tap your child's name at the top.",
      "Tap Find My, then turn on Share My Location.",
      "Open the eGuard app and tap Allow location if it asks.",
    ] } },
  { key: "NOTIFICATIONS", slug: "notifications", name: "Notifications", checkName: "Notification Controls", icon: "bell-ring",
    caps: { ANDROID: "AVAILABLE", IOS: "UNSUPPORTED" } },
  { key: "UNINSTALL_PROTECTION", slug: "uninstall-protection", name: "Uninstall Protection", checkName: "Uninstall Protection", icon: "lock",
    caps: { ANDROID: "AVAILABLE", IOS: "AVAILABLE" } },
];

export const PROTECTION_BY_KEY = Object.fromEntries(PROTECTIONS.map((p) => [p.key, p])) as Record<ProtectionKey, ProtectionDef>;
export const PROTECTION_BY_SLUG = Object.fromEntries(PROTECTIONS.map((p) => [p.slug, p])) as Record<string, ProtectionDef>;

export const CAPABILITY_META: Record<Capability, { label: string; icon: string; description: string }> = {
  AVAILABLE: { label: "Available", icon: "check", description: "eGuard applies the setting directly and verifies it." },
  GUIDED: { label: "Guided setup", icon: "list-checks", description: "eGuard walks you through the steps on the device, then verifies." },
  VERIFY_ONLY: { label: "Verification only", icon: "eye", description: "You set it on the device. eGuard confirms it's on." },
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

export function to12h(t: string) {
  const [hRaw, m] = t.split(":").map(Number);
  const ap = hRaw >= 12 ? "PM" : "AM";
  const h = hRaw % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

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
    case "WEB": return c.mode === "OFF" ? "Off" : c.mode === "ALLOWLIST" ? "Allowed sites only" : `Filtered, ${c.blockedSites} sites blocked`;
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

/** Stable comparison of requested vs reported configuration. */
export function configMatches(desired: unknown, reported: unknown): boolean {
  return stableStringify(desired) === stableStringify(reported);
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
