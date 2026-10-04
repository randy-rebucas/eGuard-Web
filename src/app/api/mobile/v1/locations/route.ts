import { NextResponse } from "next/server";
import { dayTime } from "@/lib/format";
import { getFamily } from "@/lib/queries";
import { authed } from "@/lib/mobile-api";
import { getFamilyGraph, photoVersions } from "@/lib/mobile-views";
import { photoUrl } from "@/lib/mobile-api";
import { childLocation, locationPolicy } from "@/lib/location";
import { listPlaces } from "@/lib/places";
import { requireLocationSharing } from "@/lib/plan-access";

/** Family map: each child's latest location, or why there isn't one, and the family's saved places. 403 `plan_required` on Free. */
export const GET = authed(async ({ user }) => {
  await requireLocationSharing(user.familyId);
  const [family, graph, places] = await Promise.all([getFamily(user.familyId), getFamilyGraph(user.familyId), listPlaces(user.familyId)]);
  const photos = await photoVersions(graph.children.map((c) => c.id));
  return NextResponse.json({
    children: graph.children.map((c) => {
      const l = childLocation(c.devices, Date.now(), locationPolicy(c.policies));
      return {
        childId: c.id, name: c.name, hue: c.hue, photoUrl: photoUrl(c.id, photos.get(c.id)),
        sharing: l.sharing,
        state: l.state,
        waitingForReport: l.unreported ? { deviceId: l.unreported.id, deviceName: l.unreported.name } : null,
        location: l.device && l.location ? {
          deviceId: l.device.id, deviceName: l.device.name, lat: l.location.lat, lng: l.location.lng, accuracyM: l.location.accuracyM,
          placeLabel: l.location.placeLabel, placeId: l.location.placeId, locatedAt: l.locatedAt, updatedLabel: dayTime(l.locatedAt, family.timezone),
          fresh: l.fresh, approximate: l.approximate,
        } : null,
      };
    }),
    places,
  });
});
