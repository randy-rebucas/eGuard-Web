import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFamily } from "@/lib/queries";
import { stayed, visitSpan, visitsPage } from "@/lib/location";
import { MAX_PLACES } from "@/lib/place-radii";
import { NamePlaceButton } from "@/components/place-forms";
import { entitlementsFor } from "@/lib/plans";
import { LOCATION_UPGRADE } from "@/lib/plan-access";
import { childPhotoSrc } from "@/lib/child-photo";
import { dayGroup } from "@/lib/mobile-views";
import { Avatar, EmptyState, PageHead, Timeline, UpgradeNote } from "@/components/ui";

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
  const [child, family] = await Promise.all([db.child.findFirst({ where: { id: childId, familyId: u.familyId }, include: { photo: { select: { updatedAt: true, contentType: true } } } }), getFamily(u.familyId)]);
  if (!child) notFound();
  if (!entitlementsFor(family.plan).locationSharing) {
    return (
      <>
        <PageHead crumbs={[{ href: "/location", label: "Location" }]} title={`${child.name}'s places`} />
        <section className="card card-pad"><UpgradeNote icon="map-pin-off" title="Location sharing isn't on your plan" text={`${LOCATION_UPGRADE} ${family.plan} keeps protections and screen time; location stays off.`} /></section>
      </>
    );
  }
  const tz = family.timezone;
  const before = typeof sp.before === "string" && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before) : undefined;
  const [{ visits, nextBefore }, placeCount] = await Promise.all([
    family.keepLocationHistory ? visitsPage(child.id, { before, limit: PAGE }) : { visits: [] as Awaited<ReturnType<typeof visitsPage>>["visits"], nextBefore: null },
    db.place.count({ where: { familyId: u.familyId } }),
  ]);

  const days: { key: string; label: string; visits: typeof visits }[] = [];
  for (const v of visits) {
    const g = dayGroup(v.arrivedAt, tz);
    if (days.at(-1)?.key !== g.key) days.push({ ...g, visits: [] });
    days.at(-1)!.visits.push(v);
  }

  return (
    <>
      <PageHead
        crumbs={[{ href: "/location", label: "Location" }]}
        title={`${child.name}'s places`}
        text={family.keepLocationHistory
          ? `Places ${child.name} stayed at, newest first, and spots passed on the way. Kept for ${family.retentionDays} days, then deleted.`
          : "Location history is off, so eGuard keeps only the latest location."}
      >
        <Avatar name={child.name} hue={child.hue} size="lg" photo={childPhotoSrc(child.id, child.photo)} />
      </PageHead>

      <section className="card card-pad">
        {!family.keepLocationHistory ? (
          <EmptyState icon="history" title="Location history is off" text={`Turn it on in Privacy settings to see where ${child.name} has been.${u.role === "FAMILY_ADMIN" ? "" : " Only the family admin can change it."}`}>
            <Link className="btn btn-secondary" href="/settings/privacy">Privacy settings</Link>
          </EmptyState>
        ) : !days.length ? (
          <EmptyState icon="map-pin" title={before ? "No older places" : "No places yet"} text={before ? "That's everything eGuard has kept." : `Places appear here once ${child.name}'s device shares its location.`} />
        ) : (
          days.map((d) => (
            <div key={d.key} style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, margin: "4px 0 2px" }}>{d.label}</h2>
              <Timeline items={d.visits.map((v) => {
                const stay = stayed(v);
                return {
                  id: v.id, icon: stay ? "map-pin" : "route",
                  title: stay ? v.placeLabel ?? "Unnamed place" : v.placeLabel ? `Passed by ${v.placeLabel}` : "Passing by",
                  // A removed device's visits stay in the child's history
                  by: `${v.device?.name ?? "Removed device"} · ${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}`,
                  time: visitSpan(v, tz),
                  // A place they stayed at with no name yet: name it here, and every visit there reads it
                  action: stay && !v.placeId && placeCount < MAX_PLACES ? <NamePlaceButton lat={v.lat} lng={v.lng} /> : null,
                };
              })} />
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
