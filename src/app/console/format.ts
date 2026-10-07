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
