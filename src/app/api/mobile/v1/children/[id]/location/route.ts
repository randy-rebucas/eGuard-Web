import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { childFor } from "@/lib/config-service";
import { dayTime } from "@/lib/format";
import { getFamily } from "@/lib/queries";
import { authed } from "@/lib/mobile-api";
import { dayGroup } from "@/lib/mobile-views";

/**
 * Location: where the child is now, and today's and yesterday's visits when the family keeps
 * location history (`history.enabled`). Turn sharing on or off with PUT /protections/LOCATION.
 */
export const GET = authed<{ id: string }>(async ({ user, params }) => {
  const child = await childFor(user.familyId, params.id);
  const family = await getFamily(user.familyId);
  const tz = family.timezone;
  const devices = await db.device.findMany({ where: { childId: child.id }, include: { location: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });
  const sharing = devices.some((d) => d.location?.sharing);
  const withFix = devices
    .filter((d) => d.location?.sharing && d.location.lat != null && d.location.lng != null)
    .sort((a, b) => (b.location!.locatedAt?.getTime() ?? 0) - (a.location!.locatedAt?.getTime() ?? 0));
  const latest = withFix[0];

  // 72 hours always covers "yesterday" in the family's time zone; the day filter below trims the rest
  const visits = family.keepLocationHistory
    ? await db.locationVisit.findMany({ where: { childId: child.id, arrivedAt: { gte: new Date(Date.now() - 72 * 3600_000) } }, orderBy: { arrivedAt: "desc" }, include: { device: { select: { name: true } } } })
    : [];
  const shown = visits.filter((v) => ["Today", "Yesterday"].includes(dayGroup(v.arrivedAt, tz).label));

  return NextResponse.json({
    childId: child.id,
    sharing,
    current: latest ? {
      deviceId: latest.id, deviceName: latest.name,
      lat: latest.location!.lat, lng: latest.location!.lng, accuracyM: latest.location!.accuracyM,
      placeLabel: latest.location!.placeLabel,
      locatedAt: latest.location!.locatedAt, updatedLabel: dayTime(latest.location!.locatedAt, tz),
    } : null,
    devices: devices.map((d) => ({ id: d.id, name: d.name, sharing: !!d.location?.sharing, hasLocation: d.location?.lat != null })),
    history: {
      enabled: family.keepLocationHistory,
      visits: shown.map((v) => ({
        id: v.id, deviceName: v.device.name, lat: v.lat, lng: v.lng, placeLabel: v.placeLabel,
        arrivedAt: v.arrivedAt, lastSeenAt: v.lastSeenAt, timeLabel: dayTime(v.arrivedAt, tz), day: dayGroup(v.arrivedAt, tz),
      })),
    },
  });
});
