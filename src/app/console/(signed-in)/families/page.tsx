import Link from "next/link";
import { logStaff, requireStaff } from "@/lib/staff-auth";
import { searchFamilies } from "@/lib/console-queries";
import { beforeParam, day, one } from "../../format";
import { Empty, Pager } from "../../ui";

export const metadata = { title: "Families" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

export default async function FamiliesPage(props: PageProps<"/console/families">) {
  const staff = await requireStaff();
  const sp = await props.searchParams;
  const q = one(sp.q).slice(0, 200), before = beforeParam(sp.before);
  // A search shows parents' emails, so it's recorded like opening an account (the newest-first list isn't)
  if (q.trim()) await logStaff(staff.id, "family.search", undefined, q.trim());
  const { rows, nextBefore } = await searchFamilies(q, before);
  return (
    <>
      <h1 className="cn-h1">Families</h1>
      <form className="cn-search" role="search">
        <input className="input" name="q" type="search" defaultValue={q} placeholder="Parent email or name, family name or id" aria-label="Search families" />
        <button className="btn btn-primary">Search</button>
      </form>
      <section className="card">
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Family</th><th>Parents</th><th>Plan</th><th>Children</th><th>Devices</th><th>Joined</th></tr></thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id}>
                    <td><Link prefetch={false} className="inline-link" href={`/families/${f.id}`}>{f.name}</Link></td>
                    <td>{f.users.map((u) => u.email).join(", ")}</td>
                    <td>{f.plan}</td>
                    <td>{f._count.children}</td>
                    <td>{f._count.devices}</td>
                    <td>{day(f.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>{q ? "No family matches that search." : "No families yet."}</Empty>}
      </section>
      <Pager nextBefore={nextBefore} paged={!!before} query={{ q }} />
    </>
  );
}
