import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFamily } from "@/lib/queries";
import { clockTime } from "@/lib/format";
import { visitsPage } from "@/lib/location";
import { dayGroup } from "@/lib/mobile-views";
import { Avatar, EmptyState, PageHead, Timeline } from "@/components/ui";

const PAGE = 50;

export async function generateMetadata(props: PageProps<"/location/[childId]">) {
  const { childId } = await props.params;
  const u = await getUser();
  const c = u ? await db.child.findFirst({ where: { id: childId, familyId: u.familyId }, select: { name: true } }) : null;
  return { title: c ? `${c.name}'s places` : "Location history" };
}

/** Location history for one child: every visit kept, newest first, grouped by day, 50 at a time. */
export default async function LocationHistoryPage(props: PageProps<"/location/[childId]">) {
  const u = await requireUser();
  const { childId } = await props.params;
  const sp = await props.searchParams;
  const child = await db.child.findFirst({ where: { id: childId, familyId: u.familyId } });
  if (!child) notFound();
  const family = await getFamily(u.familyId);
  const tz = family.timezone;
  const before = typeof sp.before === "string" && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before) : undefined;
  const { visits, nextBefore } = family.keepLocationHistory ? await visitsPage(child.id, { before, limit: PAGE }) : { visits: [], nextBefore: null };

  const days: { key: string; label: string; visits: typeof visits }[] = [];
  for (const v of visits) {
    const g = dayGroup(v.arrivedAt, tz);
    if (days.at(-1)?.key !== g.key) days.push({ ...g, visits: [] });
    days.at(-1)!.visits.push(v);
  }
  const span = (a: Date, b: Date) => {
    const [from, to] = [clockTime(a, tz), clockTime(b, tz)];
    return from === to ? from : `${from} – ${to}`;
  };

  return (
    <>
      <PageHead
        crumbs={[{ href: "/location", label: "Location" }]}
        title={`${child.name}'s places`}
        text={family.keepLocationHistory
          ? `Places ${child.name}'s devices stayed at, newest first. Kept for ${family.retentionDays} days, then deleted.`
          : "Location history is off, so eGuard keeps only the latest location."}
      >
        <Avatar name={child.name} hue={child.hue} size="lg" />
      </PageHead>

      <section className="card card-pad">
        {!family.keepLocationHistory ? (
          <EmptyState icon="history" title="Location history is off" text={`Turn it on in Privacy settings to see where ${child.name} has been. Only the family admin can change it.`}>
            <Link className="btn btn-secondary" href="/settings/privacy">Privacy settings</Link>
          </EmptyState>
        ) : !days.length ? (
          <EmptyState icon="map-pin" title={before ? "No older places" : "No places yet"} text={before ? "That's everything eGuard has kept." : `Places appear here once ${child.name}'s device shares its location.`} />
        ) : (
          days.map((d) => (
            <div key={d.key} style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, margin: "4px 0 2px" }}>{d.label}</h2>
              <Timeline items={d.visits.map((v) => ({
                id: v.id, icon: "map-pin",
                title: v.placeLabel ?? "Unnamed place",
                by: `${v.device.name} · ${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}`,
                time: span(v.arrivedAt, v.lastSeenAt),
              }))} />
            </div>
          ))
        )}
        {before || nextBefore ? (
          <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
            {before ? <Link className="link-btn" href={`/location/${child.id}`}>Back to newest</Link> : <span />}
            {nextBefore ? <Link className="btn btn-secondary btn-sm" href={`/location/${child.id}?before=${nextBefore.toISOString()}`}>Show older places</Link> : null}
          </div>
        ) : null}
      </section>
    </>
  );
}
