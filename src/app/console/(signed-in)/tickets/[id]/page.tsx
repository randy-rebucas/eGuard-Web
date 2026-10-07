import Link from "next/link";
import { notFound } from "next/navigation";
import { logStaff, requireStaff } from "@/lib/staff-auth";
import { ticketDetail } from "@/lib/console-queries";
import { setTicketStatus } from "@/app/actions/console";
import { stamp } from "../../../format";
import { TicketPill } from "../../../ui";

export const metadata = { title: "Ticket" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

export default async function TicketPage(props: PageProps<"/console/tickets/[id]">) {
  const staff = await requireStaff();
  const { id } = await props.params;
  const t = await ticketDetail(id);
  if (!t) notFound();
  await logStaff(staff.id, "ticket.view", `ticket:${t.id}`);
  const next = t.status === "OPEN" ? "CLOSED" : "OPEN";
  return (
    <>
      <div>
        <p className="cn-eyebrow"><Link className="inline-link" href="/tickets">Support tickets</Link></p>
        <h1 className="cn-h1">{t.subject}</h1>
      </div>
      <section className="card card-pad">
        <div className="card-head">
          <TicketPill status={t.status} />
          <form action={setTicketStatus}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="status" value={next} />
            <button className="btn btn-secondary btn-sm">{next === "CLOSED" ? "Close ticket" : "Reopen ticket"}</button>
          </form>
        </div>
        <dl className="cn-dl">
          <dt>From</dt><dd>{t.user ? `${t.user.name} <${t.user.email}>` : "A parent who has since left the family"}</dd>
          <dt>Family</dt><dd><Link prefetch={false} className="inline-link" href={`/families/${t.family.id}`}>{t.family.name}</Link> · {t.family.plan}</dd>
          <dt>Category</dt><dd>{t.category}</dd>
          <dt>Sent</dt><dd>{stamp(t.createdAt)}</dd>
          <dt>Ticket id</dt><dd className="cn-mono">{t.id}</dd>
        </dl>
        <p className="cn-message">{t.message}</p>
        <p className="cn-muted">Replies go out from the support inbox: the ticket was forwarded there with Reply-To set to the parent.</p>
      </section>
    </>
  );
}
