import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFamily } from "@/lib/queries";
import { authed } from "@/lib/mobile-api";
import { childrenJson, getFamilyGraph } from "@/lib/mobile-views";
import { entitlementsFor } from "@/lib/plans";

/** Settings › Family: parents, children and devices. */
export const GET = authed(async ({ user }) => {
  const [family, graph, members] = await Promise.all([
    getFamily(user.familyId),
    getFamilyGraph(user.familyId),
    db.user.findMany({ where: { familyId: user.familyId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, role: true, createdAt: true } }),
  ]);
  return NextResponse.json({
    id: family.id, name: family.name, timezone: family.timezone,
    members: members.map((m) => ({ ...m, you: m.id === user.id })),
    children: await childrenJson(graph, family.timezone),
    deviceCount: graph.devices.length, deviceLimit: family.deviceLimit,
    childCount: graph.children.length, childLimit: entitlementsFor(family.plan).childLimit,
    plan: family.plan, entitlements: entitlementsFor(family.plan),
    canManage: user.role === "FAMILY_ADMIN",
  });
});
