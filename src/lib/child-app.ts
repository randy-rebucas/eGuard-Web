import type { Platform } from "@prisma/client";

/**
 * The oldest child-app version the server supports on a platform, from CHILD_MIN_APP_VERSION: either one version for
 * both platforms ("1.2.0") or one per platform ("android:1.2.0,ios:1.1.0"). null when unset or when the platform
 * isn't listed, so the app never shows an update screen by accident.
 */
export function minChildAppVersion(platform: Platform, raw = process.env.CHILD_MIN_APP_VERSION) {
  const v = raw?.trim();
  if (!v) return null;
  if (!v.includes(":")) return v;
  for (const part of v.split(",")) {
    const [p, version] = part.split(":").map((s) => s.trim());
    if (p.toUpperCase() === platform && version) return version;
  }
  return null;
}

/** Whether a dotted version ("1.2.10") is older than `min`. Unknown or unparsable versions aren't counted as older. */
export function isBelowVersion(version: string | null | undefined, min: string | null | undefined) {
  if (!version || !min) return false;
  const parse = (v: string) => v.trim().replace(/^v/i, "").split(/[.+-]/).slice(0, 3).map((n) => Number.parseInt(n, 10));
  const a = parse(version), b = parse(min);
  if (a.some(Number.isNaN) || b.some(Number.isNaN)) return false;
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
