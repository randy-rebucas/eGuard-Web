"use client";

/** Settings forms: account, security, family members and privacy switches. */

import { useActionState, useState } from "react";
import { Icon } from "./icon";
import { Feedback } from "./feedback";
import { ConfirmField } from "./confirm-field";
import { useAction } from "./flow";
import {
  addParent, changePassword, deleteAccount, removeParent, resendInvitation, setToggle, signOutOthers, unlinkIdentity, updateAccount,
} from "@/app/actions/family";

/** `confirmOff`: turning it off can't be undone, so it asks first with this text. */
export function SettingSwitch({ setting, title, desc, checked, disabled, confirmOff }: { setting: string; title: string; desc: string; checked: boolean; disabled?: boolean; confirmOff?: string }) {
  const [on, setOn] = useState(checked);
  // Follow the saved value when the page refreshes (another parent or the app changed it)
  const [saved, setSaved] = useState(checked);
  if (saved !== checked) { setSaved(checked); setOn(checked); }
  const [confirming, setConfirming] = useState(false);
  const [pending, run] = useAction();
  const id = `sw-${setting}`;
  const save = (v: boolean) => {
    setOn(v);
    setConfirming(false);
    // The switch itself shows success; only a failure needs saying
    run(() => setToggle(setting, v), { onError: () => setOn(!v) });
  };
  return (
    <div className="setting-row" style={{ flexWrap: "wrap" }}>
      <div className="grow"><div className="t-title" id={id}>{title}</div><div className="t-meta">{desc}</div></div>
      <button type="button" className="switch" role="switch" aria-checked={on} aria-labelledby={id} disabled={pending || disabled || confirming}
        onClick={() => (on && confirmOff ? setConfirming(true) : save(!on))} />
      {confirming ? (
        <div className="row" role="alert" style={{ width: "100%", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
          <span className="t-meta" style={{ color: "var(--ink-2)" }}>{confirmOff}</span>
          <span className="row" style={{ gap: 6 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" style={{ background: "var(--crit)" }} onClick={() => save(false)}>Turn off and delete</button>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** `canSetTimezone`: the family admin, who also names the family. */
export function AccountForm({ name, email, familyName, timezone, zones, canSetTimezone, hasPassword, linkedSignIns }: { name: string; email: string; familyName: string; timezone: string; zones: string[]; canSetTimezone: boolean; hasPassword: boolean; linkedSignIns: number }) {
  const [state, action, pending] = useActionState(updateAccount, undefined);
  const [newEmail, setNewEmail] = useState(email);
  const changingEmail = newEmail.trim().toLowerCase() !== email;
  return (
    <form action={action} className="dash-col" style={{ gap: 16 }}>
      <Feedback state={state} />
      <div className="form-grid">
        <div className="field"><label htmlFor="fn">Full name</label><input className="input" id="fn" name="name" defaultValue={name} autoComplete="name" /></div>
        <div className="field">
          <label htmlFor="em">Email</label>
          {/* Changing the email needs the password, so without one it can't be changed here */}
          <input className="input" id="em" name="email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" readOnly={!hasPassword} aria-describedby={hasPassword ? undefined : "em-hint"} />
          {!hasPassword ? <span className="field-hint" id="em-hint">You signed up with Apple or Google. To change your email, sign out and use “Forgot password?” to set a password first.</span> : null}
        </div>
        {changingEmail && hasPassword ? (
          <div className="field">
            <label htmlFor="em-pw">Current password</label>
            <input className="input" id="em-pw" name="password" type="password" autoComplete="current-password" required />
            <span className="field-hint">
              Needed to change your email.
              {linkedSignIns ? ` Your Apple or Google sign-in will be unlinked; sign in with ${newEmail.trim() || "the new email"} and your password afterwards.` : ""}
            </span>
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="fam">Family name</label>
          <input className="input" id="fam" name="familyName" defaultValue={familyName} maxLength={80} required={canSetTimezone} disabled={!canSetTimezone} aria-describedby="fam-hint" />
          <span className="field-hint" id="fam-hint">{canSetTimezone ? "Shown to parents you invite and in the weekly summary." : "Only the family admin can change this."}</span>
        </div>
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
      <div><button className="btn btn-secondary" disabled={pending}>{pending ? "Changing…" : "Change password"}</button></div>
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
      <ConfirmField id="da-confirm" hasPassword={hasPassword} />
      <div className="row"><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" style={{ background: "var(--crit)" }} disabled={pending}>{pending ? "Deleting…" : isAdmin ? "Delete family and account" : "Delete my account"}</button></div>
    </form>
  );
}

export function AddParentForm() {
  const [state, action, pending] = useActionState(addParent, undefined);
  return (
    <form action={action} className="dash-col" style={{ gap: 14 }}>
      <Feedback state={state} />
      <div className="form-grid">
        <div className="field"><label htmlFor="ap-n">Name</label><input className="input" id="ap-n" name="name" autoComplete="off" /></div>
        <div className="field"><label htmlFor="ap-e">Email</label><input className="input" id="ap-e" name="email" type="email" autoComplete="off" /></div>
      </div>
      <p className="t-meta">We email them an invitation. They see your family&apos;s name, choose their own password, and join once they accept.</p>
      <div><button className="btn btn-secondary" disabled={pending}>{pending ? "Sending…" : <><Icon name="user-plus" />Send invitation</>}</button></div>
    </form>
  );
}

/** For a parent who hasn't accepted yet: send the email again, or withdraw the invitation. */
export function PendingInviteActions({ userId, name }: { userId: string; name: string }) {
  const [pending, run] = useAction();
  return (
    <div className="row" style={{ gap: 6 }}>
      <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => resendInvitation(userId), { ok: `Invitation sent to ${name} again.` })}>Resend</button>
      <RemoveParentButton userId={userId} name={name} invite />
    </div>
  );
}

/** `invite`: withdraws an invitation that hasn't been accepted (same action: the pending account is removed). */
export function RemoveParentButton({ userId, name, invite = false }: { userId: string; name: string; invite?: boolean }) {
  const [pending, run] = useAction();
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <div className="row" style={{ gap: 6 }}>
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setConfirm(false)}>Keep</button>
      <button className="btn btn-primary btn-sm" style={{ background: "var(--crit)" }} disabled={pending}
        onClick={() => run(() => removeParent(userId), { ok: invite ? `Invitation to ${name} withdrawn.` : `${name} was removed from your family.`, onError: () => setConfirm(false) })}>
        {pending ? <><Icon name="loader-circle" className="spin" />{invite ? "Withdrawing…" : "Removing…"}</> : invite ? "Withdraw invitation" : `Remove ${name}`}
      </button>
    </div>
  ) : <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(true)}>{invite ? "Withdraw" : "Remove"}</button>;
}

export function SignOutOthersButton() {
  const [pending, run] = useAction();
  return (
    <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(signOutOthers, { ok: "Other sessions were signed out." })}>
      {pending ? <><Icon name="loader-circle" className="spin" />Signing out…</> : "Sign out other sessions"}
    </button>
  );
}

export function UnlinkIdentityButton({ identityId, provider }: { identityId: string; provider: string }) {
  const [pending, run] = useAction();
  return (
    <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => unlinkIdentity(identityId), { ok: `${provider} sign-in removed.` })}>
      {pending ? <><Icon name="loader-circle" className="spin" />Unlinking…</> : "Unlink"}
    </button>
  );
}
