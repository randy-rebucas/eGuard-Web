import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { STORES, isStore, isSubscriptionFilter, listSubscriptions, subscriptionSummary } from "@/lib/console-queries";
import { beforeParam, day, label, num, stamp } from "../../format";
import { Empty, FilterTabs, OkPill, Pager, StatGrid } from "../../ui";
import { BarList, ChartCard, DataTable, SegmentedBar } from "../../charts";

export const metadata = { title: "Subscriptions" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

const FILTERS = [
  { value: "", label: "All" }, { value: "active", label: "Active" }, { value: "expiring", label: "Ending in 7 days" },
  { value: "lapsed", label: "Lapsed" }, { value: "closed", label: "Closed" },
];

/** Every Google Play and PayMongo purchase, newest first, with who bought it. */
export default async function SubscriptionsPage(props: PageProps<"/console/subscriptions">) {
  await requireStaff();
  const sp = await props.searchParams;
  const filter = isSubscriptionFilter(sp.filter) ? sp.filter : null;
  const store = isStore(sp.store) ? sp.store : null;
  const before = beforeParam(sp.before);
  const [{ rows, nextBefore }, s] = await Promise.all([listSubscriptions(filter, store, before), subscriptionSummary()]);
  const byStore = STORES.map((st, i) => ({ label: label(st), value: s.byProduct.filter((p) => p.store === st).reduce((a, p) => a + p.n, 0), color: `var(--viz-${i + 1})` }));
  return (
    <>
      <h1 className="cn-h1">Subscriptions</h1>
      <StatGrid stats={[
        { label: "Active", value: s.active, href: "/subscriptions?filter=active" },
        { label: "Renew automatically", value: s.renewing, hint: s.active ? `${Math.round((s.renewing / s.active) * 100)}% of active` : undefined },
        { label: "Ending in 7 days, not renewing", value: s.expiring, tone: s.expiring ? "warn" : undefined, href: "/subscriptions?filter=expiring" },
        { label: "Lapsed in 30 days", value: s.lapsed30, href: "/subscriptions?filter=lapsed" },
      ]} />
      <div className="cn-grid2">
        <ChartCard title="Active by product" sub="Purchases in their paid period now"
          table={<DataTable head={["Store", "Product", "Active"]} rows={s.byProduct.map((p) => [label(p.store), p.productId, p.n])} />}>
          {s.byProduct.length
            ? <BarList rows={s.byProduct.map((p) => ({ label: p.productId, value: p.n, color: `var(--viz-${STORES.indexOf(p.store as (typeof STORES)[number]) + 1})` }))} unit="active" label="Active subscriptions by product" />
            : <Empty>No active subscriptions.</Empty>}
        </ChartCard>
        <ChartCard title="Active by store" sub={`${num(s.active)} active in all`}
          table={<DataTable head={["Store", "Active"]} rows={byStore.map((x) => [x.label, x.value])} />}>
          <SegmentedBar parts={byStore} unit="subscriptions" label="Active subscriptions by store" />
        </ChartCard>
      </div>
      <FilterTabs label="Filter by state" base="/subscriptions" param="filter" value={filter ?? ""} options={FILTERS} query={{ store: store ?? "" }} />
      <FilterTabs label="Filter by store" base="/subscriptions" param="store" value={store ?? ""} options={[{ value: "", label: "Every store" }, ...STORES.map((x) => ({ value: x, label: label(x) }))]} query={{ filter: filter ?? "" }} />
      <section className="card">
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Family</th><th>Product</th><th>Store</th><th>State</th><th>Renews</th><th>Ends</th><th>Last checked</th><th>Bought</th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td><Link prefetch={false} className="inline-link" href={`/families/${p.family.id}`}>{p.family.name}</Link> <span className="cn-muted">· {p.family.plan}</span></td>
                    <td className="cn-mono">{p.productId}</td>
                    <td>{label(p.store)}</td>
                    <td className="cn-mono">{p.state}</td>
                    <td><OkPill ok={p.autoRenewing} /></td>
                    <td>{day(p.expiresAt)}</td>
                    <td>{stamp(p.checkedAt)}</td>
                    <td>{day(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No purchases here.</Empty>}
      </section>
      <Pager nextBefore={nextBefore} paged={!!before} query={{ filter: filter ?? "", store: store ?? "" }} />
    </>
  );
}
