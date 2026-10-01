import { db } from "./db";
import { isOffline } from "./health";
import { isConfigured } from "./protections";
import { entitlementsFor } from "./plans";
import { pageByTime } from "./paging";

/** A new report within this distance of the last visit extends that visit instead of starting a new one. */
export const SAME_PLACE_M = 150;

/** A location younger than this, from a device that's online, is shown as live; older ones as "last seen". */
export const FRESH_MS = 15 * 60_000;
/** Fixes less precise than this (e.g. from cell towers) are shown as approximate. */
export const APPROXIMATE_M = 200;

type LocationRow = { sharing: boolean; lat: number | null; lng: number | null; accuracyM: number | null; placeLabel: string | null; locatedAt: Date | null; updatedAt: Date };
type LocationDevice = {
  id: string; name: string; lastSeenAt: Date | null;
  location: LocationRow | null;
  protections: { key: string; status: string; reported: unknown }[];
};

/**
 * Whether a device shares its location: its location record (kept in step with the LOCATION report by
 * processReport), else what its LOCATION protection last reported. null when it hasn't said either way.
 */
export function deviceSharing(d: LocationDevice): boolean | null {
  if (d.location) return d.location.sharing;
  const p = d.protections.find((x) => x.key === "LOCATION");
  if (!p || p.status === "UNSUPPORTED" || !p.reported) return null;
  return isConfigured(p.reported);
}

export type ChildLocationState = "located" | "waiting" | "sharing_off" | "no_devices";

/**
 * Where a child is, for the family map (web and mobile): the newest fix from a device that shares, whether
 * it's fresh enough to call live, or why there's no location (no devices, sharing off, waiting for a first fix).
 */
export function childLocation<D extends LocationDevice>(devices: D[], now = Date.now()) {
  const sharing = devices.filter((d) => deviceSharing(d) === true);
  const device = sharing
    .filter((d) => d.location?.lat != null && d.location.lng != null)
    .sort((a, b) => (b.location!.locatedAt ?? b.location!.updatedAt).getTime() - (a.location!.locatedAt ?? a.location!.updatedAt).getTime())[0] ?? null;
  const state: ChildLocationState = !devices.length ? "no_devices" : device ? "located" : sharing.length ? "waiting" : "sharing_off";
  const at = device ? device.location!.locatedAt ?? device.location!.updatedAt : null;
  return {
    state,
    sharing: sharing.length > 0,
    device,
    location: device?.location ?? null,
    locatedAt: at,
    /** Recent, and from a device that's still syncing: safe to call "live" */
    fresh: !!at && now - at.getTime() < FRESH_MS && !isOffline(device!, now),
    approximate: (device?.location?.accuracyM ?? 0) > APPROXIMATE_M,
    /** A device where the child (or a setting) turned sharing off, to name in "Sharing is off on …" */
    offDevice: devices.find((d) => deviceSharing(d) === false) ?? null,
  };
}

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * A child's kept visits (location history), newest first, `limit` at a time. Page with `before` = the previous
 * page's `nextBefore`. Callers check that the family keeps history; retention already pruned older visits.
 */
export async function visitsPage(childId: string, { before, limit }: { before?: Date; limit: number }) {
  const { rows, nextBefore } = await pageByTime(limit, (arrivedAt, take) => db.locationVisit.findMany({
    where: { childId, arrivedAt }, orderBy: [{ arrivedAt: "desc" }, { id: "desc" }], take, include: { device: { select: { name: true } } },
  }), (v) => v.arrivedAt, before);
  return { visits: rows, nextBefore };
}

/**
 * Each child's last few places in the past day, newest first (the Location page's "Recent places"). Fetched per
 * child: one shared cap let a child who moves around a lot crowd the others out ("No places" when there were some).
 */
export async function recentVisits(childIds: string[], perChild: number, now = Date.now()) {
  const rows = await Promise.all(childIds.map((childId) => db.locationVisit.findMany({
    where: { childId, lastSeenAt: { gte: new Date(now - 864e5) } },
    orderBy: { arrivedAt: "desc" }, take: perChild, select: { id: true, childId: true, placeLabel: true, arrivedAt: true },
  })));
  return rows.flat();
}

type Fix = { lat: number; lng: number; accuracyM?: number; placeLabel?: string };

/**
 * Stores the device's current location. When the family has turned on location history,
 * also records visits (arrive / still here) and prunes visits past the retention period.
 */
export async function recordLocation(device: { id: string; childId: string; familyId: string }, fix: Fix, now = new Date()) {
  // Whether sharing is on comes from the device's LOCATION protection report (engine.processReport), never
  // from a fix arriving. A fix sent while sharing is off isn't stored at all: the parent was told it's off.
  const [current, family] = await Promise.all([
    db.deviceLocation.findUnique({ where: { deviceId: device.id }, select: { sharing: true } }),
    db.family.findUniqueOrThrow({ where: { id: device.familyId }, select: { plan: true, keepLocationHistory: true, retentionDays: true } }),
  ]);
  if (current && !current.sharing) return;
  // Location sharing is a paid feature: on Free, fixes aren't kept at all
  if (!entitlementsFor(family.plan).locationSharing) return;
  // Each fix replaces the last one whole: a fix without a label or accuracy must not keep the previous place's
  // ("At school" shown for wherever the child is now)
  const latest = { lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM ?? null, placeLabel: fix.placeLabel ?? null, locatedAt: now };
  await db.deviceLocation.upsert({
    where: { deviceId: device.id },
    create: { deviceId: device.id, sharing: true, ...latest },
    update: latest,
  });
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
