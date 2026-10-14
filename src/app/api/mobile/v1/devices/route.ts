import { NextResponse } from "next/server";
import { getFamily } from "@/lib/queries";
import { usedDeviceSlots } from "@/lib/device-slots";
import { authed } from "@/lib/mobile-api";
import { deviceJson, getFamilyGraph, refreshFamily } from "@/lib/mobile-views";

/** All family devices, primary first within each child. */
export const GET = authed(async ({ user }) => {
  await refreshFamily(user.familyId);
  const [family, graph, used] = await Promise.all([getFamily(user.familyId), getFamilyGraph(user.familyId), usedDeviceSlots(user.familyId)]);
  return NextResponse.json({
    devices: graph.devices.map((d) => deviceJson(d, graph, family.timezone)),
    limit: family.deviceLimit,
    // Slots the limit counts: these devices plus connected browsers, as pairing counts them
    used,
  });
});
