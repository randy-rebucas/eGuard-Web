"use client";

import { useActionState, useState, useTransition } from "react";
import type { AppApproval } from "@prisma/client";
import { Icon } from "./icon";
import { useFlow } from "./flow";
import type { FormState } from "@/app/actions/auth";
import {
  addParent, changePassword, createChild, createPairingCode, deleteAccount, deleteChildData, removeDevice, removeParent, renameDevice,
  setAppApproval, setAppLimit, setToggle, signOutOthers, unlinkIdentity, updateAccount, updateChild,
} from "@/app/actions/family";

export function Feedback({ state }: { state: FormState }) {
  if (state?.error) return <div className="form-error" role="alert"><Icon name="triangle-alert" />{state.error}</div>;
  if (state?.ok) return <div className="form-ok" role="status"><Icon name="circle-check" />{state.ok}</div>;
  return null;
}

export function ChildForm({ child }: { child?: { id: string; name: string; birthYear: number } }) {
  const [state, action, pending] = useActionState(child ? updateChild.bind(null, child.id) : createChild, undefined);
  const year = new Date().getFullYear();
  return (
    <form action={action} className="dash-col" style={{ gap: 16, maxWidth: 520 }}>
      <Feedback state={state} />
      <div className="form-grid">
        <div className="field"><label htmlFor="c-name">Name</label><input className="input" id="c-name" name="name" required maxLength={40} defaultValue={child?.name} /></div>
        <div className="field">
          <label htmlFor="c-year">Birth year</label>
          <select className="input" id="c-year" name="birthYear" defaultValue={child?.birthYear ?? year - 10}>
            {Array.from({ length: 18 }, (_, i) => year - 1 - i).map((y) => <option key={y} value={y}>{y} ({year - y} years old)</option>)}
          </select>
        </div>
      </div>
      {!child ? <p className="t-meta">eGuard sets age-appropriate protections to start. You can change any of them afterwards.</p> : null}
      <div><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : child ? "Save changes" : "Add child"}</button></div>
    </form>
  );
}

export function DeleteChildForm({ childId, name }: { childId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteChildData.bind(null, childId), undefined);
  if (!open) return <button className="btn btn-secondary btn-sm" style={{ color: "var(--crit-ink)" }} onClick={() => setOpen(true)}><Icon name="trash" />Remove {name}…</button>;
  return (
    <form action={action} className="dash-col" style={{ gap: 12, maxWidth: 420 }}>
      <p className="t-meta" style={{ color: "var(--ink-2)" }}>This deletes {name}&apos;s activity, history and devices from eGuard. Protections on the devices stop being managed. Enter your password to confirm.</p>
      <Feedback state={state} />
      <div className="field"><label htmlFor="del-pw">Your password</label><input className="input" id="del-pw" name="password" type="password" required autoComplete="current-password" /></div>
      <div className="row"><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" style={{ background: "var(--crit)" }} disabled={pending}>Delete {name}&apos;s data</button></div>
    </form>
  );
}

const APPROVALS: [AppApproval, string][] = [["ALLOWED", "Allowed"], ["ALWAYS_ALLOWED", "Always allowed"], ["FILTERED", "Filtered"], ["BLOCKED", "Blocked"], ["PENDING", "Pending"]];

export function AppControls({ app }: { app: { id: string; name: string; approval: AppApproval; dailyLimitMinutes: number | null } }) {
  const [pending, start] = useTransition();
  const { toast } = useFlow();
  const [limit, setLimit] = useState(app.dailyLimitMinutes ? String(app.dailyLimitMinutes) : "");
  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {app.approval === "PENDING" ? (
        <>
          <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => start(async () => { await setAppApproval(app.id, "ALLOWED"); toast(`${app.name} approved. It applies on the device's next sync.`); })}>Approve</button>
          <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => { await setAppApproval(app.id, "BLOCKED"); toast(`${app.name} declined.`); })}>Decline</button>
        </>
      ) : (
        <>
          <label className="sr-only" htmlFor={`ap-${app.id}`}>Access for {app.name}</label>
          <select id={`ap-${app.id}`} className="input" style={{ height: 36 }} value={app.approval} disabled={pending}
            onChange={(e) => start(async () => { await setAppApproval(app.id, e.target.value as AppApproval); toast(`${app.name} updated. It applies on the device's next sync.`); })}>
            {APPROVALS.filter(([k]) => k !== "PENDING").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <label className="sr-only" htmlFor={`lim-${app.id}`}>Daily limit for {app.name} in minutes</label>
          <input id={`lim-${app.id}`} className="input" style={{ height: 36, width: 110 }} type="number" min={0} step={15} placeholder="No limit" value={limit}
            onChange={(e) => setLimit(e.target.value)}
            onBlur={() => start(async () => { await setAppLimit(app.id, limit ? Number(limit) : null); })} />
        </>
      )}
    </div>
  );
}

export function PairDevice({ kids: children }: { kids: { id: string; name: string }[] }) {
  const [childId, setChildId] = useState(children[0]?.id ?? "");
  const [result, setResult] = useState<{ code?: string; expiresAt?: string; childName?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const { toast } = useFlow();
  if (!children.length) return <p className="t-meta">Add a child before pairing a device.</p>;
  return (
    <div className="dash-col" style={{ gap: 14 }}>
      <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field grow" style={{ minWidth: 180 }}>
          <label htmlFor="pair-child">Device belongs to</label>
          <select id="pair-child" className="input" value={childId} onChange={(e) => { setChildId(e.target.value); setResult(null); }}>
            {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => setResult(await createPairingCode(childId)))}><Icon name="plus" />Get pairing code</button>
      </div>
      {result?.error ? <div className="form-error"><Icon name="triangle-alert" />{result.error}</div> : null}
      {result?.code ? (
        <div className="dash-col" style={{ gap: 10 }}>
          <div className="pairing-code num" aria-label={`Pairing code ${result.code.split("").join(" ")}`}>{result.code}</div>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <span className="t-meta">Open the eGuard app on {result.childName}&apos;s phone or tablet, choose <b>Pair with parent</b>, and enter this code. It expires in 15 minutes.</span>
            <button className="btn btn-secondary btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(result.code!); toast("Code copied."); } catch { toast("Select the code to copy it."); } }}><Icon name="copy" />Copy</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RenameDeviceForm({ deviceId, name }: { deviceId: string; name: string }) {
  const [state, action, pending] = useActionState(renameDevice.bind(null, deviceId), undefined);
  return (
    <form action={action} className="dash-col" style={{ gap: 10 }}>
      <Feedback state={state} />
      <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field grow"><label htmlFor="dev-name">Device name</label><input className="input" id="dev-name" name="name" defaultValue={name} maxLength={60} /></div>
        <button className="btn btn-secondary" disabled={pending}>Rename</button>
      </div>
    </form>
  );
}

export function RemoveDeviceButton({ deviceId, name }: { deviceId: string; name: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm) return <button className="btn btn-secondary btn-sm" style={{ color: "var(--crit-ink)" }} onClick={() => setConfirm(true)}><Icon name="trash" />Remove device</button>;
  return (
    <div className="dash-col" style={{ gap: 10 }}>
      <p className="t-meta" style={{ color: "var(--ink-2)" }}>Removing {name} stops eGuard managing it. Protections already on the device stay until someone changes them there.</p>
      <div className="row"><button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Cancel</button>
        <button className="btn btn-primary btn-sm" style={{ background: "var(--crit)" }} disabled={pending} onClick={() => start(() => removeDevice(deviceId))}>Remove {name}</button></div>
    </div>
  );
}

export function SettingSwitch({ setting, title, desc, checked, disabled }: { setting: string; title: string; desc: string; checked: boolean; disabled?: boolean }) {
  const [on, setOn] = useState(checked);
  const [pending, start] = useTransition();
  const id = `sw-${setting}`;
  return (
    <div className="setting-row">
      <div className="grow"><div className="t-title" id={id}>{title}</div><div className="t-meta">{desc}</div></div>
      <button type="button" className="switch" role="switch" aria-checked={on} aria-labelledby={id} disabled={pending || disabled}
        onClick={() => { const v = !on; setOn(v); start(async () => { try { await setToggle(setting, v); } catch { setOn(!v); } }); }} />
    </div>
  );
}

export function AccountForm({ name, email, timezone, zones, canSetTimezone, hasPassword }: { name: string; email: string; timezone: string; zones: string[]; canSetTimezone: boolean; hasPassword: boolean }) {
  const [state, action, pending] = useActionState(updateAccount, undefined);
  const [newEmail, setNewEmail] = useState(email);
  const changingEmail = newEmail.trim().toLowerCase() !== email;
  return (
    <form action={action} className="dash-col" style={{ gap: 16 }}>
      <Feedback state={state} />
      <div className="form-grid">
        <div className="field"><label htmlFor="fn">Full name</label><input className="input" id="fn" name="name" defaultValue={name} autoComplete="name" /></div>
        <div className="field"><label htmlFor="em">Email</label><input className="input" id="em" name="email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" /></div>
        {changingEmail ? (
          <div className="field">
            <label htmlFor="em-pw">Current password</label>
            <input className="input" id="em-pw" name="password" type="password" autoComplete="current-password" required />
            <span className="field-hint">{hasPassword ? "Needed to change your email." : "You signed up with Apple or Google. Sign out and use “Forgot password” to set one first."}</span>
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="tz">Family time zone</label>
          <select className="input" id="tz" name="timezone" defaultValue={timezone} disabled={!canSetTimezone}>
            {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </select>
          {!canSetTimezone ? <><input type="hidden" name="timezone" value={timezone} /><span className="field-hint">Only the family admin can change this.</span></> : null}
        </div>
      </div>
      <div><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button></div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="dash-col" style={{ gap: 14 }}>
      <Feedback state={state} />
      <div className="form-grid">
        <div className="field"><label htmlFor="pw-c">Current password</label><input className="input" id="pw-c" name="current" type="password" autoComplete="current-password" /></div>
        <div className="field"><label htmlFor="pw-n">New password</label><input className="input" id="pw-n" name="next" type="password" minLength={10} autoComplete="new-password" /></div>
      </div>
      <div><button className="btn btn-secondary" disabled={pending}>Change password</button></div>
    </form>
  );
}

export function DeleteAccountForm({ isAdmin, hasPassword }: { isAdmin: boolean; hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  if (!open) return <button className="btn btn-secondary btn-sm" style={{ color: "var(--crit-ink)" }} onClick={() => setOpen(true)}><Icon name="trash" />Delete account…</button>;
  return (
    <form action={action} className="dash-col" style={{ gap: 12, maxWidth: 440 }}>
      <p className="t-meta" style={{ color: "var(--ink-2)" }}>
        {isAdmin
          ? "You're the family admin, so this deletes the whole family: every child, device, setting and history, and the other parents' accounts. Protections on the devices stop being managed. This can't be undone."
          : "This deletes your account. The family and its children stay with the family admin. This can't be undone."}
      </p>
      <Feedback state={state} />
      {hasPassword ? (
        <div className="field"><label htmlFor="da-pw">Your password</label><input className="input" id="da-pw" name="password" type="password" required autoComplete="current-password" /></div>
      ) : (
        <div className="field"><label htmlFor="da-ph">Type DELETE to confirm</label><input className="input" id="da-ph" name="phrase" required autoComplete="off" /></div>
      )}
      <div className="row"><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" style={{ background: "var(--crit)" }} disabled={pending}>{isAdmin ? "Delete family and account" : "Delete my account"}</button></div>
    </form>
  );
}

export function AddParentForm() {
  const [state, action, pending] = useActionState(addParent, undefined);
  return (
    <form action={action} className="dash-col" style={{ gap: 14 }}>
      <Feedback state={state} />
      <div className="form-grid">
        <div className="field"><label htmlFor="ap-n">Name</label><input className="input" id="ap-n" name="name" /></div>
        <div className="field"><label htmlFor="ap-e">Email</label><input className="input" id="ap-e" name="email" type="email" /></div>
        <div className="field"><label htmlFor="ap-p">Temporary password</label><input className="input" id="ap-p" name="password" type="text" minLength={10} autoComplete="off" /></div>
      </div>
      <div><button className="btn btn-secondary" disabled={pending}><Icon name="user-plus" />Add parent</button></div>
    </form>
  );
}

export function RemoveParentButton({ userId, name }: { userId: string; name: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <div className="row" style={{ gap: 6 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Cancel</button>
      <button className="btn btn-primary btn-sm" style={{ background: "var(--crit)" }} disabled={pending} onClick={() => start(() => removeParent(userId))}>Remove {name}</button>
    </div>
  ) : <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(true)}>Remove</button>;
}

export function SignOutOthersButton() {
  const [pending, start] = useTransition();
  const { toast } = useFlow();
  return <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => { await signOutOthers(); toast("Other sessions were signed out."); })}>Sign out other sessions</button>;
}

export function UnlinkIdentityButton({ identityId, provider }: { identityId: string; provider: string }) {
  const [pending, start] = useTransition();
  const { toast } = useFlow();
  return <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => { const r = await unlinkIdentity(identityId); toast(r.error ?? `${provider} sign-in removed.`); })}>Unlink</button>;
}
