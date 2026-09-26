import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dateFromKey, dayKey, getFamily, getFamilyGraph } from "@/lib/queries";
import { db } from "@/lib/db";
import { fmtMinutes, fmtMinutesPadded } from "@/lib/protections";
import { Icon } from "@/components/icon";
import { EmptyState, PageHead } from "@/components/ui";
import { ChildCard } from "@/components/cards";

export const metadata = { title: "Children" };

export default async function ChildrenPage() {
  const u = await requireUser();
  const family = await getFamily(u.familyId);
  const { children } = await getFamilyGraph(u.familyId);
  const today = dateFromKey(dayKey(new Date(), family.timezone));
  const usage = await db.screenTimeDaily.groupBy({ by: ["childId"], where: { child: { familyId: u.familyId }, date: today }, _sum: { minutes: true } });

  return (
    <>
      <PageHead title="Children" text="Each child's protection status and devices. Select a child to adjust their protections.">
        <Link className="btn btn-primary" href="/children/new"><Icon name="plus" />Add child</Link>
      </PageHead>
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
                    const sharing = c.devices.some((d) => d.location?.sharing);
                    return (
                      <tr key={c.id}>
                        <td><Link className="link-btn" href={`/children/${c.id}`}>{c.name}</Link></td>
                        <td>{c.health.score} / 10</td>
                        <td>{c.devices.length}</td>
                        <td>{fmtMinutesPadded(used)} of {fmtMinutes(c.dailyLimitMinutes)}</td>
                        <td>{sharing ? "Available" : "Unavailable"}</td>
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
