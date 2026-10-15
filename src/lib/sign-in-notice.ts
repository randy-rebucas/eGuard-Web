import "server-only";
import { db } from "./db";
import { sha256 } from "./auth";
import { clockTime, longDate } from "./format";
import { sendSecurityNotice } from "./security-notice";

/**
 * "New sign-in to your eGuard account": emailed when a session starts on a browser or app install the parent hasn't
 * signed in from before, so a stolen password shows up in their inbox. A browser is known by its device cookie
 * (lib/auth), an app by the install id it sends (X-eGuard-Install, docs/mobile-api.md). An older app without one is
 * known by its platform alone. A parent's first device (signing up, accepting an invitation, the first sign-in after
 * this shipped) is remembered without an email.
 */

/** `id`: the device cookie or install id, null when the client sent neither; `userAgent` names it and stands in for a missing id */
export type SignInDevice = { id: string | null; userAgent: string | null; ip: string | null; label: string };

/** Devices not signed in from for this long are forgotten (maintenance), and a sign-in from one counts as new again. */
export const KNOWN_DEVICE_DAYS = 180;

export async function noteSignIn(userId: string, device: SignInDevice) {
  const key = sha256(device.id ? `id:${device.id}` : `agent:${device.label}`);
  const now = new Date();
  const added = await db.knownDevice.createMany({ data: [{ userId, key, label: device.label.slice(0, 80) }], skipDuplicates: true });
  if (!added.count) {
    await db.knownDevice.updateMany({ where: { userId, key }, data: { lastSeenAt: now } });
    return false;
  }
  const others = await db.knownDevice.count({ where: { userId, key: { not: key } } });
  if (!others) return false;
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true, family: { select: { timezone: true } } } });
  const tz = u.family.timezone;
  sendSecurityNotice(u.email, u.name, { kind: "new_sign_in", device: device.label, when: `${longDate(now, tz)} at ${clockTime(now, tz)}`, ip: device.ip });
  return true;
}
