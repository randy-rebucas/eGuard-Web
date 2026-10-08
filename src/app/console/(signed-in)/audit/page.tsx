import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { listAudit } from "@/lib/console-queries";
import { beforeParam, stamp } from "../../format";
import { Empty, Pager } from "../../ui";

export const metadata = { title: "Audit log" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

/** "family:clx…" → a link to that record, when the console has a page for it. */
const PAGES: Record<string, string> = { family: "/families", ticket: "/tickets", organization: "/organizations" };
function Target({ target }: { target: string | null }) {
  if (!target) return <>—</>;
  const [kind, id] = target.split(":");
  const base = PAGES[kind];
  return base && id ? <Link prefetch={false} className="inline-link cn-mono" href={`${base}/${id}`}>{target}</Link> : <span className="cn-mono">{target}</span>;
}

export default async function AuditPage(props: PageProps<"/console/audit">) {
  await requireStaff();
  const before = beforeParam((await props.searchParams).before);
  const { rows, nextBefore } = await listAudit(before);
  return (
    <>
      <h1 className="cn-h1">Audit log</h1>
      <p className="cn-muted">Every sign-in, every family search, every account opened and every change made in the console.</p>
      <section className="card">
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>When</th><th>Staff</th><th>Action</th><th>Record</th><th>Detail</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>{stamp(a.createdAt)}</td>
                    <td title={a.staff.email}>{a.staff.name}</td>
                    <td className="cn-mono">{a.action}</td>
                    <td><Target target={a.target} /></td>
                    <td>{a.detail ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Nothing yet.</Empty>}
      </section>
      <Pager nextBefore={nextBefore} paged={!!before} />
    </>
  );
}
