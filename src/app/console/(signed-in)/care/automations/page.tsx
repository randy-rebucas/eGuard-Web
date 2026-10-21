import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { automationStats } from "@/lib/parent-care/metrics";
import { CHANNEL_LABEL } from "@/lib/parent-care/definitions";
import { CareTabs, RateText } from "../../../ui";

export const metadata = { title: "Automations" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

export default async function CareAutomations() {
  await requireStaff();
  const rows = await automationStats();
  return (
    <>
      <h1 className="cn-h1">Parent care</h1>
      <CareTabs active="/care/automations" />
      <p className="cn-muted">Each automation&apos;s rules live in code and are versioned; here you can pause or resume one, and see how it&apos;s doing. Conversion: messages followed by a completed activity within 7 days.</p>
      <section className="card">
        <div className="table-scroll">
          <table className="data-table cn-table">
            <thead><tr><th>Automation</th><th>Status</th><th>Channels</th><th>Pending</th><th>Sent (30 d)</th><th>Clicked</th><th>Converted</th><th>Enrolled</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.def.key}>
                  <td><Link prefetch={false} className="inline-link" href={`/care/automations/${r.def.key}`}>{r.def.name}</Link><br /><span className="cn-muted">v{r.def.version} · {r.def.trigger === "EVENT" ? "Event" : "Schedule"}</span></td>
                  <td>{!r.synced ? <span className="pill tone-muted">Not synced yet</span> : r.enabled ? <span className="pill tone-ok">Running</span> : <span className="pill tone-warn">Paused</span>}</td>
                  <td>{r.def.channels.map((c) => CHANNEL_LABEL[c]).join(" → ")}</td>
                  <td>{r.jobs.PENDING.toLocaleString("en-US")}</td>
                  <td>{r.sent30.toLocaleString("en-US")}</td>
                  <td><RateText r={r.clicked} /></td>
                  <td><RateText r={r.converted} /></td>
                  <td>{r.def.key === "check_in" ? `${r.enrollments.ACTIVE} active · ${r.enrollments.COMPLETED} finished · ${r.enrollments.EXITED} exited · ${r.enrollments.HOLDOUT} holdout` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="cn-muted">Not synced yet: the maintenance job creates an automation&apos;s row on its next run (every 10 minutes).</p>
    </>
  );
}
