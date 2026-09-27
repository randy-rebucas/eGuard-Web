import { db } from "./db";

/** A new report within this distance of the last visit extends that visit instead of starting a new one. */
export const SAME_PLACE_M = 150;

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Fix = { lat: number; lng: number; accuracyM?: number; placeLabel?: string };

/**
 * Stores the device's current location. When the family has turned on location history,
 * also records visits (arrive / still here) and prunes visits past the retention period.
 */
export async function recordLocation(device: { id: string; childId: string; familyId: string }, fix: Fix, now = new Date()) {
  await db.deviceLocation.upsert({
    where: { deviceId: device.id },
    create: { deviceId: device.id, sharing: true, locatedAt: now, ...fix },
    update: { sharing: true, locatedAt: now, ...fix },
  });
  const family = await db.family.findUniqueOrThrow({ where: { id: device.familyId }, select: { keepLocationHistory: true, retentionDays: true } });
  if (!family.keepLocationHistory) return;

  const last = await db.locationVisit.findFirst({ where: { deviceId: device.id }, orderBy: { arrivedAt: "desc" } });
  const samePlace = last && distanceM(last, fix) <= SAME_PLACE_M && (!fix.placeLabel || !last.placeLabel || fix.placeLabel === last.placeLabel);
  if (last && samePlace) {
    await db.locationVisit.update({ where: { id: last.id }, data: { lastSeenAt: now, placeLabel: last.placeLabel ?? fix.placeLabel ?? null } });
  } else {
    await db.locationVisit.create({
      data: { deviceId: device.id, childId: device.childId, lat: fix.lat, lng: fix.lng, placeLabel: fix.placeLabel ?? null, arrivedAt: now, lastSeenAt: now },
    });
  }
  await db.locationVisit.deleteMany({ where: { childId: device.childId, arrivedAt: { lt: new Date(now.getTime() - family.retentionDays * 864e5) } } });
}
