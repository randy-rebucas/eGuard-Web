import "server-only";
import { db } from "./db";

/**
 * Devices the plan's limit counts: paired phones/tablets plus connected browsers.
 * A browser eGuard disconnected for security (revokedAt) no longer takes a slot.
 */
export async function usedDeviceSlots(familyId: string) {
  const [devices, browsers] = await Promise.all([
    db.device.count({ where: { familyId } }),
    db.browserInstallation.count({ where: { familyId, revokedAt: null } }),
  ]);
  return devices + browsers;
}
