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
