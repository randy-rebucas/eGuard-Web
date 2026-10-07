import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { TICKET_STATUSES, isTicketStatus, listTickets } from "@/lib/console-queries";
import { beforeParam, stamp } from "../../format";
import { Empty, Pager, TicketPill } from "../../ui";

export const metadata = { title: "Tickets" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

export default async function TicketsPage(props: PageProps<"/console/tickets">) {
  await requireStaff();
  const sp = await props.searchParams;
  const status = isTicketStatus(sp.status) ? sp.status : null, before = beforeParam(sp.before);
  const { rows, nextBefore } = await listTickets(status, before);
  const filters = [{ value: "", label: "All" }, ...TICKET_STATUSES.map((s) => ({ value: s, label: s === "OPEN" ? "Open" : "Closed" }))];
  return (
    <>
      <h1 className="cn-h1">Support tickets</h1>
      <nav className="cn-tabs" aria-label="Filter by status">
        {filters.map((f) => (
          <Link key={f.value} href={f.value ? `/tickets?status=${f.value}` : "/tickets"} className="cn-tab" aria-current={(status ?? "") === f.value ? "page" : undefined}>{f.label}</Link>
        ))}
      </nav>
      <section className="card">
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Subject</th><th>From</th><th>Family</th><th>Category</th><th>Status</th><th>Sent</th></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td><Link prefetch={false} className="inline-link" href={`/tickets/${t.id}`}>{t.subject}</Link></td>
                    <td>{t.user?.email ?? "—"}</td>
                    <td><Link prefetch={false} className="inline-link" href={`/families/${t.family.id}`}>{t.family.name}</Link></td>
                    <td>{t.category}</td>
                    <td><TicketPill status={t.status} /></td>
                    <td>{stamp(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No tickets here.</Empty>}
      </section>
      <Pager nextBefore={nextBefore} paged={!!before} query={{ status: status ?? "" }} />
    </>
  );
}
