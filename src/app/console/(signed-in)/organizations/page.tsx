import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { listOrganizations } from "@/lib/console-queries";
import { beforeParam, day } from "../../format";
import { Empty, Pager } from "../../ui";

export const metadata = { title: "Organizations" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

export default async function OrganizationsPage(props: PageProps<"/console/organizations">) {
  await requireStaff();
  const before = beforeParam((await props.searchParams).before);
  const { rows, nextBefore } = await listOrganizations(before);
  return (
    <>
      <h1 className="cn-h1">Organizations</h1>
      <section className="card">
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Name</th><th>Kind</th><th>Admins</th><th>Families</th><th>Code batches</th><th>Created</th></tr></thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td><Link prefetch={false} className="inline-link" href={`/organizations/${o.id}`}>{o.name}</Link></td>
                    <td>{o.kind.toLowerCase()}</td>
                    <td>{o._count.members}</td>
                    <td>{o._count.memberships}</td>
                    <td>{o._count.batches}</td>
                    <td>{day(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No organizations yet.</Empty>}
      </section>
      <Pager nextBefore={nextBefore} paged={!!before} />
    </>
  );
}
