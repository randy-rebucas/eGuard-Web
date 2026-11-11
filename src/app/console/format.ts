import { dateFormat } from "@/lib/format";

/** The console shows every time in Philippine time, where the team works. */
const TZ = "Asia/Manila";

/** "Oct 7, 2026, 3:04 PM" */
export const stamp = (d: Date | null | undefined) =>
  d ? dateFormat("en-US", TZ, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(d) : "—";

/** "Oct 7, 2026" */
export const day = (d: Date | null | undefined) => (d ? dateFormat("en-US", TZ, { month: "short", day: "numeric", year: "numeric" }).format(d) : "—");

/** A list's `before` from the query string: a valid time, or none (the first page). */
export function beforeParam(v: string | string[] | undefined) {
  const d = typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : undefined;
}

export const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** "5 min ago", "3 h ago", "2 days ago"; a dash for never. */
export function ago(d: Date | null | undefined, now = Date.now()) {
  if (!d) return "—";
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const days = Math.floor(s / 86400);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export const num = (v: number) => v.toLocaleString("en-US");

/** "42%", or a dash with nothing to divide by */
export const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");

/** ANDROID → Android, ACTION_REQUIRED → Action required */
export const label = (v: string | null | undefined) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replaceAll("_", " ") : "—");

/** Whether `at` is within the last `ms` (a device or browser counts as online). */
export const seenWithin = (at: Date, ms: number, now = Date.now()) => now - at.getTime() < ms;

/** "3:04 PM" */
export const time = (d: Date) => dateFormat("en-US", TZ, { hour: "numeric", minute: "2-digit" }).format(d);

/** "1 device", "3 devices" */
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
