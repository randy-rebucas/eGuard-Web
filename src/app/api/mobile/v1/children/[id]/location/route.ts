import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { childFor } from "@/lib/config-service";
import { dayStart, dayTime } from "@/lib/format";
import { dayKey, getFamily } from "@/lib/queries";
import { authed } from "@/lib/mobile-api";
import { visitJson } from "@/lib/mobile-views";
import { childLocation, deviceSharing, locationPolicy, shiftDay } from "@/lib/location";
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

  // Visits that were going on yesterday or today, as the web's day view counts them: a child home since
  // Friday is still at home on Sunday's list (picking by arrival left it empty)
  const shown = family.keepLocationHistory
    ? await db.locationVisit.findMany({
      where: { childId: child.id, lastSeenAt: { gte: dayStart(shiftDay(dayKey(new Date(), tz), -1), tz) } },
      orderBy: [{ arrivedAt: "desc" }, { id: "desc" }], take: VISITS_SHOWN + 1, include: { device: { select: { name: true } } },
    })
    : [];

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
