import Link from "next/link";
import { logStaff, requireStaff } from "@/lib/staff-auth";
import { searchParents } from "@/lib/console-queries";
import { beforeParam, day, one, stamp } from "../../format";
import { Empty, OkPill, Pager } from "../../ui";

export const metadata = { title: "Parents" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

export default async function ParentsPage(props: PageProps<"/console/parents">) {
  const staff = await requireStaff();
  const sp = await props.searchParams;
  const q = one(sp.q).slice(0, 200), before = beforeParam(sp.before);
  // A search is recorded, like a family search (the newest-first list isn't)
  if (q.trim()) await logStaff(staff.id, "parent.search", undefined, q.trim());
  const { rows, nextBefore } = await searchParents(q, before);
  return (
    <>
      <h1 className="cn-h1">Parents</h1>
      <form className="cn-search" role="search">
        <input className="input" name="q" type="search" defaultValue={q} placeholder="Email or name, user id or family id" aria-label="Search parents" />
        <button className="btn btn-primary">Search</button>
      </form>
      <section className="card">
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Name</th><th>Email</th><th>Family</th><th>Role</th><th>Verified</th><th>Sign-in</th><th>Two-step</th><th>Last active</th><th>Joined</th></tr></thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td><Link prefetch={false} className="inline-link" href={`/families/${u.family.id}`}>{u.family.name}</Link> <span className="cn-muted">· {u.family.plan}</span></td>
                    <td>{u.role === "FAMILY_ADMIN" ? "Admin" : "Parent"}</td>
                    <td><OkPill ok={!!u.emailVerifiedAt} /></td>
                    <td>{[u.passwordSet ? "Password" : null, ...u.identities.map((i) => i.provider)].filter(Boolean).join(", ") || "Invited"}</td>
                    <td><OkPill ok={u.twoFactor} yes="On" no="Off" /></td>
                    <td>{stamp(u.sessions[0]?.lastSeenAt)}</td>
                    <td>{day(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>{q ? "No parent matches that search." : "No parents yet."}</Empty>}
      </section>
      <Pager nextBefore={nextBefore} paged={!!before} query={{ q }} />
    </>
  );
}
