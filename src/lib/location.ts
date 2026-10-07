import { db } from "./db";
import { isOffline } from "./health";
import { isConfigured } from "./protections";
import { entitlementsFor } from "./plans";
import { pageByTime } from "./paging";
import { clockTime, dateFormat, dayStart } from "./format";

/** YYYY-MM-DD in the family's time zone (as queries.dayKey, which can't be imported outside the server) */
const dayKey = (d: Date, tz: string) => dateFormat("en-CA", tz, { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** A new report within this distance of a visit extends that visit instead of starting a new one. */
export const SAME_PLACE_M = 150;

/**
 * A location younger than this, from a device that's online, is shown as live; older ones as "last seen".
 * Devices at rest send a fix every 15 minutes (child-app-spec §9): the margin keeps a resting child "live"
 * between fixes instead of flickering to "last seen" just before the next one arrives.
 */
export const FRESH_MS = 20 * 60_000;
/** Fixes less precise than this (e.g. from cell towers) are shown as approximate. */
export const APPROXIMATE_M = 200;

/**
 * A visit counts as a place the child stayed at once it spans this long, i.e. at least two fixes a sync apart
 * (devices sync every 5 minutes; a little under that allows for timing). Shorter ones were passed on the way.
 */
export const STAY_MS = 4 * 60_000;
/** Another of the child's devices' visit still counts as "where the child is now" this long after its last fix. */
const OPEN_VISIT_MS = 30 * 60_000;


type LocationRow = { sharing: boolean; lat: number | null; lng: number | null; accuracyM: number | null; placeLabel: string | null; placeId?: string | null; locatedAt: Date | null; updatedAt: Date };
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

/** The parent's location setting for a child (from their policies), or undefined when there's none. */
export function locationPolicy(policies: { key: string; config: unknown }[]): boolean | undefined {
  const p = policies.find((x) => x.key === "LOCATION");
  return p ? !!(p.config as { sharing?: boolean } | null)?.sharing : undefined;
}

export type ChildLocationState = "located" | "waiting" | "sharing_off" | "no_devices";

/**
 * Where a child is, for the family map (web and mobile): the newest fix from a device that shares, whether
 * it's fresh enough to call live, or why there's no location (no devices, sharing off, waiting for a first fix).
 *
 * `policy` is the parent's LOCATION setting for the child (`locationPolicy`). A device that hasn't reported
 * whether it shares is "waiting" for that report, unless the parent's setting is off: it isn't "sharing off"
 * before anything said so.
 */
export function childLocation<D extends LocationDevice>(devices: D[], now = Date.now(), policy?: boolean) {
  const sharing = devices.filter((d) => deviceSharing(d) === true);
  const offDevice = devices.find((d) => deviceSharing(d) === false) ?? null;
  const unreported = !sharing.length && !offDevice && policy !== false ? devices.find((d) => deviceSharing(d) === null) ?? null : null;
  const device = sharing
    .filter((d) => d.location?.lat != null && d.location.lng != null)
    .sort((a, b) => (b.location!.locatedAt ?? b.location!.updatedAt).getTime() - (a.location!.locatedAt ?? a.location!.updatedAt).getTime())[0] ?? null;
  const state: ChildLocationState = !devices.length ? "no_devices" : device ? "located" : sharing.length || unreported ? "waiting" : "sharing_off";
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
    offDevice,
    /** When waiting only because no device has reported yet: the device to name in "Waiting for … to report" */
    unreported,
  };
}

/** The "waiting" line for a child: a first fix, or a first report of whether sharing is on. */
export const waitingText = (l: { sharing: boolean; unreported: { name: string } | null }) =>
  l.sharing || !l.unreported ? "Sharing is on. Waiting for the first location from the device." : `Waiting for ${l.unreported.name} to report whether location sharing is on.`;

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The nearest saved place `at` falls inside, or null. */
export function placeFor<P extends { lat: number; lng: number; radiusM: number }>(places: P[], at: { lat: number; lng: number }): P | null {
  let best: P | null = null, bestD = Infinity;
  for (const p of places) {
    const d = distanceM(p, at);
    if (d <= p.radiusM && d < bestD) [best, bestD] = [p, d];
  }
  return best;
}

/** GPS wobbles: a device at a place's edge isn't counted as leaving until a fix is clearly outside it. */
export const LEAVE_MARGIN_M = 50;
/** One arrive or leave notice per child, place and direction in this window (a phone and a tablet arriving together). */
export const PLACE_ALERT_WINDOW_MS = 30 * 60_000;

/**
 * Where a fix puts a device, given the saved place its last fix was at. Inside a place: that place (the nearest).
 * Just outside the place it was at (within LEAVE_MARGIN_M, or the fix's accuracy if rougher): still there, so
 * wobble at the edge isn't read as leaving and arriving again. `arrived` / `left` say what changed.
 */
export function placeMove<P extends { id: string; lat: number; lng: number; radiusM: number }>(places: P[], prevId: string | null | undefined, fix: { lat: number; lng: number; accuracyM?: number }) {
  const inside = placeFor(places, fix);
  const prev = prevId ? places.find((p) => p.id === prevId) ?? null : null;
  const near = prev && !inside && distanceM(prev, fix) <= prev.radiusM + Math.max(LEAVE_MARGIN_M, fix.accuracyM ?? 0) ? prev : null;
  const place = inside ?? near;
  return { place, arrived: place && place.id !== prev?.id ? place : null, left: prev && place?.id !== prev.id ? prev : null };
}

/** Whether a visit lasted (the child stayed there), as opposed to a fix taken while passing by. */
export const stayed = (v: { arrivedAt: Date; lastSeenAt: Date }) => v.lastSeenAt.getTime() - v.arrivedAt.getTime() >= STAY_MS;

/** "45 min", "6 h 30 min", "2 days 3 h" */
export function durationLabel(ms: number) {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), rest = m % 60;
  if (h < 24) return rest ? `${h} h ${rest} min` : `${h} h`;
  const d = Math.floor(h / 24), rh = h % 24;
  return `${d} day${d > 1 ? "s" : ""}${rh ? ` ${rh} h` : ""}`;
}

/**
 * When a visit was, in the family's time zone: "9:10 AM – 3:40 PM · 6 h 30 min", "11:00 PM – 7:00 AM next day · 8 h",
 * or one time for a fix taken while passing by.
 */
export function visitSpan(v: { arrivedAt: Date; lastSeenAt: Date }, tz: string) {
  const from = clockTime(v.arrivedAt, tz), to = clockTime(v.lastSeenAt, tz);
  if (!stayed(v)) return from;
  const days = Math.round((Date.parse(dayKey(v.lastSeenAt, tz)) - Date.parse(dayKey(v.arrivedAt, tz))) / 864e5);
  const end = days === 0 ? to : days === 1 ? `${to} next day` : `${to}, ${days} days later`;
  return `${from} – ${end} · ${durationLabel(v.lastSeenAt.getTime() - v.arrivedAt.getTime())}`;
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

/** A real calendar day, YYYY-MM-DD ("2026-02-30" matches the pattern but isn't one) */
export const isDayKey = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/** The day key `n` days after `k` (negative for before) */
export const shiftDay = (k: string, n: number) => new Date(Date.parse(`${k}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Most visits one day view shows; a phone reporting every few minutes while moving stays well under it */
export const DAY_VISITS_MAX = 300;

/**
 * One child's visits on a day (YYYY-MM-DD in the family's time zone), oldest first: the day's route.
 * A visit that spans midnight belongs to both days.
 */
export function visitsForDay(childId: string, day: string, tz: string) {
  return db.locationVisit.findMany({
    where: { childId, arrivedAt: { lt: dayStart(shiftDay(day, 1), tz) }, lastSeenAt: { gte: dayStart(day, tz) } },
    orderBy: [{ arrivedAt: "asc" }, { id: "asc" }], take: DAY_VISITS_MAX, include: { device: { select: { name: true } } },
  });
}

/**
 * Each child's last few places they stayed at in the past day, newest first (the Location page's "Recent places").
 * Fixes taken while passing by are left out. Fetched per child: one shared cap let a child who moves around a lot
 * crowd the others out ("No places" when there were some).
 */
export async function recentVisits(childIds: string[], perChild: number, now = Date.now()) {
  const rows = await Promise.all(childIds.map(async (childId) => (await db.locationVisit.findMany({
    where: { childId, lastSeenAt: { gte: new Date(now - 864e5) } },
    // Generous: drive-by fixes are filtered out below, and a day rarely has more than a few dozen visits
    orderBy: { arrivedAt: "desc" }, take: 50, select: { id: true, childId: true, placeLabel: true, arrivedAt: true, lastSeenAt: true },
  })).filter(stayed).slice(0, perChild)));
  return rows.flat();
}

type Fix = { lat: number; lng: number; accuracyM?: number; placeLabel?: string };
type NoticePlace = { id: string; name: string; notifyArrive: boolean; notifyLeave: boolean };

/**
 * "Mia arrived at School" / "Mia left Home", for places the parents turned notices on for. INFO, so it never
 * counts as something waiting for them, but emailed and pushed like other alerts (`PLACE:` in maintenance.worthEmail).
 * One per child, place and direction in PLACE_ALERT_WINDOW_MS, whichever of the child's devices gets there first.
 */
async function placeNotices(device: { id: string; childId: string; familyId: string }, move: { arrived: NoticePlace | null; left: NoticePlace | null }, tz: string, now: Date) {
  const notices = [
    move.left?.notifyLeave ? { place: move.left, kind: "LEAVE" as const } : null,
    move.arrived?.notifyArrive ? { place: move.arrived, kind: "ARRIVE" as const } : null,
  ].filter((n) => n !== null);
  if (!notices.length) return;
  // Loaded only when there's a notice to raise: the engine is server-only, and this module isn't
  const { createAlertUnless } = await import("./engine");
  const d = await db.device.findUniqueOrThrow({ where: { id: device.id }, select: { name: true, child: { select: { name: true } } } });
  for (const { place, kind } of notices) {
    const resolveKey = `PLACE:${place.id}:${kind}`;
    const did = kind === "ARRIVE" ? "arrived at" : "left";
    await createAlertUnless(`PLACE:${device.childId}:${place.id}:${kind}`,
      { familyId: device.familyId, childId: device.childId, resolveKey, createdAt: { gt: new Date(now.getTime() - PLACE_ALERT_WINDOW_MS) } },
      {
        familyId: device.familyId, childId: device.childId, deviceId: device.id, severity: "INFO", category: "LOCATION",
        icon: kind === "ARRIVE" ? "map-pin" : "route", title: `${d.child.name} ${did} ${place.name}`,
        body: `${d.child.name} ${did} ${place.name} at ${clockTime(now, tz)}.`, subject: `${place.name} · ${d.child.name}'s ${d.name}`,
        resolveKey, createdAt: now,
      });
  }
}
type VisitRow = { id: string; deviceId: string | null; lat: number; lng: number; placeLabel: string | null; placeId: string | null; lastSeenAt: Date };

/**
 * Stores the device's current location. When the family has turned on location history,
 * also records visits (arrive / still here) and prunes visits past the retention period.
 * A fix inside one of the family's saved places is labelled with its name (it wins over a label from the device).
 * Arriving at or leaving a place the parents asked to hear about raises a notice (placeMove).
 */
export async function recordLocation(device: { id: string; childId: string; familyId: string }, fix: Fix, now = new Date()) {
  // Whether sharing is on comes from the device's LOCATION protection report (engine.processReport), never
  // from a fix arriving. A fix sent while sharing is off isn't stored at all: the parent was told it's off.
  const [current, family, places] = await Promise.all([
    db.deviceLocation.findUnique({ where: { deviceId: device.id }, select: { sharing: true, placeId: true, locatedAt: true } }),
    db.family.findUniqueOrThrow({ where: { id: device.familyId }, select: { plan: true, keepLocationHistory: true, retentionDays: true, timezone: true } }),
    db.place.findMany({ where: { familyId: device.familyId }, select: { id: true, name: true, lat: true, lng: true, radiusM: true, notifyArrive: true, notifyLeave: true } }),
  ]);
  if (current && !current.sharing) return;
  // Location sharing is a paid feature: on Free, fixes aren't kept at all
  if (!entitlementsFor(family.plan).locationSharing) return;
  const move = placeMove(places, current?.placeId, fix);
  const place = move.place;
  // The device's first fix isn't a move: there's no "before" to have arrived from
  if (current?.locatedAt) await placeNotices(device, move, family.timezone, now);
  const label = place?.name ?? fix.placeLabel ?? null;
  // Each fix replaces the last one whole: a fix without a label or accuracy must not keep the previous place's
  // ("At school" shown for wherever the child is now)
  const latest = { lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM ?? null, placeLabel: label, placeId: place?.id ?? null, locatedAt: now };
  await db.deviceLocation.upsert({
    where: { deviceId: device.id },
    create: { deviceId: device.id, sharing: true, ...latest },
    update: latest,
  });
  if (!family.keepLocationHistory) return;

  // The same place as this device's last visit, or as a visit another of the child's devices is at right now
  // (a phone and a tablet both at home make one visit, not two)
  const [own, others] = await Promise.all([
    db.locationVisit.findFirst({ where: { deviceId: device.id }, orderBy: { arrivedAt: "desc" } }),
    db.locationVisit.findMany({ where: { childId: device.childId, NOT: { deviceId: device.id }, lastSeenAt: { gte: new Date(now.getTime() - OPEN_VISIT_MS) } }, orderBy: { lastSeenAt: "desc" } }),
  ]);
  const samePlace = (v: VisitRow) => (place != null && v.placeId === place.id)
    || (distanceM(v, fix) <= SAME_PLACE_M && (!label || !v.placeLabel || label === v.placeLabel));
  const match = [own, ...others].find((v): v is NonNullable<typeof own> => !!v && samePlace(v));
  if (match) {
    await db.locationVisit.update({
      where: { id: match.id },
      data: { lastSeenAt: now > match.lastSeenAt ? now : match.lastSeenAt, placeLabel: match.placeLabel ?? label, placeId: match.placeId ?? place?.id ?? null },
    });
  } else {
    await db.locationVisit.create({
      data: { deviceId: device.id, childId: device.childId, lat: fix.lat, lng: fix.lng, placeLabel: label, placeId: place?.id ?? null, arrivedAt: now, lastSeenAt: now },
    });
  }
  await db.locationVisit.deleteMany({ where: { childId: device.childId, arrivedAt: { lt: new Date(now.getTime() - family.retentionDays * 864e5) } } });
}
