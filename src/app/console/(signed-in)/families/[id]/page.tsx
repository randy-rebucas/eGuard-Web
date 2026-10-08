import Link from "next/link";
import { notFound } from "next/navigation";
import { logStaff, requireStaff } from "@/lib/staff-auth";
import { familyDetail } from "@/lib/console-queries";
import { currentPurchase, renewalWord } from "@/lib/entitlement";
import { usedDeviceSlots } from "@/lib/device-slots";
import { day, stamp } from "../../../format";
import { Empty, TicketPill } from "../../../ui";

export const metadata = { title: "Family" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

export default async function FamilyPage(props: PageProps<"/console/families/[id]">) {
  const staff = await requireStaff();
  const { id } = await props.params;
  const f = await familyDetail(id);
  if (!f) notFound();
  // Opening an account is recorded, like every change
  await logStaff(staff.id, "family.view", `family:${f.id}`);
  // As the parent sees them in Settings: "Ends" for a pass or a cancelled subscription, and browsers take device slots
  const [purchase, slots] = await Promise.all([currentPurchase(f.id), usedDeviceSlots(f.id)]);
  const kinds = new Map<string, number>();
  for (const d of f.devices) kinds.set(`${d.platform} ${d.kind}`.toLowerCase(), (kinds.get(`${d.platform} ${d.kind}`.toLowerCase()) ?? 0) + 1);
  const deviceKinds = [...kinds].map(([k, n]) => `${n} ${k}`).join(", ");

  return (
    <>
      <div>
        <p className="cn-eyebrow"><Link className="inline-link" href="/families">Families</Link></p>
        <h1 className="cn-h1">{f.name}</h1>
        <p className="cn-muted cn-mono">{f.id}</p>
      </div>

      <section className="card card-pad">
        <div className="card-head"><h2>Account</h2></div>
        <dl className="cn-dl">
          <dt>Plan</dt><dd>{f.plan}{f.renewsAt ? ` · ${renewalWord(purchase).toLowerCase()} ${day(f.renewsAt)}` : ""}</dd>
          <dt>Device slots</dt><dd>{slots} of {f.deviceLimit} used (devices and browsers)</dd>
          <dt>Children</dt><dd>{f._count.children}</dd>
          <dt>Devices</dt><dd>{f._count.devices}{deviceKinds ? ` (${deviceKinds})` : ""}</dd>
          <dt>Browsers</dt><dd>{f._count.browsers}</dd>
          <dt>Saved places</dt><dd>{f._count.places}</dd>
          <dt>Location history</dt><dd>{f.keepLocationHistory ? `Kept ${f.retentionDays} days` : "Off"}</dd>
          <dt>Time zone</dt><dd>{f.timezone}</dd>
          <dt>PayMongo customer</dt><dd className="cn-mono">{f.paymongoCustomerId ?? "—"}</dd>
          <dt>Joined</dt><dd>{stamp(f.createdAt)}</dd>
        </dl>
      </section>

      <section className="card">
        <div className="card-head card-pad cn-head-flush"><h2>Parents</h2></div>
        <div className="table-scroll">
          <table className="data-table cn-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Verified</th><th>Sign-in</th><th>Two-step</th><th>Last active</th></tr></thead>
            <tbody>
              {f.users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role === "FAMILY_ADMIN" ? "Admin" : "Parent"}</td>
                  <td>{u.emailVerifiedAt ? "Yes" : "No"}</td>
                  <td>{[u.passwordSet ? "Password" : null, ...u.identities.map((i) => i.provider)].filter(Boolean).join(", ") || "Invited"}</td>
                  <td>{u.twoFactor ? "On" : "Off"}</td>
                  <td>{stamp(u.sessions[0]?.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head card-pad cn-head-flush"><h2>Purchases</h2></div>
        {f.purchases.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Product</th><th>Store</th><th>State</th><th>Renews</th><th>Ends</th><th>Bought</th></tr></thead>
              <tbody>
                {f.purchases.map((p) => (
                  <tr key={p.id}>
                    <td>{p.productId}</td><td>{p.store}</td><td>{p.state}</td><td>{p.autoRenewing ? "Yes" : "No"}</td>
                    <td>{day(p.expiresAt)}</td><td>{day(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No purchases.</Empty>}
      </section>

      <section className="card">
        <div className="card-head card-pad cn-head-flush"><h2>Support tickets</h2></div>
        {f.supportTickets.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Subject</th><th>Category</th><th>Status</th><th>Sent</th></tr></thead>
              <tbody>
                {f.supportTickets.map((t) => (
                  <tr key={t.id}>
                    <td><Link prefetch={false} className="inline-link" href={`/tickets/${t.id}`}>{t.subject}</Link></td>
                    <td>{t.category}</td><td><TicketPill status={t.status} /></td><td>{stamp(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No tickets.</Empty>}
      </section>

      <section className="card">
        <div className="card-head card-pad cn-head-flush"><h2>Organizations and sponsor codes</h2></div>
        {f.orgMemberships.length || f.vouchers.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Organization</th><th>What</th><th>When</th></tr></thead>
              <tbody>
                {f.orgMemberships.map((m) => (
                  <tr key={`m-${m.org.id}`}>
                    <td><Link prefetch={false} className="inline-link" href={`/organizations/${m.org.id}`}>{m.org.name}</Link></td>
                    <td>Joined</td><td>{day(m.joinedAt)}</td>
                  </tr>
                ))}
                {f.vouchers.map((v) => (
                  <tr key={`v-${v.code}`}>
                    <td><Link prefetch={false} className="inline-link" href={`/organizations/${v.batch.org.id}`}>{v.batch.org.name}</Link></td>
                    <td>Redeemed a code: {v.batch.plan}, {v.batch.months} mo{v.revokedAt ? " (cancelled)" : ""}</td>
                    <td>{day(v.redeemedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>None.</Empty>}
      </section>
    </>
  );
}
