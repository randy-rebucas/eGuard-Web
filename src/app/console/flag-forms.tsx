"use client";

import { useActionState } from "react";
import { deleteFlag, saveFlag } from "@/app/actions/console";
import { Feedback } from "@/components/feedback";

/** A new flag: key, what it controls, rollout. It starts off. */
export function NewFlag() {
  const [state, action, busy] = useActionState(saveFlag, undefined);
  return (
    <form action={action} className="cn-form" style={{ gap: 10 }}>
      <Feedback state={state} />
      <div className="cn-flag-edit">
        <div className="field">
          <label htmlFor="flag-key">Key</label>
          <input id="flag-key" name="key" className="input cn-mono" placeholder="ios_launch" required pattern="[a-z][a-z0-9_]{1,47}" maxLength={48} />
        </div>
        <div className="field">
          <label htmlFor="flag-rollout">Rollout %</label>
          <input id="flag-rollout" name="rollout" className="input" type="number" min={0} max={100} defaultValue={100} required />
        </div>
        <span />
      </div>
      <div className="field">
        <label htmlFor="flag-description">What it controls</label>
        <input id="flag-description" name="description" className="input" maxLength={300} required />
      </div>
      <div className="cn-actions"><button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Creating…" : "Create flag"}</button></div>
    </form>
  );
}

/** Edit a flag's description and rollout; `version` refuses the save if someone else changed it first. */
export function EditFlag({ flagKey, description, rollout, version }: { flagKey: string; description: string; rollout: number; version: string }) {
  const [state, action, busy] = useActionState(saveFlag, undefined);
  return (
    <form action={action} className="cn-form" style={{ gap: 8 }}>
      <Feedback state={state} />
      <input type="hidden" name="key" value={flagKey} />
      <input type="hidden" name="version" value={version} />
      <div className="cn-flag-edit">
        <div className="field">
          <label htmlFor={`d-${flagKey}`}>What it controls</label>
          <input id={`d-${flagKey}`} name="description" className="input" defaultValue={description} maxLength={300} required />
        </div>
        <div className="field">
          <label htmlFor={`r-${flagKey}`}>Rollout %</label>
          <input id={`r-${flagKey}`} name="rollout" className="input" type="number" min={0} max={100} defaultValue={rollout} required />
        </div>
        <button className="btn btn-secondary btn-sm" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

/** Delete, after ticking the box */
export function DeleteFlag({ flagKey }: { flagKey: string }) {
  const [state, action, busy] = useActionState(deleteFlag, undefined);
  return (
    <form action={action} className="cn-actions">
      <input type="hidden" name="key" value={flagKey} />
      <label className="check"><input type="checkbox" name="confirm" /><span>Delete it (code checking it sees it as off)</span></label>
      <button className="btn btn-ghost btn-sm" disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>
      {state?.error ? <span className="field-error">{state.error}</span> : null}
    </form>
  );
}
