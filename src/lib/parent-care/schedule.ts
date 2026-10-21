import { dateFormat, localTime } from "../format";

/**
 * Time arithmetic for parent-care messages, all in the parent's own time zone. Pure, so it's tested without a
 * database. Times are stored in UTC; a "slot" is a local date (YYYY-MM-DD) plus minutes after local midnight, turned
 * into an instant with format.localTime, which settles days where clocks change.
 */

/** YYYY-MM-DD in `tz` */
export const localDay = (d: Date, tz: string) => dateFormat("en-CA", tz, { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** Minutes after local midnight in `tz` */
export function localMinute(d: Date, tz: string) {
  const parts = dateFormat("en-GB", tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return n("hour") * 60 + n("minute");
}

/** 0 = Sunday, for a YYYY-MM-DD */
export const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The instant `minute` minutes after midnight on local `day` */
export const slot = (day: string, minute: number, tz: string) => localTime(day, minute / 60, tz);

/** The Monday (YYYY-MM-DD) of the local week `d` falls in */
export function weekOf(d: Date, tz: string) {
  const day = localDay(d, tz);
  return addDays(day, -((weekday(day) + 6) % 7));
}

/** YYYY-MM of the local month before the one `d` falls in */
export function previousMonth(d: Date, tz: string) {
  const [y, m] = localDay(d, tz).split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Whether local minute `m` is inside quiet hours [start, end). Quiet hours usually run over midnight
 * (21:00 → 07:00); start == end means none.
 */
export function inQuietHours(m: number, start: number, end: number) {
  if (start === end) return false;
  return start < end ? m >= start && m < end : m >= start || m < end;
}

/**
 * `at`, or the end of quiet hours if `at` falls inside them: the next local `end` after `at`. Push and email wait;
 * in-app messages don't interrupt anyone, so they aren't held.
 */
export function afterQuietHours(at: Date, tz: string, start: number, end: number) {
  if (!inQuietHours(localMinute(at, tz), start, end)) return at;
  const day = localDay(at, tz);
  const today = slot(day, end, tz);
  return today > at ? today : slot(addDays(day, 1), end, tz);
}

/**
 * The upcoming delivery slots in [from, from + horizonDays): each local day whose weekday is in `days` (all days
 * when omitted), at `minute`. Used to plan briefings a day or two ahead, idempotently by local date.
 */
export function slotsBetween(from: Date, horizonDays: number, tz: string, minute: number, days?: number[]) {
  const out: { day: string; at: Date }[] = [];
  const first = localDay(from, tz);
  for (let i = 0; i <= horizonDays; i++) {
    const day = addDays(first, i);
    if (days && !days.includes(weekday(day))) continue;
    const at = slot(day, minute, tz);
    if (at >= from && at.getTime() < from.getTime() + horizonDays * 864e5) out.push({ day, at });
  }
  return out;
}

/** Whole days from `since` to `now` */
export const daysSince = (since: Date, now: Date) => Math.floor((now.getTime() - since.getTime()) / 864e5);

/** "19:30" ⇄ 1170. Null for anything that isn't a 24-hour HH:MM. */
export function parseClock(s: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
export const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

/** "7:30 PM" */
export function clock12(minute: number) {
  const h = Math.floor(minute / 60), m = minute % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
