import { getUser } from "@/lib/auth";
import { getFamily } from "@/lib/queries";
import { reportData, resolveRange, type Period } from "@/lib/reports";

/**
 * One CSV cell. App and device names come from the child's device, so a leading = + - @ (or tab/CR) is
 * neutralised with a quote; otherwise a spreadsheet would run the text as a formula.
 */
const csv = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  const u = await getUser();
  if (!u) return new Response("Unauthorized", { status: 401 });
  const p = new URL(req.url).searchParams;
  const period = (["today", "7d", "30d", "custom"].includes(p.get("period") ?? "") ? p.get("period") : "7d") as Period;
  const family = await getFamily(u.familyId);
  const range = resolveRange(period, family.timezone, p.get("from") ?? undefined, p.get("to") ?? undefined);
  const data = await reportData(u.familyId, range.from, range.to);
  const name = (id: string) => data.children.find((c) => c.id === id)?.name ?? id;

  const rows: unknown[][] = [
    ["eGuard Family Digital Safety Summary", `${range.from} to ${range.to}`],
    [],
    ["Screen time"], ["Date", "Child", "Minutes"],
    ...data.screen.map((r) => [r.date.toISOString().slice(0, 10), name(r.childId), r._sum.minutes ?? 0]),
    [],
    ["Top apps"], ["App", "Minutes"],
    ...data.apps.map((a) => [a.app, a._sum.minutes ?? 0]),
    [],
    ["Protection changes"], ["When (UTC)", "Child", "Change", "By", "From", "To"],
    ...data.changes.map((c) => [c.createdAt.toISOString(), c.child.name, c.title, c.actor, c.fromValue, c.toValue]),
  ];
  const body = rows.map((r) => r.map(csv).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eguard-report-${range.from}-to-${range.to}.csv"`,
    },
  });
}
