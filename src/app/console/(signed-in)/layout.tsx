import { requireStaff } from "@/lib/staff-auth";
import { consoleLogout } from "@/app/actions/console";
import { ConsoleNav } from "../nav";

/** Every page here is read per request behind the staff session: no static shell to validate. */
export const instant = false;

export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <>
      <header className="cn-bar">
        <div className="cn-bar-row">
          <span className="cn-brand">eGuard <b>Console</b></span>
          <div className="cn-who">
            <span className="cn-muted" title={staff.email}>{staff.name}</span>
            <form action={consoleLogout}><button className="btn btn-ghost btn-sm">Sign out</button></form>
          </div>
        </div>
        <ConsoleNav />
      </header>
      <main className="cn-main" id="main">{children}</main>
    </>
  );
}
