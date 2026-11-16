import { z } from "zod";
import type { Prisma } from "@prisma/client";

/**
 * What an iPhone's own app rules cover, as it reports on /device/v1/sync `appRules`. The rules are chosen on the phone
 * (Apple gives eGuard opaque tokens, no names), so the parent sees counts only: "Blocked: 3 apps, 1 category ·
 * Limited to 1 h a day: 2 apps". Stored in `Device.appRules`, shown on the device in the parent apps and web.
 */
const Counts = z.strictObject({
  apps: z.number().int().min(0).max(10_000),
  categories: z.number().int().min(0).max(1_000),
  sites: z.number().int().min(0).max(10_000),
});

export const DeviceAppRules = z.strictObject({
  blocked: Counts,
  limited: z.array(z.strictObject({ minutes: z.number().int().min(1).max(1440), counts: Counts })).max(10),
});
export type DeviceAppRules = z.infer<typeof DeviceAppRules>;

type Counts = z.infer<typeof Counts>;

/** The column value to save, or undefined when nothing changed (or nothing was sent). */
export function appRulesUpdate(stored: Prisma.JsonValue | null | undefined, reported: DeviceAppRules | undefined) {
  if (!reported) return undefined;
  return JSON.stringify(stored ?? null) === JSON.stringify(reported) ? undefined : (reported as Prisma.InputJsonValue);
}

/** The stored summary, or null when the phone never reported one or it doesn't parse (an older shape). */
export function appRulesOf(stored: Prisma.JsonValue | null | undefined): DeviceAppRules | null {
  const parsed = DeviceAppRules.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

function countsLabel(c: Counts) {
  const n = (count: number, one: string, many: string) => count ? `${count} ${count === 1 ? one : many}` : null;
  return [n(c.apps, "app", "apps"), n(c.categories, "category", "categories"), n(c.sites, "website", "websites")].filter(Boolean).join(", ");
}

/** One line for the parent, e.g. "Blocked: 3 apps · 1 h a day: 2 apps", or null when the phone has no app rules. */
export function describeAppRules(rules: DeviceAppRules | null) {
  if (!rules) return null;
  const parts: string[] = [];
  const blocked = countsLabel(rules.blocked);
  if (blocked) parts.push(`Blocked: ${blocked}`);
  for (const l of rules.limited) {
    const counted = countsLabel(l.counts);
    if (!counted) continue;
    const h = Math.floor(l.minutes / 60), m = l.minutes % 60;
    parts.push(`${h ? `${h} h` : ""}${h && m ? " " : ""}${m ? `${m} min` : ""} a day: ${counted}`);
  }
  return parts.length ? parts.join(" · ") : null;
}
