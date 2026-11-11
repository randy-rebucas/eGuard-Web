import { requireStaff } from "@/lib/staff-auth";
import { MAINTENANCE_STALE_MS, systemStatus } from "@/lib/console-queries";
import { ago, num, stamp, time } from "../../format";
import { Empty, OkPill, StatGrid } from "../../ui";
import { ChartCard, ColumnChart, DataTable } from "../../charts";

export const metadata = { title: "System status" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

/** "3 families" from a step's result: a number, or an object of counts summed. */
function stepSummary(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return num(v);
  if (typeof v === "object") {
    const parts = Object.entries(v as Record<string, unknown>).filter(([, x]) => typeof x === "number" && x > 0).map(([k, x]) => `${k} ${num(x as number)}`);
    return parts.length ? parts.join(", ") : "0";
  }
  return String(v);
}

/** The database, the maintenance job's runs, the latest migration, and which settings the server has. */
export default async function StatusPage() {
  await requireStaff();
  const s = await systemStatus();
  const last = s.runs[0] ?? null;
  const missingRequired = s.config.filter((c) => c.required && !c.ok);
  return (
    <>
      <h1 className="cn-h1">System status</h1>
      <StatGrid stats={[
        { label: "Database", value: s.dbMs === null ? "Down" : `${s.dbMs} ms`, tone: s.dbMs === null ? "bad" : "ok", hint: s.dbMs === null ? "Unreachable" : "Round trip" },
        { label: "Maintenance job", value: last ? ago(last.startedAt) : "Never", tone: s.cronStale ? "bad" : last?.failed.length ? "warn" : "ok", hint: last?.failed.length ? `Last run: ${last.failed.length} failed` : "Last run" },
        { label: "Required settings", value: missingRequired.length ? `${missingRequired.length} missing` : "Ready", tone: missingRequired.length ? "bad" : "ok" },
        { label: "Migrations", value: s.unfinishedMigrations ? `${s.unfinishedMigrations} unfinished` : "Up to date", tone: s.unfinishedMigrations ? "bad" : "ok" },
      ]} />
      {s.cronStale ? (
        <section className="card card-pad" role="alert" style={{ borderColor: "var(--crit)" }}>
          <b>The maintenance job hasn&apos;t run in {Math.round(MAINTENANCE_STALE_MS / 60_000)} minutes.</b> Offline alerts, alert emails,
          purchase re-checks, broadcasts and data retention all wait for it. Check the scheduler (Vercel Cron) and <span className="cn-mono">CRON_SECRET</span>.
        </section>
      ) : null}

      {s.runs.length ? (
        <ChartCard title="Maintenance runs" sub={`How long each of the last ${s.runs.length} runs took, oldest first`}
          table={<DataTable head={["Started", "Seconds", "Failed steps"]} rows={s.runs.map((r) => [stamp(r.startedAt), Math.round(r.ms / 100) / 10, r.failed.join(", ") || "None"])} />}>
          <ColumnChart unit="seconds" height={150} label="Maintenance run durations"
            legend={[{ label: "Every step ran", color: "var(--viz-good)" }, { label: "Some steps failed", color: "var(--viz-critical)" }]}
            data={[...s.runs].reverse().map((r) => ({ label: time(r.startedAt), full: stamp(r.startedAt), value: Math.round(r.ms / 100) / 10, color: r.failed.length ? "var(--viz-critical)" : "var(--viz-good)" }))} />
        </ChartCard>
      ) : null}

      <div className="cn-grid2">
        <section className="card card-pad">
          <div className="card-head"><h2>Deployment</h2></div>
          <dl className="cn-dl">
            <dt>Environment</dt><dd>{s.deployment.env}</dd>
            <dt>Commit</dt><dd className="cn-mono">{s.deployment.commit ?? "—"}</dd>
            <dt>Region</dt><dd>{s.deployment.region ?? "—"}</dd>
            <dt>Latest migration</dt><dd className="cn-mono">{s.migration ? `${s.migration.name} (${stamp(s.migration.at)})` : "—"}</dd>
          </dl>
        </section>

        <section className="card">
          <div className="card-head card-pad cn-head-flush"><h2>Settings</h2></div>
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Setting</th><th>State</th></tr></thead>
              <tbody>
                {s.config.map((c) => (
                  <tr key={c.name}><td>{c.name}{c.required ? "" : <span className="cn-muted"> (optional)</span>}</td><td><OkPill ok={c.ok} yes="Set" no="Not set" bad={c.required} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="cn-muted card-pad" style={{ paddingTop: 10 }}>Whether each is present on this server. Values are never shown.</p>
        </section>
      </div>

      <section className="card">
        <div className="card-head card-pad cn-head-flush"><h2>Maintenance runs</h2></div>
        {s.runs.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Started</th><th className="cn-num">Took</th><th>Result</th><th>Did</th></tr></thead>
              <tbody>
                {s.runs.map((r) => {
                  const steps = r.result && typeof r.result === "object" ? Object.entries(r.result as Record<string, unknown>) : [];
                  const did = steps.map(([k, v]) => [k, stepSummary(v)] as const).filter(([, v]) => v !== "0" && v !== "—");
                  return (
                    <tr key={r.id}>
                      <td>{stamp(r.startedAt)}</td>
                      <td className="cn-num">{num(Math.round(r.ms / 100) / 10)} s</td>
                      <td>{r.failed.length ? <span className="cn-bad">Failed: {r.failed.join(", ")}</span> : <span className="pill tone-ok">OK</span>}</td>
                      <td className="cn-muted">{did.length ? did.map(([k, v]) => `${k}: ${v}`).join(" · ") : "Nothing to do"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>No runs recorded yet. They appear once <span className="cn-mono">/api/cron/maintenance</span> runs with this version.</Empty>}
      </section>
    </>
  );
}
