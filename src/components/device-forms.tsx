"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Icon } from "./icon";
import { Feedback } from "./feedback";
import { ConfirmField, confirmHint } from "./confirm-field";
import { useFlow } from "./flow";
import { createPairingCode, pairingStatus, removeBrowser, removeDevice, renameDevice } from "@/app/actions/family";

type PairResult = { code?: string; expiresAt?: string; childName?: string; error?: string };
type PairState = { status: "waiting" | "expired" | "replaced" } | { status: "paired"; device: { id: string; name: string; kind?: "BROWSER" } };

const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/** How often the parent's screen asks whether the code has been used. */
const PAIR_POLL_MS = 3000;

/** `kind="BROWSER"` makes a code for the eGuard browser extension, for a computer the parent names. */
export function PairDevice({ kids: children, used, limit, kind = "DEVICE", initialChildId }: { kids: { id: string; name: string }[]; used: number; limit: number; kind?: "DEVICE" | "BROWSER"; initialChildId?: string }) {
  const [childId, setChildId] = useState(initialChildId ?? children[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const browser = kind === "BROWSER";
  const idp = browser ? "pair-browser" : "pair";
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
    try {
      setResult(await createPairingCode(childId, browser ? { kind: "BROWSER", deviceLabel: label } : { kind: "DEVICE" }));
    } catch { setResult({ error: "Couldn't create a pairing code. Try again." }); }
    setNow(Date.now());
  });

  if (!children.length) return <p className="t-meta"><Link className="inline-link" href="/children/new">Add a child</Link> before pairing a {browser ? "browser" : "device"}.</p>;
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
          <label htmlFor={`${idp}-child`}>{browser ? "Browser belongs to" : "Device belongs to"}</label>
          <select id={`${idp}-child`} className="input" value={childId} disabled={full} onChange={(e) => { setChildId(e.target.value); setResult(null); setPair(null); }}>
            {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {browser ? (
          <div className="field grow" style={{ minWidth: 200 }}>
            <label htmlFor={`${idp}-label`}>Computer name</label>
            <input id={`${idp}-label`} className="input" value={label} maxLength={60} disabled={full} placeholder="Mia's MacBook"
              onChange={(e) => { setLabel(e.target.value); setResult(null); setPair(null); }} />
          </div>
        ) : null}
        <button className="btn btn-primary" disabled={pending || full || (browser && !label.trim())} onClick={getCode}>{pending ? <><Icon name="loader-circle" className="spin" />Creating code…</> : <><Icon name="plus" />{code ? "Get a new code" : "Get pairing code"}</>}</button>
      </div>
      {result?.error ? <div className="form-error" role="alert"><Icon name="triangle-alert" />{result.error}</div> : null}
      {pair?.status === "paired" ? (
        <div className="form-ok" role="status"><Icon name="circle-check" />{pair.device.name} is paired with {result?.childName}.{" "}
          {pair.device.kind === "BROWSER"
            ? "It now appears under their devices."
            : <>eGuard is checking its protections now. <Link className="inline-link" href={`/devices/${pair.device.id}`}>View device</Link></>}</div>
      ) : pair?.status === "replaced" ? (
        <div className="form-error" role="alert"><Icon name="triangle-alert" />This code was replaced by a newer one (another parent or tab). Get a new code.</div>
      ) : expired ? (
        <div className="form-error" role="alert"><Icon name="triangle-alert" />This code expired. Get a new code and enter it within 15 minutes.</div>
      ) : code ? (
        <div className="dash-col" style={{ gap: 10 }}>
          <div className="pairing-code num" aria-label={`Pairing code ${code.split("").join(" ")}`}>{code}</div>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <span className="t-meta">
              {browser
                ? <>On {result?.childName}&apos;s computer, install eGuard for Chrome, Edge or Firefox. It opens a setup page: choose <b>Get started</b> and enter this code.{" "}</>
                : <>Open the eGuard app on {result?.childName}&apos;s phone or tablet, choose <b>Pair with parent</b>, and enter this code.{" "}</>}
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

export function RemoveBrowserButton({ installationId, name, hasPassword }: { installationId: string; name: string; hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(removeBrowser.bind(null, installationId), undefined);
  const pw = `rm-br-confirm-${installationId}`;
  if (!open) return <button className="btn btn-ghost btn-sm" style={{ color: "var(--crit-ink)" }} onClick={() => setOpen(true)}><Icon name="trash" />Remove</button>;
  if (state?.fields?.gone) return <div className="form-error" role="alert"><Icon name="triangle-alert" />{state.error}</div>;
  return (
    <form action={action} className="dash-col" style={{ gap: 10 }}>
      <p className="t-meta" style={{ color: "var(--ink-2)" }}>
        Removing {name} disconnects eGuard from it: it stops protecting and verifying that browser. Other parents in your family are told. {confirmHint(hasPassword)}
      </p>
      <Feedback state={state} />
      <ConfirmField id={pw} hasPassword={hasPassword} />
      {/* Short label: this sits inside a narrow device card */}
      <div className="row" style={{ flexWrap: "wrap" }}><button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn btn-primary btn-sm" style={{ background: "var(--crit)" }} disabled={pending}>{pending ? "Removing…" : "Remove browser"}</button></div>
    </form>
  );
}

export function RemoveDeviceButton({ deviceId, name, hasPassword }: { deviceId: string; name: string; hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(removeDevice.bind(null, deviceId), undefined);
  if (!open) return <button className="btn btn-secondary btn-sm" style={{ color: "var(--crit-ink)" }} onClick={() => setOpen(true)}><Icon name="trash" />Remove device</button>;
  if (state?.fields?.gone) {
    return <div className="form-error" role="alert"><Icon name="triangle-alert" />{state.error} <Link className="inline-link" href="/devices">Back to devices</Link></div>;
  }
  return (
    <form action={action} className="dash-col" style={{ gap: 10 }}>
      <p className="t-meta" style={{ color: "var(--ink-2)" }}>
        Removing {name} stops eGuard verifying it, so you won&apos;t hear if its protections change. Protections already on the device stay until someone changes them there. Other parents in your family are told. {confirmHint(hasPassword)}
      </p>
      <Feedback state={state} />
      <ConfirmField id="rm-dev-confirm" hasPassword={hasPassword} />
      <div className="row"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn btn-primary btn-sm" style={{ background: "var(--crit)" }} disabled={pending}>{pending ? "Removing…" : `Remove ${name}`}</button></div>
    </form>
  );
}
