import "server-only";
import { db } from "./db";
import { ago, dayLabel, dayTime } from "./format";
import { appMinutesOn, dateFromKey, dayKey, getScreenTime, type FamilyGraph } from "./queries";
import { alertAction } from "@/components/cards";
import type { AlertItem } from "@/components/alerts";
import type { ActivityChild, Series } from "@/components/charts";

type AlertRowDb = Awaited<ReturnType<typeof import("./queries").getAlerts>>[number];

export function toAlertItem(a: AlertRowDb, tz: string): AlertItem {
  return {
    id: a.id, icon: a.icon, title: a.title, body: a.body, subject: a.subject, severity: a.severity,
    time: ago(a.createdAt, tz), read: a.read, resolved: !!a.resolvedAt, fromValue: a.fromValue, toValue: a.toValue,
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
    return { id: c.id, name: c.name, hue: c.hue, limit: c.dailyLimitMinutes, last: all.slice(0, 7), week: all.slice(7) };
  });
  const first = st.days[7], lastDay = st.days[13];
  return { series, days, range: `${dayLabel(first).date} – ${dayLabel(lastDay).date.split(" ")[1]}`, byChild: st.byChild };
}

/** Today's activity per child. */
export async function todayActivity(graph: FamilyGraph, tz: string): Promise<ActivityChild[]> {
  const today = dateFromKey(dayKey(new Date(), tz));
  const [usage, apps] = await Promise.all([
    db.screenTimeDaily.groupBy({ by: ["childId"], where: { childId: { in: graph.children.map((c) => c.id) }, date: today }, _sum: { minutes: true } }),
    appMinutesOn(graph.children.map((c) => c.id), today),
  ]);
  return graph.children.map((c) => {
    const loc = c.devices.map((d) => d.location).find((l) => l?.sharing && l.lat != null);
    const anySharing = c.devices.some((d) => d.location?.sharing);
    const childApps = apps.filter((a) => a.childId === c.id);
    const top = childApps.filter((a) => a.app !== "Others").slice(0, 3).map((a) => [a.app, a.minutes] as [string, number]);
    const rest = childApps.reduce((s, a) => s + a.minutes, 0) - top.reduce((s, [, m]) => s + m, 0);
    return {
      id: c.id, name: c.name, hue: c.hue, deviceName: c.primary?.name ?? "No device",
      used: usage.find((u) => u.childId === c.id)?._sum.minutes ?? 0,
      limit: c.dailyLimitMinutes,
      apps: rest > 0 ? [...top, ["Others", rest]] : top,
      location: { available: !!loc && anySharing, place: loc?.placeLabel ?? null, updated: loc ? ago((loc.locatedAt ?? loc.updatedAt), tz) : null },
      devices: c.devices.map((d) => ({ name: d.name, state: graph.deviceStates[d.id].key, issues: graph.deviceStates[d.id].issues })),
    };
  });
}

export const syncLabel = (d: Date | null, tz: string) => dayTime(d, tz);
