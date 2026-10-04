import "server-only";
import { db } from "./db";
import { planRequired } from "./errors";
import { requestedApps } from "./family-service";
import { entitlementsFor, nextPlan, planByName, type Entitlements } from "./plans";

/** What the family's plan includes, from Family.plan (kept current by applyEntitlement). */
export async function familyEntitlements(familyId: string): Promise<Entitlements & { plan: string }> {
  const f = await db.family.findUniqueOrThrow({ where: { id: familyId }, select: { plan: true } });
  return { plan: f.plan, ...entitlementsFor(f.plan) };
}

/** The cheapest plan whose entitlements pass `has`, for "Upgrade to …". */
export function planWith(has: (e: Entitlements) => boolean) {
  let p = planByName("Free");
  for (let next = nextPlan(p.name); next && !has(p.entitlements); next = nextPlan(p.name)) p = next;
  return p;
}

export const LOCATION_UPGRADE = `Location sharing is included with ${planWith((e) => e.locationSharing).name} and above.`;
export const REPORTS_UPGRADE = `30-day and custom reports and CSV export are included with ${planWith((e) => e.advancedReports).name}.`;

export async function requireLocationSharing(familyId: string) {
  if (!(await familyEntitlements(familyId)).locationSharing) throw planRequired(LOCATION_UPGRADE);
}

/**
 * App monitoring on a plan with a limit (Free): every app waiting for the parent's approval stays visible,
 * then the most used today fill the rest. `hidden` is how many more there are.
 */
export function visibleApps<A extends { name: string; approval: string }>(apps: A[], limit: number | null, o: { minutes: (app: string) => number; requested: Set<string> }) {
  if (limit == null || apps.length <= limit) return { apps, hidden: 0 };
  const waiting = apps.filter((a) => a.approval === "PENDING" || o.requested.has(a.name));
  const rest = apps.filter((a) => !waiting.includes(a)).sort((a, b) => o.minutes(b.name) - o.minutes(a.name));
  const keep = new Set([...waiting, ...rest.slice(0, Math.max(0, limit - waiting.length))]);
  return { apps: apps.filter((a) => keep.has(a)), hidden: apps.length - keep.size };
}

/**
 * Whether a "most used today" list may name an app on this plan: only apps the Apps tab shows (visibleApps keeps
 * apps waiting for approval first), so such a list can't reveal the ones it hides. With nothing hidden, any name.
 */
export async function nameableApps(childId: string, limit: number | null, minutes: (app: string) => number) {
  if (limit == null) return () => true;
  const [all, requested] = await Promise.all([
    db.childApp.findMany({ where: { childId }, select: { name: true, approval: true } }),
    requestedApps(childId),
  ]);
  const { apps, hidden } = visibleApps(all, limit, { requested, minutes });
  if (!hidden) return () => true;
  const names = new Set(apps.map((a) => a.name));
  return (app: string) => names.has(app);
}

/**
 * App usage on a plan with an app limit: only the `limit` most used are named, so usage lists (reports, screen
 * time) can't reveal more apps than the Apps tab shows. `others` sums the rest, including the devices' own
 * "Others" row; `hidden` counts the named apps left out. Rows must be most used first.
 */
export function capAppUsage<R extends { app: string; minutes: number }>(rows: R[], limit: number | null) {
  const named = rows.filter((r) => r.app !== "Others");
  const shown = limit == null ? named : named.slice(0, limit);
  const total = rows.reduce((s, r) => s + r.minutes, 0);
  return { named: shown, others: total - shown.reduce((s, r) => s + r.minutes, 0), hidden: named.length - shown.length };
}

export const APPS_UPGRADE = `See and manage every app with ${planWith((e) => e.appMonitoringLimit == null).name}.`;

/** Current locations stop being kept when a plan without location sharing takes over. History is kept, hidden. */
export async function clearCurrentLocations(familyId: string) {
  await db.deviceLocation.updateMany({
    where: { device: { familyId } },
    data: { lat: null, lng: null, accuracyM: null, placeLabel: null, placeId: null, locatedAt: null },
  });
}
