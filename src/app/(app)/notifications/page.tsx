import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAlerts, getFamily } from "@/lib/queries";
import { toAlertItem } from "@/lib/views";
import { EmptyState, PageHead } from "@/components/ui";
import { MarkAllRead, NotificationItem } from "@/components/alerts";

export const metadata = { title: "Notifications" };

const FILTERS = [["ALL", "All"], ["PROTECTION", "Protection"], ["DEVICES", "Devices"], ["APPS", "Apps"], ["SCREEN_TIME", "Screen Time"], ["LOCATION", "Location"], ["SYSTEM", "System"]] as const;

export default async function NotificationsPage(props: PageProps<"/notifications">) {
  const u = await requireUser();
  const sp = await props.searchParams;
  const filter = FILTERS.find(([k]) => k === String(sp.filter ?? "").toUpperCase())?.[0] ?? "ALL";
  const showResolved = sp.resolved === "1";
  const family = await getFamily(u.familyId);
  const [alerts, counts] = await Promise.all([
    getAlerts(u.familyId, u.id, { category: filter, includeResolved: showResolved, take: 200 }),
    db.alert.groupBy({ by: ["category"], where: { familyId: u.familyId, ...(showResolved ? {} : { resolvedAt: null }) }, _count: true }),
  ]);
  const total = counts.reduce((s, c) => s + c._count, 0);
  const q = (f: string, r = showResolved) => `/notifications?filter=${f.toLowerCase()}${r ? "&resolved=1" : ""}`;

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
          : <EmptyState icon="bell-off" title="Nothing here" text="There are no notifications in this category." />}
      </section>
    </>
  );
}
