import Link from "next/link";
import { logStaff, requireStaff } from "@/lib/staff-auth";
import { listChildren } from "@/lib/console-queries";
import { beforeParam, day, one } from "../../format";
import { Empty, Pager } from "../../ui";

export const metadata = { title: "Children" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

/** Children as accounts: first name, age and what's paired. Never their photo, rules, activity or location. */
export default async function ChildrenPage(props: PageProps<"/console/children">) {
  const staff = await requireStaff();
  const sp = await props.searchParams;
  const q = one(sp.q).slice(0, 200), before = beforeParam(sp.before);
  if (q.trim()) await logStaff(staff.id, "child.search", undefined, q.trim());
  const { rows, nextBefore } = await listChildren(q, before);
  const year = new Date().getFullYear();
  return (
    <>
      <h1 className="cn-h1">Children</h1>
      <p className="cn-muted">Profiles and what&apos;s paired to them. Activity, location, rules and photos stay with the family.</p>
      <form className="cn-search" role="search">
        <input className="input" name="q" type="search" defaultValue={q} placeholder="First name, family name, child id or family id" aria-label="Search children" />
        <button className="btn btn-primary">Search</button>
      </form>
      <section className="card">
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Name</th><th>Age</th><th>Family</th><th>Plan</th><th>Devices</th><th>Browsers</th><th>Added</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{year - c.birthYear}</td>
                    <td><Link prefetch={false} className="inline-link" href={`/families/${c.family.id}`}>{c.family.name}</Link></td>
                    <td>{c.family.plan}</td>
                    <td>{c._count.devices}</td>
                    <td>{c._count.browsers}</td>
                    <td>{day(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>{q ? "No child matches that search." : "No children yet."}</Empty>}
      </section>
      <Pager nextBefore={nextBefore} paged={!!before} query={{ q }} />
    </>
  );
}
