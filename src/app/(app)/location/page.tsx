import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getFamily, getFamilyGraph } from "@/lib/queries";
import { ago } from "@/lib/format";
import { childLocation, locationPolicy, recentVisits, waitingText } from "@/lib/location";
import { listPlaces } from "@/lib/places";
import { MAX_PLACES } from "@/lib/place-radii";
import { tileAttribution } from "@/lib/map-tiles";
import { entitlementsFor } from "@/lib/plans";
import { LOCATION_UPGRADE } from "@/lib/plan-access";
import { Icon } from "@/components/icon";
import { Avatar, EmptyState, PageHead, UpgradeNote } from "@/components/ui";
import { FlowButton } from "@/components/flow";
import { NamePlaceButton, PlaceRow } from "@/components/place-forms";
import type { MapPerson } from "@/components/family-map";
import { LazyMap, LocationRefresh } from "./lazy-map";

export const metadata = { title: "Location" };

/** Places listed per child under "Recent places" */
const RECENT_PLACES = 3;

/** `?child=` centres the map on that child (the child page's "Open map"). */
export default async function LocationPage(props: PageProps<"/location">) {
  const u = await requireUser();
  const sp = await props.searchParams;
  const [family, { children }] = await Promise.all([getFamily(u.familyId), getFamilyGraph(u.familyId)]);
  if (!entitlementsFor(family.plan).locationSharing) {
    return (
      <>
        <PageHead title="Family Location" text="Where your children are, when they share their location." />
        <section className="card card-pad"><UpgradeNote icon="map-pin-off" title="Location sharing isn't on your plan" text={`${LOCATION_UPGRADE} ${family.plan} keeps protections and screen time; location stays off.`} /></section>
      </>
    );
  }
  if (!children.length) {
    return (
      <>
        <PageHead title="Family Location" text="Where your children are, when they share their location." />
        <section className="card card-pad">
          <EmptyState icon="map-pin" title="No children yet" text="Add a child, then pair their phone or tablet and turn on location sharing to see them here.">
            <Link className="btn btn-primary" href="/children/new"><Icon name="plus" />Add child</Link>
          </EmptyState>
        </section>
      </>
    );
  }
  const tz = family.timezone;
  const rows = children.map((c) => ({ c, l: childLocation(c.devices, undefined, locationPolicy(c.policies)) }));
  // History on: each child's last few places from the past day, with a link to all of them
  const [recent, places] = await Promise.all([
    family.keepLocationHistory ? recentVisits(children.filter((c) => c.devices.length).map((c) => c.id), RECENT_PLACES) : [],
    listPlaces(u.familyId),
  ]);
  const people: MapPerson[] = rows.filter(({ l }) => l.location).map(({ c, l }) => ({
    id: c.id, name: c.name, hue: c.hue, photo: c.photo, lat: l.location!.lat!, lng: l.location!.lng!,
    label: `${l.location!.placeLabel ?? "Current location"}${l.approximate ? " (approximate)" : ""}`,
    age: l.fresh ? ago(l.locatedAt, tz) : `Last seen ${ago(l.locatedAt, tz)}`,
    stale: !l.fresh,
    accuracyM: l.location!.accuracyM,
  }));

  return (
    <>
      <LocationRefresh />
      <PageHead title="Family Location" text="Where your children are, or were last seen, when they share their location. Updates every 30 seconds while this page is open." />
      <div className="detail-grid">
        <div className="map"><LazyMap people={people} missing={rows.filter(({ l }) => !l.location).map(({ c }) => c.name)} places={places} focus={typeof sp.child === "string" ? sp.child : undefined} attribution={tileAttribution()} /></div>
        <div className="dash-col">
          <section className="card card-pad">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Children</h2></div>
            {rows.map(({ c, l }) => (
              <div className="setting-row" key={c.id}>
                <Avatar name={c.name} hue={c.hue} photo={c.photo} />
                <div className="grow">
                  <div className="t-title">{c.name}</div>
                  <div className="t-meta">
                    {l.state === "located" ? `${l.location!.placeLabel ?? "Current location"}${l.approximate ? " (approximate)" : ""} · ${ago(l.locatedAt, tz)} · ${l.device!.name}`
                      : l.state === "waiting" ? waitingText(l)
                      : l.state === "no_devices" ? "No device paired yet"
                      : l.offDevice ? `Sharing is off on ${l.offDevice.name}` : "Location sharing is off"}
                  </div>
                  {/* Not inside a saved place: offer to name where they are, so it reads "Home" from now on */}
                  {l.location && !l.location.placeId && places.length < MAX_PLACES ? <NamePlaceButton lat={l.location.lat!} lng={l.location.lng!} label={`Name ${c.name}'s place`} /> : null}
                </div>
                {l.state === "located" ? (
                  l.fresh
                    ? <span className="pill tone-ok"><span className="dot" style={{ background: "var(--ok)" }} />Live</span>
                    : <span className="pill tone-warn" title={`Last location ${ago(l.locatedAt, tz)}`}><Icon name="history" />Last seen</span>
                ) : l.state === "waiting" ? <span className="pill tone-muted"><Icon name="loader-circle" />Waiting</span>
                  : l.state === "no_devices" ? <Link className="btn btn-secondary btn-sm" href={`/devices?child=${c.id}#pair`}>Pair a device</Link>
                  : <FlowButton protection="LOCATION" childId={c.id}>Turn on</FlowButton>}
              </div>
            ))}
          </section>
          <section className="card card-pad" aria-labelledby="saved-places">
            <div className="card-head"><h2 id="saved-places" style={{ fontSize: 18 }}>Saved places</h2></div>
            {places.length ? places.map((p) => <PlaceRow key={p.id} place={p} />) : (
              <p className="t-meta">Name the places your children go, like Home or School, and their location and visits there show the name. Name one from a child&apos;s current location above, or from a visit in their places.</p>
            )}
          </section>
          {family.keepLocationHistory ? (
            <section className="card card-pad" aria-labelledby="recent-places">
              <div className="card-head"><h2 id="recent-places" style={{ fontSize: 18 }}>Recent places</h2></div>
              {rows.filter(({ c }) => c.devices.length).map(({ c }) => {
                const visits = recent.filter((v) => v.childId === c.id);
                return (
                  <div className="setting-row" key={c.id}>
                    <Avatar name={c.name} hue={c.hue} photo={c.photo} />
                    <div className="grow">
                      <div className="t-title">{c.name}</div>
                      <div className="t-meta">{visits.length ? visits.map((v) => `${v.placeLabel ?? "Unnamed place"} (${ago(v.arrivedAt, tz)})`).join(" · ") : "No places in the last day"}</div>
                    </div>
                    <Link className="link-btn" href={`/location/${c.id}`}>View all</Link>
                  </div>
                );
              })}
            </section>
          ) : null}
          <section className="card card-pad">
            <div className="row">
              <Icon name="eye-off" />
              <div className="grow">
                <div className="t-title">Location history is {family.keepLocationHistory ? "on" : "off"}</div>
                <div className="t-meta">
                  {family.keepLocationHistory
                    ? `Places your children visit are kept for ${family.retentionDays} days, then deleted.`
                    : "Only each device's latest location is kept, and it's deleted when sharing is turned off."}
                </div>
              </div>
              <Link className="link-btn" href="/settings/privacy">Privacy</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
