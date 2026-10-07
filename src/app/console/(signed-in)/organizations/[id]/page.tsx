import Link from "next/link";
import { notFound } from "next/navigation";
import { logStaff, requireStaff } from "@/lib/staff-auth";
import { organizationDetail } from "@/lib/console-queries";
import { peso } from "@/lib/format";
import { day } from "../../../format";
import { Empty } from "../../../ui";

export const metadata = { title: "Organization" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

export default async function OrganizationPage(props: PageProps<"/console/organizations/[id]">) {
  const staff = await requireStaff();
  const { id } = await props.params;
  const o = await organizationDetail(id);
  if (!o) notFound();
  await logStaff(staff.id, "organization.view", `organization:${o.id}`);
  return (
    <>
      <div>
        <p className="cn-eyebrow"><Link className="inline-link" href="/organizations">Organizations</Link></p>
        <h1 className="cn-h1">{o.name}</h1>
        <p className="cn-muted cn-mono">{o.id}</p>
      </div>

      <section className="card card-pad">
        <dl className="cn-dl">
          <dt>Kind</dt><dd>{o.kind.toLowerCase()}</dd>
          <dt>Join code</dt><dd className="cn-mono">{o.joinCode.slice(0, 4)}-{o.joinCode.slice(4)}</dd>
          <dt>Families joined</dt><dd>{o._count.memberships}</dd>
          <dt>API keys</dt><dd>{o._count.apiKeys}</dd>
          <dt>Created</dt><dd>{day(o.createdAt)}</dd>
        </dl>
      </section>

      <section className="card">
        <div className="card-head card-pad cn-head-flush"><h2>Admins</h2></div>
        <div className="table-scroll">
          <table className="data-table cn-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Since</th></tr></thead>
            <tbody>
              {o.members.map((m) => (
                <tr key={m.user.email}>
                  <td><Link prefetch={false} className="inline-link" href={`/families/${m.user.familyId}`}>{m.user.name}</Link></td>
                  <td>{m.user.email}</td>
                  <td>{m.role === "OWNER" ? "Owner" : "Admin"}</td>
                  <td>{day(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head card-pad cn-head-flush"><h2>Sponsor code batches</h2></div>
        {o.batches.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Plan</th><th>Months</th><th>Codes</th><th>Redeemed</th><th>Amount</th><th>State</th><th>Paid</th></tr></thead>
              <tbody>
                {o.batches.map((b) => (
                  <tr key={b.id}>
                    <td>{b.plan}</td><td>{b.months}</td><td>{b.quantity}</td><td>{b.redeemed}</td>
                    <td>{peso(b.amount)}</td><td>{b.state}</td><td>{day(b.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No batches bought.</Empty>}
      </section>
    </>
  );
}
