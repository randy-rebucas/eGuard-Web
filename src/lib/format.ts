/**
 * Formatters are slow to create (each loads locale and time zone data) and the same few are used for every row
 * a page renders, so they're made once per locale, time zone and options. The options are always literals here,
 * so the cache stays small.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();
export function dateFormat(locale: string, tz: string, o: Intl.DateTimeFormatOptions) {
  const k = `${locale}|${tz}|${JSON.stringify(o)}`;
  let f = formatters.get(k);
  if (!f) formatters.set(k, (f = new Intl.DateTimeFormat(locale, { timeZone: tz, ...o })));
  return f;
}

/** Milliseconds `tz` is ahead of UTC at instant `d`. */
function tzOffset(d: Date, tz: string) {
  const p = Object.fromEntries(
    dateFormat("en-US", tz, { hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })
      .formatToParts(d).map((x) => [x.type, Number(x.value)]),
  );
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d.getTime() / 1000) * 1000;
}

/** The instant a day (YYYY-MM-DD) starts in the family's timezone. */
export const dayStart = (k: string, tz: string) => localTime(k, 0, tz);

/** The instant it's `hour`:00 on a day (YYYY-MM-DD) in the family's timezone. */
export function localTime(k: string, hour: number, tz: string) {
  const utc = new Date(`${k}T00:00:00.000Z`).getTime() + hour * 3600_000;
  const guess = utc - tzOffset(new Date(utc), tz);
  // Second pass settles days where a DST change sits between UTC and local time
  return new Date(utc - tzOffset(new Date(guess), tz));
}

const fmt = (tz: string, o: Intl.DateTimeFormatOptions) => dateFormat("en-US", tz, o);

function dayIndex(d: Date, tz: string) {
  const k = dateFormat("en-CA", tz, {}).format(d);
  return Math.floor(new Date(`${k}T00:00:00Z`).getTime() / 864e5);
}

/** "8 years old"; a child born this year (age 0 by year) is "Under 1 year old". */
export const ageLabel = (age: number) => (age < 1 ? "Under 1 year old" : `${age} ${age === 1 ? "year" : "years"} old`);

const time = (d: Date, tz: string) => fmt(tz, { hour: "numeric", minute: "2-digit" }).format(d);
/** "2:32 PM" in the family's time zone */
export const clockTime = time;

/** "Today, 2:32 PM" / "Yesterday, 8:14 PM" / "Wed, 6:10 PM" / "Sep 21" */
export function dayTime(d: Date | null | undefined, tz: string, now = new Date()) {
  if (!d) return "Never";
  const diff = dayIndex(now, tz) - dayIndex(d, tz);
  if (diff === 0) return `Today, ${time(d, tz)}`;
  if (diff === 1) return `Yesterday, ${time(d, tz)}`;
  if (diff < 7) return `${fmt(tz, { weekday: "short" }).format(d)}, ${time(d, tz)}`;
  return fmt(tz, { month: "short", day: "numeric" }).format(d);
}

/** "just now" / "12 min ago" / "2 hours ago" then dayTime */
export function ago(d: Date | null | undefined, tz: string, now = new Date()) {
  if (!d) return "Never";
  const s = (now.getTime() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 6 * 3600) { const h = Math.floor(s / 3600); return `${h} hour${h > 1 ? "s" : ""} ago`; }
  return dayTime(d, tz, now);
}

export const longDate = (d: Date, tz: string) => fmt(tz, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(d);
/** "₱199" or "₱199.50", from centavos. */
const pesoWhole = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const pesoCents = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });
export const peso = (centavos: number) => (centavos % 100 ? pesoCents : pesoWhole).format(centavos / 100);
export const shortDate = (d: Date, tz: string) => fmt(tz, { month: "short", day: "numeric", year: "numeric" }).format(d);
export const dayLabel = (key: string) => {
  const d = new Date(`${key}T12:00:00Z`);
  return { dow: fmt("UTC", { weekday: "short" }).format(d), date: fmt("UTC", { month: "short", day: "numeric" }).format(d) };
};

export function greeting(tz: string, now = new Date()) {
  const h = Number(fmt(tz, { hour: "numeric", hour12: false }).format(now)) % 24;
  return h < 12 ? "Good morning," : h < 18 ? "Good afternoon," : "Good evening,";
}
