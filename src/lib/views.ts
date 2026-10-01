import "server-only";
import { db } from "./db";
import { ago, dayLabel, dayTime } from "./format";
import { childLocation } from "./location";
import { isDismissible } from "./health";
import { appMinutesOn, dateFromKey, dayKey, getScreenTime, limitOn, type FamilyGraph } from "./queries";
import { alertAction } from "@/components/cards";
import type { AlertItem } from "@/components/alerts";
import type { ActivityChild, Series } from "@/components/charts";

type AlertRowDb = Awaited<ReturnType<typeof import("./queries").getAlerts>>[number];

export function toAlertItem(a: AlertRowDb, tz: string): AlertItem {
  return {
    id: a.id, icon: a.icon, title: a.title, body: a.body, subject: a.subject, severity: a.severity,
    time: ago(a.createdAt, tz), read: a.read, resolved: !!a.resolvedAt, dismissible: isDismissible(a), fromValue: a.fromValue, toValue: a.toValue,
    action: alertAction(a),
  };
}

/** Week-over-week series for the trend chart (last 7 days vs the 7 before). */
export async function weeklySeries(familyId: string, tz: string, graph: FamilyGraph, childIds?: string[]) {
  const st = await getScreenTime(familyId, tz, 14);
  const days = st.days.slice(7).map(dayLabel);
  const kids = graph.children.filter((c) => !childIds || childIds.includes(c.id));
  const series: Series[] = kids.map((c) => {
    const all = st.byChild[c.id] ?? Array(14).fill(0);
    return { id: c.id, name: c.name, hue: c.hue, limits: st.days.slice(7).map((k) => limitOn(c, k)), last: all.slice(0, 7), week: all.slice(7) };
  });
  return { series, days, range: dayRange(st.days[7], st.days[13]), byChild: st.byChild };
}

/** "Sep 3 – 9", or "Sep 25 – Oct 1" when the range crosses a month. */
export function dayRange(fromKey: string, toKey: string) {
  const from = dayLabel(fromKey).date, to = dayLabel(toKey).date;
  return from.split(" ")[0] === to.split(" ")[0] ? `${from} – ${to.split(" ")[1]}` : `${from} – ${to}`;
}

/** Why a child's location can or can't be shown today. */
export function locationOf(c: FamilyGraph["children"][number], included: boolean, tz: string): ActivityChild["location"] {
  if (!included) return { state: "plan", place: null, updated: null };
  const l = childLocation(c.devices);
  if (l.state === "located") return { state: "available", place: l.location!.placeLabel ?? null, updated: ago(l.locatedAt, tz) };
  return { state: l.state === "no_devices" ? "nodevice" : l.state === "waiting" ? "waiting" : "off", place: null, updated: null };
}

/** Today's activity per child. */
export async function todayActivity(graph: FamilyGraph, tz: string, opts: { locationSharing: boolean }): Promise<ActivityChild[]> {
  const todayKey = dayKey(new Date(), tz), today = dateFromKey(todayKey);
  const [usage, apps] = await Promise.all([
    db.screenTimeDaily.groupBy({ by: ["childId"], where: { childId: { in: graph.children.map((c) => c.id) }, date: today }, _sum: { minutes: true } }),
    appMinutesOn(graph.children.map((c) => c.id), today),
  ]);
  return graph.children.map((c) => {
    const childApps = apps.filter((a) => a.childId === c.id);
    const top = childApps.filter((a) => a.app !== "Others").slice(0, 3).map((a) => [a.app, a.minutes] as [string, number]);
    const rest = childApps.reduce((s, a) => s + a.minutes, 0) - top.reduce((s, [, m]) => s + m, 0);
    return {
      id: c.id, name: c.name, hue: c.hue, deviceName: c.primary?.name ?? "No device",
      used: usage.find((u) => u.childId === c.id)?._sum.minutes ?? 0,
      limit: limitOn(c, todayKey),
      apps: rest > 0 ? [...top, ["Others", rest]] : top,
      location: locationOf(c, opts.locationSharing, tz),
      devices: c.devices.map((d) => ({ id: d.id, name: d.name, state: graph.deviceStates[d.id].key, issues: graph.deviceStates[d.id].issues })),
    };
  });
}

export const syncLabel = (d: Date | null, tz: string) => dayTime(d, tz);
