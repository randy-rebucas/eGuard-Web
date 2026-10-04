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
    await lockSlots(tx, familyId);
    if ((await usedDeviceSlots(familyId, tx)) >= limit) return null;
    return create(tx);
  });
}

const lockSlots = (tx: Prisma.TransactionClient, familyId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`device.slot:${familyId}`}))`;

/**
 * Runs `fn` in a transaction holding the family's device lock: the one pairing takes, which also decides each
 * child's primary device. Use it for anything that changes which child a device belongs to, or which is primary.
 */
export function withDeviceLock<T>(familyId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await lockSlots(tx, familyId);
    return fn(tx);
  });
}

/** Inside withDeviceLock: makes the child's oldest device primary if none is. */
export async function promoteOldest(tx: Prisma.TransactionClient, childId: string) {
  if (await tx.device.count({ where: { childId, isPrimary: true } })) return;
  const oldest = await tx.device.findFirst({ where: { childId }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (oldest) await tx.device.update({ where: { id: oldest.id }, data: { isPrimary: true } });
}

/**
 * Makes the child's oldest device primary if none is (after the primary was removed), so they don't go without one
 * and the next device paired doesn't jump ahead of older ones.
 */
export function ensurePrimary(familyId: string, childId: string) {
  return withDeviceLock(familyId, (tx) => promoteOldest(tx, childId));
}

/** Makes `deviceId` its child's only primary device. False if it isn't (any longer) that child's device. */
export function makePrimary(familyId: string, childId: string, deviceId: string) {
  return withDeviceLock(familyId, async (tx) => {
    if (!(await tx.device.count({ where: { id: deviceId, childId, familyId } }))) return false;
    await tx.device.updateMany({ where: { childId, isPrimary: true, id: { not: deviceId } }, data: { isPrimary: false } });
    await tx.device.update({ where: { id: deviceId }, data: { isPrimary: true } });
    return true;
  });
}
