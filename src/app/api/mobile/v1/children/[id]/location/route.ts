import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { childFor } from "@/lib/config-service";
import { dayTime } from "@/lib/format";
import { getFamily } from "@/lib/queries";
import { authed } from "@/lib/mobile-api";
import { dayGroup, visitJson } from "@/lib/mobile-views";
import { childLocation, deviceSharing, locationPolicy } from "@/lib/location";
import { requireLocationSharing } from "@/lib/plan-access";

/** Today's and yesterday's visits are listed up to this many; "View All" (/location/visits) pages the rest. */
const VISITS_SHOWN = 100;

/**
 * Location: where the child is now, and today's and yesterday's visits when the family keeps
 * location history (`history.enabled`). Turn sharing on or off with PUT /protections/LOCATION.
 * 403 `plan_required` on plans without location sharing (Free).
 */
export const GET = authed<{ id: string }>(async ({ user, params }) => {
  const child = await childFor(user.familyId, params.id);
  await requireLocationSharing(user.familyId);
  const family = await getFamily(user.familyId);
  const tz = family.timezone;
  const [devices, policies] = await Promise.all([
    db.device.findMany({
      where: { childId: child.id }, include: { location: true, protections: { where: { key: "LOCATION" } } }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    }),
    db.childPolicy.findMany({ where: { childId: child.id, key: "LOCATION" }, select: { key: true, config: true } }),
  ]);
  const l = childLocation(devices, Date.now(), locationPolicy(policies));
  const latest = l.device;

  // 72 hours always covers "yesterday" in the family's time zone; the day filter below trims the rest
  const visits = family.keepLocationHistory
    ? await db.locationVisit.findMany({ where: { childId: child.id, arrivedAt: { gte: new Date(Date.now() - 72 * 3600_000) } }, orderBy: { arrivedAt: "desc" }, include: { device: { select: { name: true } } } })
    : [];
  const shown = visits.filter((v) => ["Today", "Yesterday"].includes(dayGroup(v.arrivedAt, tz).label));

  return NextResponse.json({
    childId: child.id,
    sharing: l.sharing,
    state: l.state,
    waitingForReport: l.unreported ? { deviceId: l.unreported.id, deviceName: l.unreported.name } : null,
    current: latest ? {
      deviceId: latest.id, deviceName: latest.name,
      lat: latest.location!.lat, lng: latest.location!.lng, accuracyM: latest.location!.accuracyM,
      placeLabel: latest.location!.placeLabel, placeId: latest.location!.placeId,
      locatedAt: l.locatedAt, updatedLabel: dayTime(l.locatedAt, tz), fresh: l.fresh, approximate: l.approximate,
    } : null,
    devices: devices.map((d) => ({ id: d.id, name: d.name, sharing: deviceSharing(d) === true, hasLocation: d.location?.lat != null })),
    history: {
      enabled: family.keepLocationHistory,
      visits: shown.slice(0, VISITS_SHOWN).map((v) => visitJson(v, tz)),
      more: shown.length > VISITS_SHOWN,
    },
  });
});
