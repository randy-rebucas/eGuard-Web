"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import type { AppApproval } from "@prisma/client";
import { Icon } from "./icon";
import { useAction, useFlow } from "./flow";
import type { FormState } from "@/app/actions/auth";
import {
  addParent, changePassword, createChild, createPairingCode, deleteAccount, deleteChildData, pairingStatus, removeDevice, removeParent, renameDevice,
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
      <div className="row"><button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" style={{ background: "var(--crit)" }} disabled={pending}>{pending ? "Deleting…" : <>Delete {name}&apos;s data</>}</button></div>
    </form>
  );
}

const APPROVALS: [AppApproval, string][] = [["ALLOWED", "Allowed"], ["ALWAYS_ALLOWED", "Always allowed"], ["FILTERED", "Filtered"], ["BLOCKED", "Blocked"], ["PENDING", "Pending"]];

export function AppControls({ app }: { app: { id: string; name: string; approval: AppApproval; dailyLimitMinutes: number | null; requested?: boolean } }) {
  const [pending, run] = useAction();
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
    if (minutes != null && (!Number.isFinite(minutes) || minutes < 0)) { setLimit(saved); return; }
    run(() => setAppLimit(app.id, minutes), {
      ok: minutes ? `${app.name} limited to ${minutes} minutes a day.` : `Daily limit removed for ${app.name}.`,
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
          <input id={`lim-${app.id}`} className="input" style={{ height: 36, width: 110 }} type="number" min={0} step={15} placeholder="No limit" value={limit}
            onChange={(e) => setLimit(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            onBlur={saveLimit} />
        </>
      )}
    </div>
  );
}

type PairResult = { code?: string; expiresAt?: string; childName?: string; error?: string };
type PairState = { status: "waiting" | "expired" | "replaced" } | { status: "paired"; device: { id: string; name: string } };

const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/** How often the parent's screen asks whether the code has been used. */
const PAIR_POLL_MS = 3000;

export function PairDevice({ kids: children, used, limit }: { kids: { id: string; name: string }[]; used: number; limit: number }) {
  const [childId, setChildId] = useState(children[0]?.id ?? "");
  const [result, setResult] = useState<PairResult | null>(null);
  const [pair, setPair] = useState<PairState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  const { toast } = useFlow();
  const router = useRouter();
  const code = result?.code;
  const full = used >= limit;

  // While a code is on screen: tick the countdown, and ask every few seconds whether a device used it
  useEffect(() => {
    if (!code) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    let stop = false;
    const poll = async () => {
      while (!stop) {
        await new Promise((r) => setTimeout(r, PAIR_POLL_MS));
        if (stop) return;
        try {
          const s = await pairingStatus(code);
          if (stop) return;
          if (s.status !== "waiting") {
            setPair(s);
            if (s.status === "paired") router.refresh();
            return;
          }
        } catch { /* offline for a moment: keep asking */ }
      }
    };
    poll();
    return () => { stop = true; clearInterval(tick); };
  }, [code, router]);

  const getCode = () => start(async () => {
    setPair(null);
    try { setResult(await createPairingCode(childId)); } catch { setResult({ error: "Couldn't create a pairing code. Try again." }); }
    setNow(Date.now());
  });

  if (!children.length) return <p className="t-meta">Add a child before pairing a device.</p>;
  const left = result?.expiresAt ? new Date(result.expiresAt).getTime() - now : 0;
  const expired = pair?.status === "expired" || (!!code && !pair && left <= 0);
  return (
    <div className="dash-col" style={{ gap: 14 }}>
      <p className="t-meta">
        <span className="num">{used} of {limit}</span> devices on your plan used.
        {full ? <> Remove a device or <Link className="inline-link" href="/settings/subscription">change your plan</Link> to add another.</> : null}
      </p>
      <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field grow" style={{ minWidth: 180 }}>
          <label htmlFor="pair-child">Device belongs to</label>
          <select id="pair-child" className="input" value={childId} disabled={full} onChange={(e) => { setChildId(e.target.value); setResult(null); setPair(null); }}>
            {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" disabled={pending || full} onClick={getCode}>{pending ? <><Icon name="loader-circle" className="spin" />Creating code…</> : <><Icon name="plus" />{code ? "Get a new code" : "Get pairing code"}</>}</button>
      </div>
      {result?.error ? <div className="form-error" role="alert"><Icon name="triangle-alert" />{result.error}</div> : null}
      {pair?.status === "paired" ? (
        <div className="form-ok" role="status"><Icon name="circle-check" />{pair.device.name} is paired with {result?.childName}. eGuard is checking its protections now. <Link className="inline-link" href={`/devices/${pair.device.id}`}>View device</Link></div>
      ) : pair?.status === "replaced" ? (
        <div className="form-error" role="alert"><Icon name="triangle-alert" />This code was replaced by a newer one (another parent or tab). Get a new code.</div>
      ) : expired ? (
        <div className="form-error" role="alert"><Icon name="triangle-alert" />This code expired. Get a new code and enter it within 15 minutes.</div>
      ) : code ? (
        <div className="dash-col" style={{ gap: 10 }}>
          <div className="pairing-code num" aria-label={`Pairing code ${code.split("").join(" ")}`}>{code}</div>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <span className="t-meta">
              Open the eGuard app on {result?.childName}&apos;s phone or tablet, choose <b>Pair with parent</b>, and enter this code.{" "}
              <span className="num">Expires in {mmss(left)}.</span> This page updates when the device pairs.
            </span>
            <button className="btn btn-secondary btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(code); toast("Code copied."); } catch { toast("Select the code to copy it."); } }}><Icon name="copy" />Copy</button>
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
        <button className="btn btn-secondary" disabled={pending}>{pending ? "Saving…" : "Rename"}</button>
      </div>
    </form>
  );
}

export function RemoveDeviceButton({ deviceId, name }: { deviceId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(removeDevice.bind(null, deviceId), undefined);
  if (!open) return <button className="btn btn-secondary btn-sm" style={{ color: "var(--crit-ink)" }} onClick={() => setOpen(true)}><Icon name="trash" />Remove device</button>;
  if (state?.fields?.gone) {
    return <div className="form-error" role="alert"><Icon name="triangle-alert" />{state.error} <Link className="inline-link" href="/devices">Back to devices</Link></div>;
  }
  return (
    <form action={action} className="dash-col" style={{ gap: 10 }}>
      <p className="t-meta" style={{ color: "var(--ink-2)" }}>
        Removing {name} stops eGuard verifying it, so you won&apos;t hear if its protections change. Protections already on the device stay until someone changes them there. Other parents in your family are told. Enter your password to confirm.
      </p>
      <Feedback state={state} />
      <div className="field"><label htmlFor="rm-dev-pw">Your password</label><input className="input" id="rm-dev-pw" name="password" type="password" required autoComplete="current-password" /></div>
      <div className="row"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn btn-primary btn-sm" style={{ background: "var(--crit)" }} disabled={pending}>{pending ? "Removing…" : `Remove ${name}`}</button></div>
    </form>
  );
}

/** `confirmOff`: turning it off can't be undone, so it asks first with this text. */
export function SettingSwitch({ setting, title, desc, checked, disabled, confirmOff }: { setting: string; title: string; desc: string; checked: boolean; disabled?: boolean; confirmOff?: string }) {
  const [on, setOn] = useState(checked);
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

export function AccountForm({ name, email, timezone, zones, canSetTimezone, hasPassword, linkedSignIns }: { name: string; email: string; timezone: string; zones: string[]; canSetTimezone: boolean; hasPassword: boolean; linkedSignIns: number }) {
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
      {hasPassword ? (
        <div className="field"><label htmlFor="da-pw">Your password</label><input className="input" id="da-pw" name="password" type="password" required autoComplete="current-password" /></div>
      ) : (
        <div className="field"><label htmlFor="da-ph">Type DELETE to confirm</label><input className="input" id="da-ph" name="phrase" required autoComplete="off" /></div>
      )}
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
        <div className="field"><label htmlFor="ap-n">Name</label><input className="input" id="ap-n" name="name" /></div>
        <div className="field"><label htmlFor="ap-e">Email</label><input className="input" id="ap-e" name="email" type="email" /></div>
        <div className="field"><label htmlFor="ap-p">Temporary password</label><input className="input" id="ap-p" name="password" type="text" minLength={10} autoComplete="off" /></div>
      </div>
      <div><button className="btn btn-secondary" disabled={pending}>{pending ? "Adding…" : <><Icon name="user-plus" />Add parent</>}</button></div>
    </form>
  );
}

export function RemoveParentButton({ userId, name }: { userId: string; name: string }) {
  const [pending, run] = useAction();
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <div className="row" style={{ gap: 6 }}>
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setConfirm(false)}>Cancel</button>
      <button className="btn btn-primary btn-sm" style={{ background: "var(--crit)" }} disabled={pending}
        onClick={() => run(() => removeParent(userId), { ok: `${name} was removed from your family.`, onError: () => setConfirm(false) })}>
        {pending ? <><Icon name="loader-circle" className="spin" />Removing…</> : `Remove ${name}`}
      </button>
    </div>
  ) : <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(true)}>Remove</button>;
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
