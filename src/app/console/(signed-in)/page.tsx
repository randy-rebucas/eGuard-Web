import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { overview } from "@/lib/console-queries";

export const metadata = { title: "Overview" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

export default async function ConsoleHome() {
  await requireStaff();
  const o = await overview();
  const stats = [
    { label: "Families", value: o.families, href: "/families" },
    { label: "New in 7 days", value: o.week },
    { label: "New in 30 days", value: o.month },
    { label: "Parents", value: o.parents },
    { label: "Children", value: o.children },
    { label: "Devices", value: o.devices },
    { label: "Browsers", value: o.browsers },
    { label: "Open tickets", value: o.openTickets, href: "/tickets?status=OPEN" },
    { label: "Organizations", value: o.organizations, href: "/organizations" },
  ];
  return (
    <>
      <h1 className="cn-h1">Overview</h1>
      <div className="cn-stats">
        {stats.map((s) => {
          const body = <><span className="cn-stat-value num">{s.value.toLocaleString("en-US")}</span><span className="cn-stat-label">{s.label}</span></>;
          return s.href
            ? <Link key={s.label} href={s.href} className="card cn-stat cn-stat-link">{body}</Link>
            : <div key={s.label} className="card cn-stat">{body}</div>;
        })}
      </div>
      <section className="card card-pad">
        <div className="card-head"><h2>Families by plan</h2></div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Plan</th><th>Families</th></tr></thead>
            <tbody>
              {o.plans.map((p) => <tr key={p.plan}><td>{p.plan}</td><td>{p.families.toLocaleString("en-US")}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
