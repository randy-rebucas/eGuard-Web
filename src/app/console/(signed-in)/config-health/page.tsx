import Link from "next/link";
import type { CheckStatus } from "@prisma/client";
import { requireStaff } from "@/lib/staff-auth";
import { STUCK_REQUEST_HOURS, configHealth } from "@/lib/console-queries";
import { PROTECTIONS } from "@/lib/protections";
import { ago, label, num } from "../../format";
import { CheckPill, Empty } from "../../ui";
import { ChartCard, DataTable, SegmentRows, SegmentedBar } from "../../charts";

export const metadata = { title: "Configuration health" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

const STATUSES: CheckStatus[] = ["PASS", "WARNING", "ACTION_REQUIRED", "NOT_CONFIGURED", "UNSUPPORTED"];
const REQUEST_ORDER = ["VERIFIED", "DELIVERED", "PENDING", "AWAITING_PARENT", "FAILED", "CANCELLED"];

/** States wear the state colors; "doesn't apply" is neutral. */
const STATUS_SERIES = [
  { key: "PASS", label: "Pass", color: "var(--viz-good)" },
  { key: "WARNING", label: "Warning", color: "var(--viz-warning)" },
  { key: "ACTION_REQUIRED", label: "Action required", color: "var(--viz-critical)" },
  { key: "NOT_CONFIGURED", label: "Not configured", color: "var(--viz-neutral)" },
  { key: "UNSUPPORTED", label: "Unsupported", color: "var(--line-strong)" },
];
const REQUEST_COLOR: Record<string, string> = {
  VERIFIED: "var(--viz-good)", DELIVERED: "var(--viz-1)", PENDING: "var(--viz-3)", AWAITING_PARENT: "var(--viz-5)", FAILED: "var(--viz-critical)", CANCELLED: "var(--viz-neutral)",
};

/** Configuration Health across every device: each check's results, and whether parents' changes are landing. */
export default async function ConfigHealthPage() {
  await requireStaff();
  const h = await configHealth();
  const cell = new Map(h.matrix.map((m) => [`${m.key}:${m.status}`, m.n]));
  const requests = new Map<string, number>(h.requests.map((r) => [r.status, r.n]));
  const totalChecks = h.matrix.reduce((a, m) => a + m.n, 0), totalRequests = h.requests.reduce((a, r) => a + r.n, 0);
  return (
    <>
      <h1 className="cn-h1">Configuration health</h1>
      {h.stuckCount || h.longChecks ? (
        <section className="card card-pad" role="alert" style={{ borderColor: "var(--warn)" }}>
          <b>Needs a look:</b>{" "}
          {h.stuckCount ? `${num(h.stuckCount)} ${h.stuckCount === 1 ? "change has" : "changes have"} waited over ${STUCK_REQUEST_HOURS} hours for a device. ` : ""}
          {h.longChecks ? `${num(h.longChecks)} health ${h.longChecks === 1 ? "check has" : "checks have"} run over 15 minutes.` : ""}
        </section>
      ) : null}

      <div className="cn-grid2">
        <ChartCard wide title="Check results by protection" sub={`Each device's latest result for each check · ${totalChecks.toLocaleString("en-US")} results`}
          table={<DataTable head={["Check", ...STATUSES.map(label)]} rows={PROTECTIONS.map((p) => [p.checkName, ...STATUSES.map((st) => cell.get(`${p.key}:${st}`) ?? 0)])} />}>
          <SegmentRows series={STATUS_SERIES} unit="devices" label="Check results by protection"
            rows={PROTECTIONS.map((p) => ({ label: p.checkName, values: Object.fromEntries(STATUSES.map((st) => [st, cell.get(`${p.key}:${st}`) ?? 0])) }))} />
        </ChartCard>
        <ChartCard wide title="Changes parents sent" sub={`${totalRequests.toLocaleString("en-US")} kept, by where they got to`}
          table={<DataTable head={["State", "Changes"]} rows={REQUEST_ORDER.map((st) => [label(st), requests.get(st) ?? 0])} />}>
          <SegmentedBar unit="changes" label="Changes parents sent, by state"
            parts={REQUEST_ORDER.map((st) => ({ label: label(st), value: requests.get(st) ?? 0, color: REQUEST_COLOR[st] }))} />
        </ChartCard>
      </div>

      <div className="cn-grid2">
        <section className="card">
          <div className="card-head card-pad cn-head-flush"><h2>Waiting over {STUCK_REQUEST_HOURS} hours</h2></div>
          {h.stuck.length ? (
            <div className="table-scroll">
              <table className="data-table cn-table">
                <thead><tr><th>Device</th><th>Change</th><th>State</th><th>Sent</th><th>Device seen</th></tr></thead>
                <tbody>
                  {h.stuck.map((r) => (
                    <tr key={r.id}>
                      <td><Link prefetch={false} className="inline-link" href={`/devices/${r.device.id}`}>{r.device.name}</Link> <span className="cn-muted">· {label(r.device.platform)}</span></td>
                      <td>{PROTECTIONS.find((p) => p.key === r.key)?.checkName ?? label(r.key)}</td>
                      <td><CheckPill status={r.status} /></td>
                      <td>{ago(r.createdAt)}</td>
                      <td>{ago(r.device.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty>Nothing stuck.</Empty>}
        </section>

        <section className="card">
          <div className="card-head card-pad cn-head-flush"><h2>Failed in the last 7 days</h2></div>
          {h.failed.length ? (
            <div className="table-scroll">
              <table className="data-table cn-table">
                <thead><tr><th>Change</th><th>Why</th><th className="cn-num">Times</th></tr></thead>
                <tbody>
                  {h.failed.map((f) => (
                    <tr key={`${f.key}:${f.reason}`}>
                      <td>{PROTECTIONS.find((p) => p.key === f.key)?.checkName ?? label(f.key)}</td>
                      <td>{f.reason ?? <span className="cn-muted">No reason given</span>}</td>
                      <td className="cn-num">{num(f.n)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty>No failures this week.</Empty>}
        </section>
      </div>
    </>
  );
}
