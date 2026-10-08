import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAlerts, getFamily, unreadCount } from "@/lib/queries";
import { greeting } from "@/lib/format";
import { meJson } from "@/lib/mobile-account";
import { authed } from "@/lib/mobile-api";
import { alertJson, childrenJson, getFamilyGraph, healthLabel, refreshFamily } from "@/lib/mobile-views";

/** Home tab: greeting, Family Protection score, children, recent alerts. */
export const GET = authed(async ({ user }) => {
  await refreshFamily(user.familyId);
  const [me, family, graph, alerts, unread, browserCount] = await Promise.all([
    meJson(user.id), getFamily(user.familyId), getFamilyGraph(user.familyId), getAlerts(user.familyId, user.id, { take: 3, bySeverity: true }), unreadCount(user.familyId, user.id),
    // Connected browser extensions: like the web's Devices card, they take a device slot (one disconnected for security doesn't)
    db.browserInstallation.count({ where: { familyId: user.familyId, revokedAt: null } }),
  ]);
  const { score, total, offline, verified } = graph.familyHealth;
  const needsAttention = graph.children.filter((c) => c.status === "attention").length;
  // A child with no paired device isn't protected, so the family can't "look good" yet (same rule as the web dashboard)
  const unpaired = graph.children.filter((c) => !c.devices.length);
  return NextResponse.json({
    user: me,
    greeting: greeting(family.timezone),
    summary: !graph.children.length ? "Add your first child to get started."
      : needsAttention ? `${needsAttention} ${needsAttention === 1 ? "child needs" : "children need"} attention.`
      : unpaired.length ? (unpaired.length === 1 ? `Pair ${unpaired[0].name}'s device to start protecting them.` : `${unpaired.length} children have no paired device yet.`)
      : "Your family's digital safety looks good today.",
    health: { score, total, offline, verified, label: healthLabel(score, total, offline, graph.devices.length) },
    children: await childrenJson(graph, family.timezone),
    deviceCount: graph.devices.length,
    browserCount,
    recentAlerts: alerts.map((a) => alertJson(a, family.timezone)),
    unreadAlerts: unread,
  });
});
