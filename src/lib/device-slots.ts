import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

type Client = Prisma.TransactionClient | typeof db;

/**
 * Devices the plan's limit counts: paired phones/tablets plus connected browsers.
 * A browser eGuard disconnected for security (revokedAt) no longer takes a slot.
 */
export async function usedDeviceSlots(familyId: string, client: Client = db) {
  const devices = await client.device.count({ where: { familyId } });
  const browsers = await client.browserInstallation.count({ where: { familyId, revokedAt: null } });
  return devices + browsers;
}

/**
 * Runs `create` only if the family has a free slot, or returns null when the plan is full. Count and create run
 * under one per-family lock, so two devices (or a device and a browser) pairing at once can't both take the last slot.
 */
export function withDeviceSlot<T>(familyId: string, limit: number, create: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T | null> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`device.slot:${familyId}`}))`;
    if ((await usedDeviceSlots(familyId, tx)) >= limit) return null;
    return create(tx);
  });
}
