import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getFamily, getFamilyGraph } from "@/lib/queries";
import { ago } from "@/lib/format";
import { Icon } from "@/components/icon";
import { Avatar, PageHead } from "@/components/ui";
import { FlowButton } from "@/components/flow";
import { LazyMap } from "./lazy-map";

export const metadata = { title: "Location" };

export default async function LocationPage() {
  const u = await requireUser();
  const family = await getFamily(u.familyId);
  const { children } = await getFamilyGraph(u.familyId);
  const rows = children.map((c) => {
    const withLoc = c.devices.filter((d) => d.location?.sharing && d.location.lat != null && d.location.lng != null)
      .sort((a, b) => (b.location!.locatedAt ?? b.location!.updatedAt).getTime() - (a.location!.locatedAt ?? a.location!.updatedAt).getTime())[0];
    return { c, loc: withLoc?.location ?? null, device: withLoc ?? null, off: c.devices.find((d) => d.location && !d.location.sharing) ?? null };
  });
  const people = rows.filter((r) => r.loc).map((r) => ({ id: r.c.id, name: r.c.name, hue: r.c.hue, lat: r.loc!.lat!, lng: r.loc!.lng!, label: r.loc!.placeLabel ?? "Current location" }));

  return (
    <>
      <PageHead title="Family Location" text={`Where your children are right now, when they share it. eGuard keeps current location only${family.keepLocationHistory ? "" : " and doesn't record a trail"}.`} />
      <div className="detail-grid">
        <div className="map"><LazyMap people={people} /></div>
        <div className="dash-col">
          <section className="card card-pad">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Children</h2></div>
            {rows.map(({ c, loc, device, off }) => (
              <div className="setting-row" key={c.id}>
                <Avatar name={c.name} hue={c.hue} />
                <div className="grow">
                  <div className="t-title">{c.name}</div>
                  <div className="t-meta">{loc ? `${loc.placeLabel ?? "Current location"} · ${ago((loc.locatedAt ?? loc.updatedAt), family.timezone)} · ${device!.name}` : off ? `Sharing is off on ${off.name}` : "Location unavailable"}</div>
                </div>
                {loc ? <span className="pill tone-ok"><span className="dot" style={{ background: "var(--ok)" }} />Available</span>
                  : <FlowButton protection="LOCATION" childId={c.id}>Turn on</FlowButton>}
              </div>
            ))}
          </section>
          <section className="card card-pad">
            <div className="row">
              <Icon name="eye-off" />
              <div className="grow"><div className="t-title">Location history is {family.keepLocationHistory ? "on" : "off"}</div><div className="t-meta">{family.keepLocationHistory ? "Recent locations are kept for your retention period." : "Only the latest location is kept."}</div></div>
              <Link className="link-btn" href="/settings/privacy">Privacy</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
