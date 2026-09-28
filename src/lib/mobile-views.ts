import "server-only";
import type { Alert, AlertCategory, ProtectionKey } from "@prisma/client";
import { db } from "./db";
import { dayTime } from "./format";
import { appMinutesOn, dateFromKey, dayKey, getFamilyGraph, lastNDays, limitOn, type ChildView, type DeviceView, type FamilyGraph } from "./queries";
import { PROTECTION_BY_KEY, describeConfig, type ProtectionConfig } from "./protections";
import { photoUrl } from "./mobile-api";
import { ensureOfflineAlerts } from "./engine";
import { touchSimulated } from "./simulator";
import { notFound } from "./errors";
import { requestedApps } from "./family-service";

/**
 * JSON shapes for the parent mobile app. Values are raw (ISO dates, minutes) with a
 * ready-to-show `label` where formatting depends on the family's time zone.
 */

/** Same upkeep the web layout does on every page: simulated heartbeats and offline alerts. */
export async function refreshFamily(familyId: string) {
  await touchSimulated(familyId);
  await ensureOfflineAlerts(familyId);
}

/** `offline`: devices counted by their last known state. "Fully protected" needs every one of them online. */
export function healthLabel(score: number, total: number, offline = 0) {
  if (score === total) return offline ? "Last known: all set" : "Fully protected";
  if (score >= total - 2) return "Good protection";
  if (score >= total / 2) return "Needs attention";
  return "Action required";
}

export async function photoVersions(childIds: string[]) {
  const rows = await db.childPhoto.findMany({ where: { childId: { in: childIds } }, select: { childId: true, updatedAt: true } });
  return new Map(rows.map((r) => [r.childId, r.updatedAt]));
}

export { limitOn };

export async function todayMinutes(childIds: string[], tz: string) {
  const rows = await db.screenTimeDaily.groupBy({
    by: ["childId"], where: { childId: { in: childIds }, date: dateFromKey(dayKey(new Date(), tz)) }, _sum: { minutes: true },
  });
  return new Map(rows.map((r) => [r.childId, r._sum.minutes ?? 0]));
}

export function deviceJson(d: DeviceView, graph: FamilyGraph, tz: string) {
  const state = graph.deviceStates[d.id];
  return {
    id: d.id, childId: d.childId, childName: d.child.name, name: d.name, model: d.model, kind: d.kind, platform: d.platform,
    osVersion: d.osVersion, appVersion: d.appVersion, battery: d.battery, isPrimary: d.isPrimary,
    lastSeenAt: d.lastSeenAt, lastSeenLabel: dayTime(d.lastSeenAt, tz),
    state: state.key, issues: state.issues,
  };
}

export function childJson(c: ChildView, extra: { photo?: Date; todayMinutes?: number; tz: string }) {
  const today = dayKey(new Date(), extra.tz);
  return {
    id: c.id, name: c.name, age: c.age, birthYear: c.birthYear, hue: c.hue,
    photoUrl: photoUrl(c.id, extra.photo),
    status: c.status,
    health: { score: c.health.score, total: c.health.total },
    dailyLimitMinutes: c.dailyLimitMinutes, weekendLimitMinutes: c.weekendLimitMinutes,
    todayLimitMinutes: limitOn(c, today),
    todayMinutes: extra.todayMinutes ?? 0,
    deviceCount: c.devices.length,
    primaryDevice: c.primary ? { id: c.primary.id, name: c.primary.name, platform: c.primary.platform } : null,
  };
}

export async function childrenJson(graph: FamilyGraph, tz: string) {
  const ids = graph.children.map((c) => c.id);
  const [photos, minutes] = await Promise.all([photoVersions(ids), todayMinutes(ids, tz)]);
  return graph.children.map((c) => childJson(c, { photo: photos.get(c.id), todayMinutes: minutes.get(c.id), tz }));
}

export function childFromGraph(graph: FamilyGraph, childId: string) {
  const c = graph.children.find((k) => k.id === childId);
  if (!c) throw notFound("Child");
  return c;
}

/* ---------- Alerts ---------- */

type AlertAction =
  | { type: "FIX_SETTING"; label: string; childId: string; key: ProtectionKey }
  | { type: "VIEW_DEVICE"; label: string; deviceId: string }
  | { type: "REVIEW_APPS"; label: string; childId: string }
  | { type: "VIEW_SCREEN_TIME"; label: string; childId: string }
  | { type: "VIEW_HISTORY"; label: string; childId: string }
  | { type: "MANAGE_SUBSCRIPTION"; label: string };

/** What the alert's button does in the app. Mirrors alertAction() on the web. */
export function mobileAlertAction(a: Pick<Alert, "resolveKey" | "category" | "childId" | "deviceId" | "resolvedAt">): AlertAction | null {
  if (a.resolvedAt) return null;
  const [k] = (a.resolveKey ?? "").split(":");
  if (k && k in PROTECTION_BY_KEY && a.childId) {
    return { type: "FIX_SETTING", label: k === "LOCATION" ? "Guide me" : k === "BEDTIME" ? "Set bedtime" : "Review setting", childId: a.childId, key: k as ProtectionKey };
  }
  if (k === "OFFLINE" && a.deviceId) return { type: "VIEW_DEVICE", label: "View device", deviceId: a.deviceId };
  if (k === "APPREQ" && a.childId) return { type: "REVIEW_APPS", label: "Review request", childId: a.childId };
  switch (a.category) {
    case "APPS": return a.childId ? { type: "REVIEW_APPS", label: "Review app", childId: a.childId } : null;
    case "SCREEN_TIME": return a.childId ? { type: "VIEW_SCREEN_TIME", label: "View activity", childId: a.childId } : null;
    case "DEVICES": return a.deviceId ? { type: "VIEW_DEVICE", label: "View device", deviceId: a.deviceId } : null;
    case "PROTECTION": return a.childId ? { type: "VIEW_HISTORY", label: "Review", childId: a.childId } : null;
    case "SYSTEM": return { type: "MANAGE_SUBSCRIPTION", label: "Manage plan" };
    default: return null;
  }
}

export function dayGroup(d: Date, tz: string, now = new Date()) {
  const key = dayKey(d, tz);
  const today = dayKey(now, tz);
  const yesterday = new Date(dateFromKey(today).getTime() - 864e5).toISOString().slice(0, 10);
  const label = key === today ? "Today" : key === yesterday ? "Yesterday"
    : new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return { key, label };
}

export function alertJson(a: Alert & { read: boolean }, tz: string) {
  return {
    id: a.id, childId: a.childId, deviceId: a.deviceId,
    severity: a.severity, category: a.category, icon: a.icon,
    title: a.title, body: a.body, subject: a.subject, fromValue: a.fromValue, toValue: a.toValue,
    read: a.read, resolved: !!a.resolvedAt, dismissible: a.severity === "INFO" && !a.resolvedAt,
    createdAt: a.createdAt, timeLabel: dayTime(a.createdAt, tz), day: dayGroup(a.createdAt, tz),
    action: mobileAlertAction(a),
  };
}

/** Alert filter tabs in the app, mapped to categories. */
export const ALERT_FILTERS: Record<string, AlertCategory[] | null> = {
  ALL: null,
  PROTECTION: ["PROTECTION", "LOCATION"],
  APPS: ["APPS"],
  SCREEN_TIME: ["SCREEN_TIME"],
  DEVICES: ["DEVICES"],
  LOCATION: ["LOCATION"],
  SYSTEM: ["SYSTEM"],
};

/* ---------- Screen time ---------- */

export type Period = "today" | "7d" | "30d";

export async function screenTime(child: ChildView, tz: string, period: Period) {
  const n = period === "today" ? 1 : period === "7d" ? 7 : 30;
  const days = lastNDays(n * 2, tz); // current period plus the one before, for comparison
  const cur = days.slice(n), prev = days.slice(0, n);
  const from = dateFromKey(days[0]), curFrom = dateFromKey(cur[0]), to = dateFromKey(cur[cur.length - 1]);

  const [rows, apps, rules] = await Promise.all([
    db.screenTimeDaily.findMany({ where: { childId: child.id, date: { gte: from, lte: to } } }),
    db.appUsageDaily.groupBy({ by: ["app"], where: { childId: child.id, date: { gte: curFrom, lte: to } }, _sum: { minutes: true }, orderBy: { _sum: { minutes: "desc" } } }),
    db.childApp.findMany({ where: { childId: child.id }, select: { id: true, name: true, approval: true, dailyLimitMinutes: true } }),
  ]);
  const perDay = new Map<string, number>();
  for (const r of rows) {
    const k = r.date.toISOString().slice(0, 10);
    perDay.set(k, (perDay.get(k) ?? 0) + r.minutes);
  }
  const series = cur.map((date) => ({ date, minutes: perDay.get(date) ?? 0, limitMinutes: limitOn(child, date) }));
  const total = series.reduce((s, d) => s + d.minutes, 0);
  const prevTotal = prev.reduce((s, d) => s + (perDay.get(d) ?? 0), 0);

  // Hourly breakdown for today, summed over the child's devices (only devices that sent hourly data)
  let hourly: number[] | null = null;
  if (period === "today") {
    const today = rows.filter((r) => r.date.toISOString().slice(0, 10) === cur[0] && r.hourly.length === 24);
    if (today.length) hourly = Array.from({ length: 24 }, (_, h) => today.reduce((s, r) => s + r.hourly[h], 0));
  }
  const byName = new Map(rules.map((r) => [r.name, r]));
  return {
    period, from: cur[0], to: cur[cur.length - 1],
    totalMinutes: total,
    averageMinutes: Math.round(total / n),
    previousAverageMinutes: Math.round(prevTotal / n),
    limitMinutes: period === "today" ? limitOn(child, cur[0]) : child.dailyLimitMinutes,
    days: series,
    hourly,
    apps: apps.map((a) => {
      const rule = byName.get(a.app);
      return { name: a.app, minutes: a._sum.minutes ?? 0, appId: rule?.id ?? null, approval: rule?.approval ?? null, dailyLimitMinutes: rule?.dailyLimitMinutes ?? null };
    }),
  };
}

/* ---------- Child overview ---------- */

export async function childOverview(graph: FamilyGraph, childId: string, tz: string) {
  const c = childFromGraph(graph, childId);
  const todayKey = dayKey(new Date(), tz);
  const [photos, minutes, appsToday, pending, changes] = await Promise.all([
    photoVersions([c.id]),
    todayMinutes([c.id], tz),
    appMinutesOn([c.id], dateFromKey(todayKey)).then((rows) => rows.filter((r) => r.minutes > 0)),
    Promise.all([db.childApp.findMany({ where: { childId: c.id, approval: "PENDING" }, select: { name: true } }), requestedApps(c.id)])
      .then(([apps, requested]) => new Set([...apps.map((a) => a.name), ...requested]).size),
    db.configChange.findMany({ where: { childId: c.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const policy = (key: ProtectionKey) => c.policies.find((p) => p.key === key)?.config as ProtectionConfig | undefined;
  const bedtime = policy("BEDTIME") as Extract<ProtectionConfig, { key: "BEDTIME" }> | undefined;
  const loc = c.devices.map((d) => d.location).find((l) => l?.sharing && l.lat != null) ?? null;
  const sharing = c.devices.some((d) => d.location?.sharing);
  const worstDevice = c.devices.map((d) => graph.deviceStates[d.id]).sort((a, b) => b.issues - a.issues)[0];

  return {
    child: childJson(c, { photo: photos.get(c.id), todayMinutes: minutes.get(c.id), tz }),
    health: {
      score: c.health.score, total: c.health.total, offline: c.health.offline, verified: c.health.verified,
      label: healthLabel(c.health.score, c.health.total, c.health.offline), checks: c.health.checks,
    },
    today: {
      minutes: minutes.get(c.id) ?? 0,
      limitMinutes: limitOn(c, todayKey),
      appsUsed: appsToday.filter((a) => a.app !== "Others").length,
      topApps: appsToday.slice(0, 5).map((a) => ({ name: a.app, minutes: a.minutes })),
    },
    bedtime: bedtime ? { enabled: bedtime.enabled, start: bedtime.start, end: bedtime.end, days: bedtime.days, label: describeConfig(bedtime) } : null,
    location: {
      sharing,
      placeLabel: loc?.placeLabel ?? null,
      updatedAt: loc ? loc.locatedAt ?? loc.updatedAt : null,
      label: !sharing ? "Sharing off" : loc ? "Sharing enabled" : "Waiting for location",
    },
    deviceProtection: {
      state: !c.devices.length ? "no_devices" : worstDevice.issues ? "issues" : c.devices.every((d) => graph.deviceStates[d.id].key === "offline") ? "offline" : "healthy",
      label: !c.devices.length ? "No devices yet" : worstDevice.issues ? `${worstDevice.issues} issue${worstDevice.issues > 1 ? "s" : ""}` : "Healthy",
    },
    pendingApprovals: pending,
    devices: c.devices.map((d) => deviceJson(d, graph, tz)),
    recentChanges: changes.map((ch) => ({ id: ch.id, key: ch.key, title: ch.title, actor: ch.actor, fromValue: ch.fromValue, toValue: ch.toValue, createdAt: ch.createdAt })),
  };
}

export { getFamilyGraph };
