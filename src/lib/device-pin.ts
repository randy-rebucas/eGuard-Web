import "server-only";
import { z } from "zod";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./auth";
import { LIMITS, hit } from "./rate-limit";

/**
 * The family's parent PIN for a child's iPhone: Apple's Screen Time API gives eGuard no app names, so app rules on an
 * iPhone (blocked apps, apps with a daily limit) are chosen on the phone itself, in "Parent settings", which opens only
 * with this PIN (docs/child-app-spec.md, iOS app rules). Stored like a password (argon2id); checked online only, so a
 * child can't brute-force it from the phone's storage, and each phone gets LIMITS.deviceParentUnlock tries.
 */
export const DevicePin = z.string().regex(/^\d{4,8}$/, "Use 4 to 8 digits.");

/** Whether a PIN is set, for the parent apps' settings row and the child phone's "Parent settings" button. */
export async function devicePinState(familyId: string) {
  const f = await db.family.findUniqueOrThrow({ where: { id: familyId }, select: { devicePinHash: true, devicePinSetAt: true } });
  return { set: !!f.devicePinHash, setAt: f.devicePinSetAt };
}

/** Sets or (null) clears the PIN. */
export async function setDevicePin(familyId: string, pin: string | null) {
  await db.family.update({
    where: { id: familyId },
    data: pin ? { devicePinHash: await hashPassword(pin), devicePinSetAt: new Date() } : { devicePinHash: null, devicePinSetAt: null },
  });
  return devicePinState(familyId);
}

export type UnlockResult = { result: "ok" | "wrong" | "not_set" } | { result: "limited"; retryAfter: number };

/** One try from a child device. Throttled per device before the PIN is even looked at. */
export async function checkDevicePin(device: { id: string; familyId: string }, pin: string): Promise<UnlockResult> {
  const rate = await hit(`parent-unlock:${device.id}`, LIMITS.deviceParentUnlock);
  if (rate.limited) return { result: "limited", retryAfter: rate.retryAfter };
  const f = await db.family.findUniqueOrThrow({ where: { id: device.familyId }, select: { devicePinHash: true } });
  if (!f.devicePinHash) return { result: "not_set" };
  return { result: (await verifyPassword(pin, f.devicePinHash)) ? "ok" : "wrong" };
}
