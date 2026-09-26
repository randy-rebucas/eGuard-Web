const fmt = (tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: tz, ...o });

function dayIndex(d: Date, tz: string) {
  const k = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
  return Math.floor(new Date(`${k}T00:00:00Z`).getTime() / 864e5);
}

const time = (d: Date, tz: string) => fmt(tz, { hour: "numeric", minute: "2-digit" }).format(d);

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
export const shortDate = (d: Date, tz: string) => fmt(tz, { month: "short", day: "numeric", year: "numeric" }).format(d);
export const dayLabel = (key: string) => {
  const d = new Date(`${key}T12:00:00Z`);
  return { dow: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }), date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) };
};

export function greeting(tz: string, now = new Date()) {
  const h = Number(fmt(tz, { hour: "numeric", hour12: false }).format(now)) % 24;
  return h < 12 ? "Good morning," : h < 18 ? "Good afternoon," : "Good evening,";
}
