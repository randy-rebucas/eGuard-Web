"use client";

import { useActionState, useState } from "react";
import type { AppApproval } from "@prisma/client";
import { Icon } from "./icon";
import { Feedback } from "./feedback";
import { ConfirmField, confirmHint } from "./confirm-field";
import { useAction, useFlow } from "./flow";
import { PROFILES, recommendedProfile, type ProfileId } from "@/lib/profiles";
import { createChild, deleteChildData, setAppApproval, setAppLimit, updateChild } from "@/app/actions/family";

export function ChildForm({ child }: { child?: { id: string; name: string; birthYear: number } }) {
  const [state, action, pending] = useActionState(child ? updateChild.bind(null, child.id) : createChild, undefined);
  const year = new Date().getFullYear();
  // Always offer the child's saved year: a select without it shows its first option, and saving would change their age
  const years = [...new Set([...Array.from({ length: 18 }, (_, i) => year - 1 - i), ...(child ? [child.birthYear] : [])])].sort((a, b) => b - a);
  const [birthYear, setBirthYear] = useState(child?.birthYear ?? year - 10);
  // Follows the age (as in the app) until the parent picks one
  const [picked, setPicked] = useState<ProfileId | null>(null);
  const recommended = recommendedProfile(year - birthYear);
  const profile = picked ?? recommended;
  return (
    <form action={action} className="dash-col" style={{ gap: 16, maxWidth: 520 }}>
      <Feedback state={state} />
      <div className="form-grid">
        <div className="field"><label htmlFor="c-name">Name</label><input className="input" id="c-name" name="name" required maxLength={40} defaultValue={child?.name} autoComplete="off" /></div>
        <div className="field">
          <label htmlFor="c-year">Birth year</label>
          <select className="input" id="c-year" name="birthYear" value={birthYear} onChange={(e) => setBirthYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y} (about {year - y} {year - y === 1 ? "year" : "years"} old)</option>)}
          </select>
        </div>
      </div>
      {!child ? (
        <fieldset className="bp-group">
          <legend className="t-title">Starting protections</legend>
          <div className="check-list" role="radiogroup" aria-label="Starting protections">
            {/* Custom is the app's review-each-setting step; here everything is adjustable on the child's page afterwards */}
            {PROFILES.filter((p) => p.id !== "CUSTOM").map((p) => (
              <label key={p.id} className="check">
                <input type="radio" name="profile" value={p.id} checked={profile === p.id} onChange={() => setPicked(p.id)} />
                <span>
                  <span className="t-title" style={{ fontSize: 14 }}>{p.name}{p.id === recommended ? " (recommended)" : ""}</span>
                  <span className="t-meta" style={{ display: "block" }}>{p.description}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="t-meta">Both start with every protection on, set for your child&apos;s age. You can change any of them afterwards.</p>
        </fieldset>
      ) : null}
      <div><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : child ? "Save changes" : "Add child"}</button></div>
    </form>
  );
}

export function DeleteChildForm({ childId, name, hasPassword }: { childId: string; name: string; hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteChildData.bind(null, childId), undefined);
  if (!open) return <button className="btn btn-secondary btn-sm" style={{ color: "var(--crit-ink)" }} onClick={() => setOpen(true)}><Icon name="trash" />Remove {name}…</button>;
  return (
    <form action={action} className="dash-col" style={{ gap: 12, maxWidth: 420 }}>
      <p className="t-meta" style={{ color: "var(--ink-2)" }}>This deletes {name}&apos;s activity, history and devices from eGuard. Protections on the devices stop being managed. {confirmHint(hasPassword)}</p>
      <Feedback state={state} />
      <ConfirmField id="del-confirm" hasPassword={hasPassword} />
      <div className="row"><button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" style={{ background: "var(--crit)" }} disabled={pending}>{pending ? "Deleting…" : <>Delete {name}&apos;s data</>}</button></div>
    </form>
  );
}

const APPROVALS: [AppApproval, string][] = [["ALLOWED", "Allowed"], ["ALWAYS_ALLOWED", "Always allowed"], ["FILTERED", "Filtered"], ["BLOCKED", "Blocked"], ["PENDING", "Pending"]];

export function AppControls({ app }: { app: { id: string; name: string; approval: AppApproval; dailyLimitMinutes: number | null; requested?: boolean } }) {
  const [pending, run] = useAction();
  const { toast } = useFlow();
  const saved = app.dailyLimitMinutes ? String(app.dailyLimitMinutes) : "";
  const [limit, setLimit] = useState(saved);
  // Shown immediately; the server's value takes over once the page refreshes, or comes back on failure
  const [approval, setApproval] = useState<AppApproval | null>(null);
  const approve = (to: AppApproval, ok: string) => {
    setApproval(to);
    run(() => setAppApproval(app.id, to), { ok, onError: () => setApproval(null), onOk: () => setApproval(null) });
  };
  const saveLimit = () => {
    if (limit === saved) return;
    const minutes = limit ? Number(limit) : null;
    if (minutes != null && (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440)) { setLimit(saved); toast("Enter a daily limit up to 1440 minutes, or leave it empty for no limit.", "error"); return; }
    // The server keeps whole minutes and treats 0 as no limit: show what it saved, not what was typed
    const stored = Math.round(minutes ?? 0) || null;
    run(() => setAppLimit(app.id, minutes), {
      ok: stored ? `${app.name} limited to ${stored} minutes a day.` : `Daily limit removed for ${app.name}.`,
      onOk: () => setLimit(stored ? String(stored) : ""),
      onError: () => setLimit(saved),
    });
  };
  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }} aria-busy={pending}>
      {app.approval === "PENDING" || app.requested ? (
        <>
          <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => approve("ALLOWED", `${app.name} approved. It applies on the device's next sync.`)}>
            {pending && approval === "ALLOWED" ? <><Icon name="loader-circle" className="spin" />Approving…</> : "Approve"}
          </button>
          <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => approve("BLOCKED", `${app.name} declined.`)}>
            {pending && approval === "BLOCKED" ? <><Icon name="loader-circle" className="spin" />Declining…</> : "Decline"}
          </button>
        </>
      ) : (
        <>
          <label className="sr-only" htmlFor={`ap-${app.id}`}>Access for {app.name}</label>
          <select id={`ap-${app.id}`} className="input" style={{ height: 36 }} value={approval ?? app.approval} disabled={pending}
            onChange={(e) => approve(e.target.value as AppApproval, `${app.name} updated. It applies on the device's next sync.`)}>
            {APPROVALS.filter(([k]) => k !== "PENDING").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <label className="sr-only" htmlFor={`lim-${app.id}`}>Daily limit for {app.name} in minutes</label>
          <input id={`lim-${app.id}`} className="input" style={{ height: 36, width: 110 }} type="number" min={0} max={1440} step={15} placeholder="No limit" value={limit}
            onChange={(e) => setLimit(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            onBlur={saveLimit} />
        </>
      )}
    </div>
  );
}
