import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayKey, getFamily } from "@/lib/queries";
import { isDayKey, shiftDay, stayed, visitSpan, visitsForDay, visitsPage } from "@/lib/location";
import { listPlaces } from "@/lib/places";
import { MAX_PLACES } from "@/lib/place-radii";
import { tileAttribution } from "@/lib/map-tiles";
import { NamePlaceButton } from "@/components/place-forms";
import { entitlementsFor } from "@/lib/plans";
import { LOCATION_UPGRADE } from "@/lib/plan-access";
import { childPhotoSrc } from "@/lib/child-photo";
import { dayGroup } from "@/lib/mobile-views";
import { Icon } from "@/components/icon";
import { Avatar, EmptyState, PageHead, Timeline, UpgradeNote } from "@/components/ui";
import type { MapStop } from "@/components/family-map";
import { LazyMap } from "../lazy-map";

const PAGE = 50;

export async function generateMetadata(props: PageProps<"/location/[childId]">) {
  const { childId } = await props.params;
  const u = await getUser();
  const c = u ? await db.child.findFirst({ where: { id: childId, familyId: u.familyId }, select: { name: true } }) : null;
  return { title: c ? `${c.name}'s places` : "Location history" };
}

type Visit = Awaited<ReturnType<typeof visitsPage>>["visits"][number];

/**
 * Location history for one child. By day (the default, `?day=`): that day's route on a map and its visits in
 * order, numbered as on the map. All places (`?view=all`): every visit kept, newest first, 50 at a time.
 */
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
  const base = `/location/${child.id}`;
  const view = sp.view === "all" ? "all" : "day";
  const today = dayKey(new Date(), tz);
  // Nothing older than the retention period is kept, so there's no point going further back
  const earliest = shiftDay(today, -(family.retentionDays - 1));
  const day = isDayKey(sp.day) && sp.day <= today && sp.day >= earliest ? sp.day : today;
  const focus = typeof sp.focus === "string" ? sp.focus : undefined;
  const placeCount = await db.place.count({ where: { familyId: u.familyId } });

  // A place they stayed at with no name yet: name it here, and every visit there reads it
  const nameIt = (v: Visit) => stayed(v) && !v.placeId && placeCount < MAX_PLACES ? <NamePlaceButton lat={v.lat} lng={v.lng} /> : null;
  const row = (v: Visit, n?: number) => {
    const stay = stayed(v);
    // On a day's map, stay on that day: a visit from before midnight is on it too, and its own day may be past retention
    const showOnMap = `${base}?day=${view === "day" ? day : dayKey(v.arrivedAt, tz)}&focus=${v.id}`;
    return {
      id: v.id, icon: stay ? "map-pin" : "route",
      title: `${n ? `${n}. ` : ""}${stay ? v.placeLabel ?? "Unnamed place" : v.placeLabel ? `Passed by ${v.placeLabel}` : "Passing by"}`,
      // A removed device's visits stay in the child's history
      by: `${v.device?.name ?? "Removed device"} · ${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}`,
      time: visitSpan(v, tz),
      action: (
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          {view === "day" && focus === v.id ? null : <Link className="link-btn" href={showOnMap} aria-label={`Show ${stay ? v.placeLabel ?? "this place" : "this spot"} on the map`}>Show on map</Link>}
          {nameIt(v)}
        </div>
      ),
    };
  };

  return (
    <>
      <PageHead
        crumbs={[{ href: "/location", label: "Location" }]}
        title={`${child.name}'s places`}
        text={family.keepLocationHistory
          ? `Where ${child.name} went, and spots passed on the way. Kept for ${family.retentionDays} days, then deleted.`
          : "Location history is off, so eGuard keeps only the latest location."}
      >
        <Avatar name={child.name} hue={child.hue} size="lg" photo={childPhotoSrc(child.id, child.photo)} />
      </PageHead>

      {!family.keepLocationHistory ? (
        <section className="card card-pad">
          <EmptyState icon="history" title="Location history is off" text={`Turn it on in Privacy settings to see where ${child.name} has been.${u.role === "FAMILY_ADMIN" ? "" : " Only the family admin can change it."}`}>
            <Link className="btn btn-secondary" href="/settings/privacy">Privacy settings</Link>
          </EmptyState>
        </section>
      ) : (
        <>
          <nav className="tabs" aria-label="Show places" style={{ marginBottom: 16, width: "fit-content" }}>
            <Link className="tab" href={base} aria-current={view === "day" ? "page" : undefined}>By day</Link>
            <Link className="tab" href={`${base}?view=all`} aria-current={view === "all" ? "page" : undefined}>All places</Link>
          </nav>
          {view === "day"
            ? <DayView childId={child.id} childName={child.name} familyId={u.familyId} day={day} today={today} earliest={earliest} focus={focus} tz={tz} base={base} row={row} />
            : <AllView childId={child.id} childName={child.name} before={typeof sp.before === "string" && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before) : undefined} tz={tz} base={base} row={row} />}
        </>
      )}
    </>
  );
}

type RowFn = (v: Visit, n?: number) => React.ComponentProps<typeof Timeline>["items"][number];

/** One day: the route on a map, then each visit in order. Stays are numbered as on the map. */
async function DayView({ childId, childName, familyId, day, today, earliest, focus, tz, base, row }: {
  childId: string; childName: string; familyId: string; day: string; today: string; earliest: string; focus?: string; tz: string; base: string; row: RowFn;
}) {
  const [{ visits, thinned }, places] = await Promise.all([visitsForDay(childId, day, tz), listPlaces(familyId)]);
  let n = 0;
  const numbered = visits.map((v) => ({ v, n: stayed(v) ? ++n : undefined }));
  const trail: MapStop[] = numbered.map(({ v, n }) => ({
    id: v.id, n: n ?? 0, lat: v.lat, lng: v.lng, stayed: n != null, time: visitSpan(v, tz),
    label: n != null ? v.placeLabel ?? "Unnamed place" : v.placeLabel ? `Passed by ${v.placeLabel}` : "Passing by",
  }));
  const label = dayGroup(new Date(`${day}T12:00:00Z`), "UTC", new Date(`${today}T12:00:00Z`)).label;
  const prev = day > earliest ? shiftDay(day, -1) : null;
  const next = day < today ? shiftDay(day, 1) : null;

  return (
    <section className="card card-pad">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          {prev ? <Link className="btn btn-secondary btn-sm" href={`${base}?day=${prev}`} aria-label="Previous day"><Icon name="chevron-left" /></Link> : <span className="btn btn-secondary btn-sm" aria-disabled="true" aria-label="Previous day (nothing older is kept)"><Icon name="chevron-left" /></span>}
          <h2 style={{ fontSize: 18, margin: 0, minWidth: 110, textAlign: "center" }}>{label}</h2>
          {next ? <Link className="btn btn-secondary btn-sm" href={`${base}?day=${next}`} aria-label="Next day"><Icon name="chevron-right" /></Link> : <span className="btn btn-secondary btn-sm" aria-disabled="true" aria-label="Next day (this is today)"><Icon name="chevron-right" /></span>}
        </div>
        <form method="get" action={base} className="row" style={{ gap: 8 }}>
          <label className="sr-only" htmlFor="day">Go to a day</label>
          <input className="input" id="day" name="day" type="date" defaultValue={day} min={earliest} max={today} />
          <button className="btn btn-secondary btn-sm" type="submit">Go</button>
        </form>
      </div>
      {visits.length ? (
        <>
          <div className="map" style={{ marginBottom: 16 }}>
            <LazyMap people={[]} places={places} trail={trail} focus={focus} attribution={tileAttribution()} label={`${childName}'s route, ${label}`} />
          </div>
          {thinned ? <p className="t-meta" role="note" style={{ marginBottom: 8 }}>A busy day: some spots {childName} passed on the way are left out so the route stays readable. Every place {childName} stayed is shown.</p> : null}
          <Timeline items={numbered.map(({ v, n }) => row(v, n))} />
        </>
      ) : (
        <EmptyState icon="map-pin" title="No places this day" text={day === today ? `Places appear here once ${childName}'s device shares its location today.` : `eGuard has no location for ${childName} on this day.`} />
      )}
    </section>
  );
}

/** Every visit kept, newest first, grouped by day, 50 at a time. Each day links to its map. */
async function AllView({ childId, childName, before, tz, base, row }: { childId: string; childName: string; before?: Date; tz: string; base: string; row: RowFn }) {
  const { visits, nextBefore } = await visitsPage(childId, { before, limit: PAGE });
  const days: { key: string; label: string; visits: Visit[] }[] = [];
  for (const v of visits) {
    const g = dayGroup(v.arrivedAt, tz);
    if (days.at(-1)?.key !== g.key) days.push({ ...g, visits: [] });
    days.at(-1)!.visits.push(v);
  }
  return (
    <section className="card card-pad">
      {!days.length ? (
        <EmptyState icon="map-pin" title={before ? "No older places" : "No places yet"} text={before ? "That's everything eGuard has kept." : `Places appear here once ${childName}'s device shares its location.`} />
      ) : (
        days.map((d) => (
          <div key={d.key} style={{ marginBottom: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", margin: "4px 0 2px" }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>{d.label}</h2>
              <Link className="link-btn" href={`${base}?day=${d.key}`}>Map of the day</Link>
            </div>
            <Timeline items={d.visits.map((v) => row(v))} />
          </div>
        ))
      )}
      {before || nextBefore ? (
        <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
          {before ? <Link className="link-btn" href={`${base}?view=all`}>Back to newest</Link> : <span />}
          {nextBefore ? <Link className="btn btn-secondary btn-sm" href={`${base}?view=all&before=${nextBefore.toISOString()}`}>Show older places</Link> : null}
        </div>
      ) : null}
    </section>
  );
}
