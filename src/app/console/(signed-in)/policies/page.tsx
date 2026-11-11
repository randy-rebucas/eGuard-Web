import { requireStaff } from "@/lib/staff-auth";
import { policySummary } from "@/lib/console-queries";
import { PROTECTIONS } from "@/lib/protections";
import { label, num, pct, plural } from "../../format";
import { Empty, StatGrid } from "../../ui";
import { BarList, ChartCard, DataTable, SegmentedBar } from "../../charts";

export const metadata = { title: "Policies" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

/** Restriction levels in order, loosest to strictest, each keeping its color on every chart. */
const YOUTUBE = [["OFF", "var(--viz-neutral)"], ["MODERATE", "var(--viz-1)"], ["STRICT", "var(--viz-2)"]] as const;
const UNKNOWN_SITES = [["ALLOW", "var(--viz-neutral)"], ["WARN", "var(--viz-1)"], ["BLOCK", "var(--viz-2)"]] as const;

/**
 * Which rules families use, as counts. Never what a rule says: no sites, apps, times or limits, and no family or child
 * named, so the page can't be used to look at one family's rules.
 */
export default async function PoliciesPage() {
  await requireStaff();
  const s = await policySummary();
  const byKey = new Map(s.byKey.map((r) => [r.key, r.n]));
  const b = s.browser;
  const protections = PROTECTIONS.map((p) => ({ label: p.checkName, value: byKey.get(p.key) ?? 0 }));
  const browserRows = [
    { label: "Safe Search on", value: b.safeSearch },
    { label: "Safe Browsing on", value: b.safeBrowsing },
    { label: "Browsing schedule on", value: b.scheduled },
    { label: "Has blocked sites", value: b.withBlocked },
    { label: "Has always-allowed sites", value: b.withAllowed },
  ];
  const levels = (rows: { value: string; n: number }[], order: readonly (readonly [string, string])[]) =>
    order.map(([v, color]) => ({ label: label(v), value: rows.find((r) => r.value === v)?.n ?? 0, color }));
  const youtube = levels(s.youtube, YOUTUBE), unknown = levels(s.unknownSites, UNKNOWN_SITES);
  const most = [...protections].sort((x, y) => y.value - x.value)[0];

  return (
    <>
      <h1 className="cn-h1">Policies</h1>
      <p className="cn-muted">How many children each kind of rule is set for. What the rules say stays with the family.</p>
      <StatGrid stats={[
        { label: "Children", value: s.children, href: "/children" },
        { label: "With browser rules", value: b.total, hint: `${pct(b.total, s.children)} of children` },
        { label: "Most used rule", value: most?.value ? most.label : "—", hint: most?.value ? plural(most.value, "child", "children") : undefined },
        { label: "Blocked categories", value: b.avgCategories, hint: "On average, per child with browser rules" },
      ]} />

      <div className="cn-grid2">
        <ChartCard title="Rules by protection" sub={`Children with each rule set, out of ${num(s.children)}`}
          table={<DataTable head={["Protection", "Children", "Share"]} rows={protections.map((p) => [p.label, p.value, pct(p.value, s.children)])} />}>
          <BarList rows={protections.map((p) => ({ ...p, display: `${num(p.value)} · ${pct(p.value, s.children)}` }))} max={Math.max(1, s.children)} unit="children" label="Children with each protection rule set" />
        </ChartCard>
        <ChartCard title="Browser rules" sub={`Out of ${num(b.total)} children with browser rules`}
          table={<DataTable head={["Setting", "Children", "Share"]} rows={browserRows.map((r) => [r.label, r.value, pct(r.value, b.total)])} />}>
          {b.total
            ? <BarList rows={browserRows.map((r) => ({ ...r, display: `${num(r.value)} · ${pct(r.value, b.total)}` }))} max={b.total} unit="children" label="Browser rule adoption" />
            : <Empty>No child has browser rules yet.</Empty>}
        </ChartCard>
        <ChartCard title="YouTube Restricted Mode" sub="Level set, per child with browser rules"
          table={<DataTable head={["Level", "Children"]} rows={youtube.map((r) => [r.label, r.value])} />}>
          <SegmentedBar parts={youtube} unit="children" label="YouTube Restricted Mode levels" />
        </ChartCard>
        <ChartCard title="Unknown sites" sub="What happens on a site no list covers"
          table={<DataTable head={["Setting", "Children"]} rows={unknown.map((r) => [r.label, r.value])} />}>
          <SegmentedBar parts={unknown} unit="children" label="Unknown sites setting" />
        </ChartCard>
      </div>
    </>
  );
}
