import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isPendingInvite } from "@/lib/auth";
import { getFamily } from "@/lib/queries";
import { authed, body } from "@/lib/mobile-api";
import { childrenJson, getFamilyGraph } from "@/lib/mobile-views";
import { entitlementsFor } from "@/lib/plans";
import { usedDeviceSlots } from "@/lib/device-slots";
import { FamilyNameSchema, renameFamily } from "@/lib/family-service";

async function familyJson(user: { id: string; familyId: string; role: string }) {
  const [family, graph, members, devicesUsed] = await Promise.all([
    getFamily(user.familyId),
    getFamilyGraph(user.familyId),
    db.user.findMany({
      where: { familyId: user.familyId }, orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, createdAt: true, passwordSet: true, emailVerifiedAt: true },
    }),
    usedDeviceSlots(user.familyId),
  ]);
  return {
    id: family.id, name: family.name, timezone: family.timezone,
    // pending: invited, hasn't accepted yet (can't sign in; resend with POST /family/members/{id}/invite)
    members: members.map(({ passwordSet: _p, emailVerifiedAt: _v, ...m }) => ({ ...m, you: m.id === user.id, pending: isPendingInvite({ role: m.role, passwordSet: _p, emailVerifiedAt: _v }) })),
    children: await childrenJson(graph, family.timezone),
    // deviceLimit counts browsers too: compare it with devicesUsed, not deviceCount (phones and tablets only)
    deviceCount: graph.devices.length, devicesUsed, deviceLimit: family.deviceLimit,
    childCount: graph.children.length, childLimit: entitlementsFor(family.plan).childLimit,
    plan: family.plan, entitlements: entitlementsFor(family.plan),
    canManage: user.role === "FAMILY_ADMIN",
  };
}

/** Settings › Family: parents, children and devices. */
export const GET = authed(async ({ user }) => NextResponse.json(await familyJson(user)));

const Body = z.object({ name: FamilyNameSchema });

/** Renames the family (admin only, 403 `forbidden` for other parents). */
export const PATCH = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  await renameFamily(user, b.name);
  return NextResponse.json(await familyJson(user));
});
