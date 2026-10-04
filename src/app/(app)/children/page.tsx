import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dateFromKey, dayKey, getFamily, getFamilyGraph, limitOn } from "@/lib/queries";
import { db } from "@/lib/db";
import { fmtMinutes, fmtMinutesPadded } from "@/lib/protections";
import { Icon } from "@/components/icon";
import { EmptyState, PageHead, UpgradeNote } from "@/components/ui";
import { childLimitReached } from "@/lib/family-service";
import { ChildCard } from "@/components/cards";
import { entitlementsFor, nextPlan } from "@/lib/plans";
import { locationOf } from "@/lib/views";
import { listBrowsers } from "@/lib/browser-service";

export const metadata = { title: "Children" };

const LOCATION_LABEL = { available: "Available", waiting: "Waiting for first location", off: "Sharing off", nodevice: "No device", plan: "Not on your plan" } as const;

export default async function ChildrenPage() {
  const u = await requireUser();
  const [family, { children }, browsers] = await Promise.all([getFamily(u.familyId), getFamilyGraph(u.familyId), listBrowsers(u.familyId)]);
  const { childLimit, locationSharing } = entitlementsFor(family.plan);
  const full = childLimitReached(family.plan, children.length);
  // Full on the top plan: nothing to upgrade to, so no button and no "See plans"
  const upgrade = !!nextPlan(family.plan);
  // After a move to a smaller plan the family can have more children than it covers: say so, as Settings does
  const limitNote = full && children.length > childLimit
    ? `You have ${children.length} children, ${children.length - childLimit} more than ${family.plan} covers. They stay protected; to add more, remove some or upgrade.`
    : full;
  const tz = family.timezone, todayKey = dayKey(new Date(), tz);
  const usage = await db.screenTimeDaily.groupBy({ by: ["childId"], where: { child: { familyId: u.familyId }, date: dateFromKey(todayKey) }, _sum: { minutes: true } });
  // Browsers count as devices on the Devices page, except one eGuard disconnected for security
  const browsersOf = (childId: string) => browsers.filter((b) => b.childId === childId && !b.revokedAt).length;

  return (
    <>
      <PageHead title="Children" text="Each child's protection status and devices. Select a child to adjust their protections.">
        {!full ? <Link className="btn btn-primary" href="/children/new"><Icon name="plus" />Add child</Link>
          : upgrade ? <Link className="btn btn-secondary" href="/settings/subscription"><Icon name="crown" />Upgrade to add more</Link> : null}
      </PageHead>
      {limitNote ? <UpgradeNote compact title="Child limit" text={limitNote} plans={upgrade} /> : null}
      {children.length ? (
        <>
          <div className="children-grid">{children.map((c) => <ChildCard key={c.id} c={c} browsers={browsersOf(c.id)} />)}</div>
          <section className="card card-pad">
            <div className="card-head"><h2>At a glance</h2></div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th scope="col">Child</th><th scope="col">Protection health</th><th scope="col">Devices</th><th scope="col">Screen time today</th><th scope="col">Location</th></tr></thead>
                <tbody>
                  {children.map((c) => {
                    const used = usage.find((x) => x.childId === c.id)?._sum.minutes ?? 0;
                    const limit = limitOn(c, todayKey);
                    const loc = locationOf(c, locationSharing, tz);
                    const b = browsersOf(c.id);
                    return (
                      <tr key={c.id}>
                        <th scope="row"><Link className="link-btn" href={`/children/${c.id}`}>{c.name}</Link></th>
                        {/* Say when part of the score is an offline device's last known state, as the card's status does.
                            Browsers aren't in this score: it's the phone and tablet protections; browsers report their own health */}
                        <td>{c.devices.length ? `${c.health.score} / ${c.health.total}${c.health.offline ? `, ${c.health.offline} offline` : ""}` : b ? "No phone or tablet yet" : "No devices yet"}</td>
                        <td className="num">{c.devices.length + b}{b ? ` (${b} ${b === 1 ? "browser" : "browsers"})` : ""}</td>
                        <td style={used > limit ? { color: "var(--warn-ink)" } : undefined}>{fmtMinutesPadded(used)} of {fmtMinutes(limit)}{used > limit ? `, ${fmtMinutes(used - limit)} over` : ""}</td>
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
