/*
 * The rules behind the public setup demo (/demo): pairing codes, what each device reports after pairing, and how many
 * device slots the family uses. Pure and client-safe: the demo runs entirely in the visitor's browser and saves nothing.
 * Kept in step with the real thing:
 * - Codes: family-service (createPairingCode) and the device/browser pair routes
 * - Capabilities: src/lib/protections.ts (passed in by the page, so this file never drifts from the table)
 * - Slots: src/lib/browser-link.ts (a browser on a paired computer takes no slot)
 */

/** Pairing code characters: A–Z without I and O, and 2–9, so nothing reads as 1/I or 0/O. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
/** How long a pairing code works. */
export const CODE_MINUTES = 15;

/** A fresh code. `rand` returns [0, 1); call it from an event handler or effect, never during render. */
export function makeCode(rand: () => number = Math.random) {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
  return s;
}

/** What a parent might type ("k7pq-2m9x", "K7PQ 2M9X") as the stored form ("K7PQ2M9X"), like the pair routes do. */
export const normalizeCode = (input: string) => input.toUpperCase().replace(/[\s-]/g, "");

/** "K7PQ2M9X" as "K7PQ 2M9X", the way the parent app shows it. */
export const formatCode = (code: string) => `${code.slice(0, 4)} ${code.slice(4)}`;

export type CodeKind = "DEVICE" | "BROWSER";

/** What the child's device says about a typed code. The messages are the real apps' wording. */
export function checkCode(input: string, codes: { want: string; kind: CodeKind; other?: string }) {
  const code = normalizeCode(input);
  if (code.length < CODE_LENGTH) return { ok: false as const, message: `Enter all ${CODE_LENGTH} characters.` };
  if (code === codes.want) return { ok: true as const };
  if (codes.other && code === codes.other) {
    return {
      ok: false as const,
      message: codes.kind === "DEVICE"
        ? "This code is for the eGuard browser extension. In the parent dashboard, choose Pair a device to get a code for this app."
        : "This code is for the eGuard phone app. In the parent dashboard, choose Add a browser to get a browser code.",
    };
  }
  return { ok: false as const, message: "That code didn't work. Codes last 15 minutes and only the newest one works. Ask for a new code." };
}

/** mm:ss left on a code. */
export function countdown(msLeft: number) {
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---------- What each device reports ----------

export type DemoCap = "AVAILABLE" | "GUIDED" | "VERIFY_ONLY" | "PARENT_SET" | "UNSUPPORTED";
/** One protection, and what Android and a computer can do with it (protections.ts `caps`). */
export type DemoProtection = { key: string; name: string; android: DemoCap; computer: DemoCap };

export type CheckState = "verified" | "guided" | "parent" | "off" | "na" | "plan";
export type Check = { key: string; name: string; state: CheckState; note?: string };

/** Android permissions the setup asks for, and the protections that stay off when one is skipped (child-app-spec 4). */
export const ANDROID_PERMISSIONS = [
  { id: "usage", name: "Usage access", why: "Lets eGuard count screen time and pause apps when time is up.", protects: ["SCREEN_TIME", "APP_APPROVAL"] },
  { id: "overlay", name: "Display over other apps", why: "Shows the eGuard screen over an app that's paused or blocked.", protects: ["BEDTIME"] },
  { id: "notifications", name: "Notification policy access", why: "Silences notifications during bedtime.", protects: ["NOTIFICATIONS"] },
  { id: "admin", name: "Device admin", why: "Stops eGuard from being removed without a parent.", protects: ["UNINSTALL_PROTECTION"] },
] as const;
export type PermissionId = (typeof ANDROID_PERMISSIONS)[number]["id"];

/** The Android phone's checks after its first report. Skipped permissions leave their protections off. */
export function phoneChecks(protections: DemoProtection[], o: { skipped: readonly PermissionId[]; locationOnPlan: boolean }): Check[] {
  const off = new Set(ANDROID_PERMISSIONS.filter((p) => o.skipped.includes(p.id)).flatMap((p) => p.protects as readonly string[]));
  return protections.map(({ key, name, android }): Check => {
    if (android === "UNSUPPORTED") return { key, name, state: "na" };
    if (key === "LOCATION" && !o.locationOnPlan) return { key, name, state: "plan", note: "Not on the Free plan" };
    if (off.has(key)) return { key, name, state: "off", note: "A permission was skipped on the phone" };
    if (android === "PARENT_SET") return { key, name, state: "parent", note: "You set this in Google Play's parental controls" };
    if (android === "GUIDED" || android === "VERIFY_ONLY") return { key, name, state: "guided", note: key === "WEB" ? "One step on the phone: Private DNS" : "Follow the steps, then check" };
    return { key, name, state: "verified" };
  });
}

/**
 * The Windows PC's checks. Web filtering is the browser extension, so it's verified once a browser on this PC is
 * connected. Uninstall Protection holds only when every account with the child's rules is a standard account.
 */
export function computerChecks(protections: DemoProtection[], o: { browserConnected: boolean; adminAccountIncluded: boolean }): Check[] {
  return protections.map(({ key, name, computer }): Check => {
    if (computer === "UNSUPPORTED") return { key, name, state: "na" };
    if (key === "WEB") return o.browserConnected ? { key, name, state: "verified" } : { key, name, state: "guided", note: "Connect a browser on this PC" };
    if (key === "UNINSTALL_PROTECTION") {
      return o.adminAccountIncluded
        ? { key, name, state: "guided", note: "An administrator account has the child's rules. Make it a standard account." }
        : { key, name, state: "verified", note: "The child's account is a standard account" };
    }
    if (computer === "AVAILABLE") return { key, name, state: "verified" };
    return { key, name, state: "guided", note: "Follow the steps, then check" };
  });
}

/** A browser reports one thing: web filtering. */
export const browserChecks = (protections: DemoProtection[]): Check[] =>
  protections.filter((p) => p.key === "WEB").map(({ key, name }) => ({ key, name, state: "verified" }));

/** Checks that count towards Configuration Health: unsupported and not-on-plan protections never count against it. */
export function health(checks: Check[]) {
  const counted = checks.filter((c) => c.state !== "na" && c.state !== "plan");
  return { verified: counted.filter((c) => c.state === "verified").length, total: counted.length };
}

// ---------- Device slots ----------

export type DemoDevice = "phone" | "computer" | "browser";

/**
 * Device slots the chosen devices use. Phones and computers take one each. A browser takes one too, unless it's on a
 * computer running eGuard for Windows: then it's part of that computer and takes none.
 */
export function slotsUsed(devices: readonly DemoDevice[]) {
  const has = (d: DemoDevice) => devices.includes(d);
  return (has("phone") ? 1 : 0) + (has("computer") ? 1 : 0) + (has("browser") && !has("computer") ? 1 : 0);
}

/** The setup order: the computer before its browser, so the browser joins the computer and takes no slot. */
export const DEVICE_ORDER: DemoDevice[] = ["phone", "computer", "browser"];
