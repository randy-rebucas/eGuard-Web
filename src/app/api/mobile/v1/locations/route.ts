import { NextResponse } from "next/server";
import { dayTime } from "@/lib/format";
import { getFamily } from "@/lib/queries";
import { authed } from "@/lib/mobile-api";
import { getFamilyGraph, photoVersions } from "@/lib/mobile-views";
import { photoUrl } from "@/lib/mobile-api";

/** Family map: each child's latest location, or why there isn't one. */
export const GET = authed(async ({ user }) => {
  const [family, graph] = await Promise.all([getFamily(user.familyId), getFamilyGraph(user.familyId)]);
  const photos = await photoVersions(graph.children.map((c) => c.id));
  return NextResponse.json({
    children: graph.children.map((c) => {
      const fixes = c.devices.filter((d) => d.location?.sharing && d.location.lat != null)
        .sort((a, b) => (b.location!.locatedAt?.getTime() ?? 0) - (a.location!.locatedAt?.getTime() ?? 0));
      const d = fixes[0];
      const sharing = c.devices.some((x) => x.location?.sharing);
      return {
        childId: c.id, name: c.name, hue: c.hue, photoUrl: photoUrl(c.id, photos.get(c.id)),
        sharing,
        state: !c.devices.length ? "no_devices" : !sharing ? "sharing_off" : d ? "located" : "waiting",
        location: d ? {
          deviceId: d.id, deviceName: d.name, lat: d.location!.lat, lng: d.location!.lng, accuracyM: d.location!.accuracyM,
          placeLabel: d.location!.placeLabel, locatedAt: d.location!.locatedAt, updatedLabel: dayTime(d.location!.locatedAt, family.timezone),
        } : null,
      };
    }),
  });
});
