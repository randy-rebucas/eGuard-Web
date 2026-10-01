import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAlerts, getFamily } from "@/lib/queries";
import { toAlertItem } from "@/lib/views";
import { EmptyState, PageHead } from "@/components/ui";
import { MarkAllRead, NotificationItem } from "@/components/alerts";

export const metadata = { title: "Notifications" };

const FILTERS = [["ALL", "All"], ["PROTECTION", "Protection"], ["DEVICES", "Devices"], ["APPS", "Apps"], ["SCREEN_TIME", "Screen Time"], ["LOCATION", "Location"], ["SYSTEM", "System"]] as const;
const PAGE = 200;
const MAX = 2000;

export default async function NotificationsPage(props: PageProps<"/notifications">) {
  const u = await requireUser();
  const sp = await props.searchParams;
  const filter = FILTERS.find(([k]) => k === String(sp.filter ?? "").toUpperCase())?.[0] ?? "ALL";
  const showResolved = sp.resolved === "1";
  const limit = Math.min(MAX, Math.max(PAGE, Math.ceil(Number(sp.limit) / PAGE) * PAGE || PAGE));
  const [family, alerts, counts] = await Promise.all([
    getFamily(u.familyId),
    getAlerts(u.familyId, u.id, { category: filter, includeResolved: showResolved, take: limit }),
    db.alert.groupBy({ by: ["category"], where: { familyId: u.familyId, ...(showResolved ? {} : { resolvedAt: null }) }, _count: true }),
  ]);
  const total = counts.reduce((s, c) => s + c._count, 0);
  const inTab = filter === "ALL" ? total : counts.find((c) => c.category === filter)?._count ?? 0;
  const q = (f: string, r = showResolved, n?: number) => `/notifications?filter=${f.toLowerCase()}${r ? "&resolved=1" : ""}${n ? `&limit=${n}` : ""}`;

  return (
    <>
      <PageHead title="Notifications" text="Changes to your family's protections and devices. Critical is reserved for genuine security events.">
        <Link className="btn btn-ghost" href={q(filter, !showResolved)}>{showResolved ? "Hide resolved" : "Show resolved"}</Link>
        <MarkAllRead />
      </PageHead>
      <nav className="tabs" aria-label="Filter notifications" style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
        {FILTERS.map(([k, l]) => (
          <Link key={k} className="tab" href={q(k)} aria-current={filter === k ? "page" : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {l} <span className="muted num">{k === "ALL" ? total : counts.find((c) => c.category === k)?._count ?? 0}</span>
          </Link>
        ))}
      </nav>
      <section className="card" style={{ padding: 8 }}>
        {alerts.length ? alerts.map((a) => <NotificationItem key={a.id} a={toAlertItem(a, family.timezone)} />)
          : filter === "ALL" ? <EmptyState icon="bell" title="You're all caught up" text={showResolved ? "There are no notifications yet." : "New notifications appear here. Resolved ones are hidden."} />
          : <EmptyState icon="bell-off" title="Nothing here" text="There are no notifications in this category." />}
        {alerts.length < inTab ? (
          <div className="row t-meta" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "12px 8px 4px" }}>
            <span>Showing {alerts.length} of {inTab}</span>
            {limit < MAX ? <Link className="link-btn" href={q(filter, showResolved, limit + PAGE)} scroll={false}>Show more</Link> : null}
          </div>
        ) : null}
      </section>
    </>
  );
}
