import { NextResponse } from "next/server";
import { getAlerts, getFamily, unreadCount } from "@/lib/queries";
import { greeting } from "@/lib/format";
import { meJson } from "@/lib/mobile-account";
import { authed } from "@/lib/mobile-api";
import { alertJson, childrenJson, getFamilyGraph, healthLabel, refreshFamily } from "@/lib/mobile-views";

/** Home tab: greeting, Family Protection score, children, recent alerts. */
export const GET = authed(async ({ user }) => {
  await refreshFamily(user.familyId);
  const [me, family, graph, alerts, unread] = await Promise.all([
    meJson(user.id), getFamily(user.familyId), getFamilyGraph(user.familyId), getAlerts(user.familyId, user.id, { take: 3 }), unreadCount(user.familyId, user.id),
  ]);
  const { score, total, offline, verified } = graph.familyHealth;
  const needsAttention = graph.children.filter((c) => c.status === "attention").length;
  return NextResponse.json({
    user: me,
    greeting: greeting(family.timezone),
    summary: !graph.children.length ? "Add your first child to get started."
      : needsAttention ? `${needsAttention} ${needsAttention === 1 ? "child needs" : "children need"} attention.`
      : "Your family's digital safety looks good today.",
    health: { score, total, offline, verified, label: healthLabel(score, total, offline) },
    children: await childrenJson(graph, family.timezone),
    deviceCount: graph.devices.length,
    recentAlerts: alerts.map((a) => alertJson(a, family.timezone)),
    unreadAlerts: unread,
  });
});
