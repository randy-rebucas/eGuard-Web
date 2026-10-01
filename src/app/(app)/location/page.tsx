import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getFamily, getFamilyGraph } from "@/lib/queries";
import { ago } from "@/lib/format";
import { childLocation, recentVisits } from "@/lib/location";
import { entitlementsFor } from "@/lib/plans";
import { LOCATION_UPGRADE } from "@/lib/plan-access";
import { Icon } from "@/components/icon";
import { Avatar, PageHead, UpgradeNote } from "@/components/ui";
import { FlowButton } from "@/components/flow";
import type { MapPerson } from "@/components/family-map";
import { LazyMap, LocationRefresh } from "./lazy-map";

export const metadata = { title: "Location" };

/** Places listed per child under "Recent places" */
const RECENT_PLACES = 3;

export default async function LocationPage() {
  const u = await requireUser();
  const [family, { children }] = await Promise.all([getFamily(u.familyId), getFamilyGraph(u.familyId)]);
  if (!entitlementsFor(family.plan).locationSharing) {
    return (
      <>
        <PageHead title="Family Location" text="Where your children are, when they share their location." />
        <section className="card card-pad"><UpgradeNote icon="map-pin-off" title="Location sharing isn't on your plan" text={`${LOCATION_UPGRADE} ${family.plan} keeps protections and screen time; location stays off.`} /></section>
      </>
    );
  }
  const tz = family.timezone;
  const rows = children.map((c) => ({ c, l: childLocation(c.devices) }));
  // History on: each child's last few places from the past day, with a link to all of them
  const recent = family.keepLocationHistory ? await recentVisits(children.filter((c) => c.devices.length).map((c) => c.id), RECENT_PLACES) : [];
  const people: MapPerson[] = rows.filter(({ l }) => l.location).map(({ c, l }) => ({
    id: c.id, name: c.name, hue: c.hue, lat: l.location!.lat!, lng: l.location!.lng!,
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
        <div className="map"><LazyMap people={people} missing={rows.filter(({ l }) => !l.location).map(({ c }) => c.name)} /></div>
        <div className="dash-col">
          <section className="card card-pad">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Children</h2></div>
            {rows.map(({ c, l }) => (
              <div className="setting-row" key={c.id}>
                <Avatar name={c.name} hue={c.hue} />
                <div className="grow">
                  <div className="t-title">{c.name}</div>
                  <div className="t-meta">
                    {l.state === "located" ? `${l.location!.placeLabel ?? "Current location"}${l.approximate ? " (approximate)" : ""} · ${ago(l.locatedAt, tz)} · ${l.device!.name}`
                      : l.state === "waiting" ? "Sharing is on. Waiting for the first location from the device."
                      : l.state === "no_devices" ? "No device paired yet"
                      : l.offDevice ? `Sharing is off on ${l.offDevice.name}` : "Location sharing is off"}
                  </div>
                </div>
                {l.state === "located" ? (
                  l.fresh
                    ? <span className="pill tone-ok"><span className="dot" style={{ background: "var(--ok)" }} />Live</span>
                    : <span className="pill tone-warn" title={`Last location ${ago(l.locatedAt, tz)}`}><Icon name="history" />Last seen</span>
                ) : l.state === "waiting" ? <span className="pill tone-muted"><Icon name="loader-circle" />Waiting</span>
                  : l.state === "no_devices" ? <Link className="btn btn-secondary btn-sm" href="/devices#pair">Pair a device</Link>
                  : <FlowButton protection="LOCATION" childId={c.id}>Turn on</FlowButton>}
              </div>
            ))}
          </section>
          {family.keepLocationHistory ? (
            <section className="card card-pad" aria-labelledby="recent-places">
              <div className="card-head"><h2 id="recent-places" style={{ fontSize: 18 }}>Recent places</h2></div>
              {rows.filter(({ c }) => c.devices.length).map(({ c }) => {
                const places = recent.filter((v) => v.childId === c.id);
                return (
                  <div className="setting-row" key={c.id}>
                    <Avatar name={c.name} hue={c.hue} />
                    <div className="grow">
                      <div className="t-title">{c.name}</div>
                      <div className="t-meta">{places.length ? places.map((v) => `${v.placeLabel ?? "Unnamed place"} (${ago(v.arrivedAt, tz)})`).join(" · ") : "No places in the last day"}</div>
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
