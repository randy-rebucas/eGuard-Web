import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dateFromKey, dayKey, getFamily, getFamilyGraph, limitOn } from "@/lib/queries";
import { db } from "@/lib/db";
import { fmtMinutes, fmtMinutesPadded } from "@/lib/protections";
import { Icon } from "@/components/icon";
import { EmptyState, PageHead, UpgradeNote } from "@/components/ui";
import { childLimitReached } from "@/lib/family-service";
import { ChildCard } from "@/components/cards";
import { entitlementsFor } from "@/lib/plans";
import { locationOf } from "@/lib/views";

export const metadata = { title: "Children" };

const LOCATION_LABEL = { available: "Available", waiting: "Waiting for first location", off: "Sharing off", nodevice: "No device", plan: "Not on your plan" } as const;

export default async function ChildrenPage() {
  const u = await requireUser();
  const [family, { children }] = await Promise.all([getFamily(u.familyId), getFamilyGraph(u.familyId)]);
  const full = childLimitReached(family.plan, children.length);
  const tz = family.timezone, todayKey = dayKey(new Date(), tz);
  const locationSharing = entitlementsFor(family.plan).locationSharing;
  const usage = await db.screenTimeDaily.groupBy({ by: ["childId"], where: { child: { familyId: u.familyId }, date: dateFromKey(todayKey) }, _sum: { minutes: true } });

  return (
    <>
      <PageHead title="Children" text="Each child's protection status and devices. Select a child to adjust their protections.">
        {full ? <Link className="btn btn-secondary" href="/settings/subscription"><Icon name="crown" />Upgrade to add more</Link> : <Link className="btn btn-primary" href="/children/new"><Icon name="plus" />Add child</Link>}
      </PageHead>
      {full ? <UpgradeNote compact title="Child limit" text={full} /> : null}
      {children.length ? (
        <>
          <div className="children-grid">{children.map((c) => <ChildCard key={c.id} c={c} />)}</div>
          <section className="card card-pad">
            <div className="card-head"><h2>At a glance</h2></div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Child</th><th>Protection health</th><th>Devices</th><th>Screen time today</th><th>Location</th></tr></thead>
                <tbody>
                  {children.map((c) => {
                    const used = usage.find((x) => x.childId === c.id)?._sum.minutes ?? 0;
                    const loc = locationOf(c, locationSharing, tz);
                    return (
                      <tr key={c.id}>
                        <td><Link className="link-btn" href={`/children/${c.id}`}>{c.name}</Link></td>
                        {/* Say when part of the score is an offline device's last known state, as the card's status does */}
                        <td>{c.devices.length ? `${c.health.score} / ${c.health.total}${c.health.offline ? `, ${c.health.offline} offline` : ""}` : "No devices yet"}</td>
                        <td>{c.devices.length}</td>
                        <td>{fmtMinutesPadded(used)} of {fmtMinutes(limitOn(c, todayKey))}</td>
                        <td>{LOCATION_LABEL[loc.state]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="card card-pad">
          <EmptyState icon="users" title="No children yet" text="Add a child to start setting up protections.">
            <Link className="btn btn-primary" href="/children/new"><Icon name="plus" />Add child</Link>
          </EmptyState>
        </section>
      )}
    </>
  );
}
