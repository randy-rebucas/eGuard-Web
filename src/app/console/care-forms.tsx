"use client";

import { useActionState } from "react";
import { retryCareJobs, setCareAutomation } from "@/app/actions/console";
import { Feedback } from "@/components/feedback";

/** Pause or resume an automation, with a confirmation box: pausing a live one cancels what's queued. */
export function AutomationSwitch({ automationKey, enabled, pending }: { automationKey: string; enabled: boolean; pending: number }) {
  const [state, action, busy] = useActionState(setCareAutomation, undefined);
  return (
    <form action={action} className="cn-form" style={{ gap: 10 }}>
      <Feedback state={state} />
      <input type="hidden" name="key" value={automationKey} />
      <input type="hidden" name="enabled" value={String(!enabled)} />
      <label className="check">
        <input type="checkbox" name="confirm" />
        <span>{enabled
          ? `Pause it for every parent. ${pending ? `${pending} pending ${pending === 1 ? "message is" : "messages are"} cancelled, and` : "Nothing"} new is planned until it's resumed.`
          : "Resume it. Messages are planned again on the next runs, for parents who allow them."}</span>
      </label>
      <div className="cn-actions">
        <button className={`btn ${enabled ? "btn-secondary" : "btn-primary"} btn-sm`} disabled={busy}>{busy ? "Saving…" : enabled ? "Pause automation" : "Resume automation"}</button>
      </div>
    </form>
  );
}

/** Retry one failed job (no confirmation: it's one parent, and eligibility is checked again). */
export function RetryJob({ id }: { id: string }) {
  const [state, action, busy] = useActionState(retryCareJobs, undefined);
  return (
    <form action={action} style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-ghost btn-sm" disabled={busy || !!state?.ok}>{state?.ok ? "Queued" : busy ? "…" : "Retry"}</button>
      {state?.error ? <span className="field-error">{state.error}</span> : null}
    </form>
  );
}

/** Retry every job given up in the last 7 days, optionally for one automation. */
export function RetryAll({ automations, dead }: { automations: { key: string; name: string }[]; dead: number }) {
  const [state, action, busy] = useActionState(retryCareJobs, undefined);
  return (
    <form action={action} className="cn-form" style={{ gap: 10 }}>
      <Feedback state={state} />
      <div className="field">
        <label htmlFor="retry-automation">Automation</label>
        <select id="retry-automation" name="automation" className="input" defaultValue="">
          <option value="">All automations</option>
          {automations.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
        </select>
      </div>
      <label className="check">
        <input type="checkbox" name="confirm" />
        <span>Retry failed jobs from the last 7 days ({dead.toLocaleString("en-US")} in all). Each is checked again before sending; messages that may already have reached a provider are never sent twice.</span>
      </label>
      <div className="cn-actions"><button className="btn btn-secondary btn-sm" disabled={busy || !dead}>{busy ? "Queuing…" : "Retry failed jobs"}</button></div>
    </form>
  );
}
