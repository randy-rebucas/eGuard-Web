import { requireStaff } from "@/lib/staff-auth";
import { listFlags } from "@/lib/console-queries";
import { setFlag } from "@/app/actions/console";
import { stamp } from "../../format";
import { Empty } from "../../ui";
import { DeleteFlag, EditFlag, NewFlag } from "../../flag-forms";

export const metadata = { title: "Feature flags" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

/** Switches for features, read in code with isEnabled() from lib/feature-flags. Every change is in the audit log. */
export default async function FlagsPage() {
  await requireStaff();
  const flags = await listFlags();
  return (
    <>
      <h1 className="cn-h1">Feature flags</h1>
      <p className="cn-muted">
        Code checks a flag with <span className="cn-mono">isEnabled(&quot;key&quot;, familyId)</span>. A flag that doesn&apos;t exist is off.
        Below 100%, a flag is on for that share of families (the same ones as the share grows), and off where there&apos;s no family.
      </p>
      {flags.length ? flags.map((f) => (
        <section key={f.key} className="card card-pad">
          <div className="card-head" style={{ alignItems: "center" }}>
            <h2 className="cn-mono">{f.key}</h2>
            <form action={setFlag} className="cn-actions">
              <input type="hidden" name="key" value={f.key} />
              <input type="hidden" name="enabled" value={String(!f.enabled)} />
              <span className={`pill ${f.enabled ? "tone-ok" : "tone-muted"}`}>{f.enabled ? (f.rollout < 100 ? `On for ${f.rollout}%` : "On") : "Off"}</span>
              <button className={`btn ${f.enabled ? "btn-secondary" : "btn-primary"} btn-sm`}>{f.enabled ? "Turn off" : "Turn on"}</button>
            </form>
          </div>
          <EditFlag flagKey={f.key} description={f.description} rollout={f.rollout} version={f.updatedAt.toISOString()} />
          <p className="cn-muted" style={{ margin: "10px 0" }}>Last changed {stamp(f.updatedAt)}{f.updatedBy ? ` by ${f.updatedBy.name}` : ""}. Created {stamp(f.createdAt)}.</p>
          <DeleteFlag flagKey={f.key} />
        </section>
      )) : <section className="card"><Empty>No flags yet.</Empty></section>}
      <section className="card card-pad">
        <div className="card-head"><h2>New flag</h2></div>
        <NewFlag />
      </section>
    </>
  );
}
