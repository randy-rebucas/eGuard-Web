"use client";

/**
 * The configuration and check dialogs. Lazy-loaded by FlowProvider (see flow.tsx) so their code
 * and the protection catalogue only download when a parent opens one.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProtectionKey } from "@prisma/client";
import { Icon } from "./icon";
import { Avatar, CheckBadge, HealthRing, Loading } from "./ui";
import { FAILED, useFlow } from "./flow";
import { cancelBatch, confirmGuided, getFlowChildren, getFlowContext, startCheck, submitConfig, type FlowContext } from "@/app/actions/config";
import { CAPABILITY_META, PROTECTIONS, PROTECTION_BY_KEY, describeConfig, type Capability, type ProtectionConfig } from "@/lib/protections";

/* ================= Dialog shell ================= */

function Dialog({ labelledBy, onClose, children, small, role = "dialog" }: { labelledBy: string; onClose: () => void; children: React.ReactNode; small?: boolean; role?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<Element | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    last.current = document.activeElement;
    const el = ref.current!;
    const first = el.querySelector<HTMLElement>("[data-autofocus], button:not([data-close]):not(:disabled), input, select");
    (first ?? el).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key !== "Tab") return;
      const f = [...el.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select, a[href], [tabindex]:not([tabindex='-1'])")];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    window.addEventListener("keydown", onKey);
    const prev = last.current as HTMLElement | null;
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, []);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} className={`dialog ${small ? "sm" : ""}`} role={role} aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>
  );
}

/* ================= Configuration workflow ================= */

const STEPS = ["Select protection", "Review current configuration", "Choose new configuration", "Apply to device", "Verify", "Configuration Health updated"];

type BatchState = {
  requests: { id: string; deviceId: string; deviceName: string; mode: "APPLY" | "GUIDED"; status: string; failureReason: string | null; offline: boolean; from: string; to: string }[];
  score: number;
};
const OPEN = ["PENDING", "DELIVERED", "AWAITING_PARENT"];

export function ConfigFlow({ initialKey, initialChild, onClose }: { initialKey?: ProtectionKey; initialChild?: string; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useFlow();
  const [key, setKey] = useState<ProtectionKey | undefined>(initialKey);
  const [childId, setChildId] = useState<string | undefined>(initialChild);
  const [kids, setKids] = useState<Awaited<ReturnType<typeof getFlowChildren>> | null>(null);
  const [ctx, setCtx] = useState<FlowContext | null>(null);
  const [draft, setDraft] = useState<ProtectionConfig | null>(null);
  const [step, setStep] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchState | null>(null);
  const [guidedDone, setGuidedDone] = useState(false);
  /** Loading the flow failed: nothing to show but the reason and a retry */
  const [error, setError] = useState<string | null>(null);
  /** An action failed: shown above the current step, which stays usable */
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const startedAt = useRef(0);
  const [timedOut, setTimedOut] = useState(false);

  // Load children when needed
  useEffect(() => {
    if (childId) return;
    let alive = true;
    getFlowChildren().then((k) => alive && setKids(k)).catch(() => alive && setError(FAILED));
    return () => { alive = false; };
  }, [childId, attempt]);
  // Load context once protection + child are known
  useEffect(() => {
    if (!key || !childId) return;
    let alive = true;
    getFlowContext(childId, key)
      .then((c) => {
        if (!alive) return;
        if (c.error !== undefined) { setError(c.error); return; }
        setCtx(c); setDraft(c.policy); setStep(1);
      })
      .catch(() => alive && setError(FAILED));
    return () => { alive = false; };
  }, [key, childId, attempt]);

  // Poll batch status during apply/verify
  useEffect(() => {
    if (!batchId || step < 3 || step > 4) return;
    let alive = true, misses = 0;
    const tick = async () => {
      try {
        const r = await fetch(`/api/flow/${batchId}`);
        if (!alive) return;
        if (r.status === 404) { clearInterval(t); setError("This change is no longer available. It may have been cancelled."); return; }
        if (!r.ok) throw new Error(String(r.status));
        const data: BatchState = await r.json();
        if (!alive) return;
        misses = 0; setOffline(false);
        setBatch(data);
        const awaitingParent = data.requests.some((x) => x.status === "AWAITING_PARENT");
        const open = data.requests.some((x) => OPEN.includes(x.status) && x.status !== "AWAITING_PARENT");
        if (step === 3 && !awaitingParent) setStep(4);
        if (step === 4 && !open && !awaitingParent) { setStep(5); router.refresh(); }
        if (step === 4 && Date.now() - startedAt.current > 20_000) setTimedOut(true);
      } catch {
        // Keep polling; after a few misses in a row, say so rather than spinning silently
        if (alive && ++misses >= 4) setOffline(true);
      }
    };
    tick();
    const t = setInterval(tick, 1200);
    return () => { alive = false; clearInterval(t); };
  }, [batchId, step, router]);

  const def = key ? PROTECTION_BY_KEY[key] : null;
  const supported = ctx?.devices.filter((d) => d.capability !== "UNSUPPORTED") ?? [];

  const retry = () => { setError(null); setNotice(null); setCtx(null); setKids(null); setBatchId(null); setBatch(null); setStep(0); setAttempt((n) => n + 1); };

  /** Runs one of the flow's actions; a failure becomes the inline notice. */
  const act = async <T,>(fn: () => Promise<T | { error: string; code?: string }>): Promise<T | null> => {
    setBusy(true); setNotice(null);
    try {
      const r = await fn();
      if (r && typeof r === "object" && "error" in r && typeof r.error === "string") { setNotice(r.error); return null; }
      return r as T;
    } catch {
      setNotice(FAILED);
      return null;
    } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!ctx || !draft) return;
    const r = await act(() => submitConfig(ctx.child.id, draft));
    setConfirming(false);
    if (!r) return;
    // No device yet: saved as the child's setting, nothing to verify until one pairs
    if (!r.batchId) { toast(`Saved. It applies once ${ctx.child.name}'s device is paired.`, "ok"); router.refresh(); onClose(); return; }
    setBatchId(r.batchId); startedAt.current = Date.now(); setStep(3);
  };

  const cancelChange = async () => {
    if (!batchId) return onClose();
    if (await act(() => cancelBatch(batchId))) { toast("Change cancelled. Nothing was changed on the device.", "ok"); onClose(); }
  };

  const verifyGuided = async () => {
    if (!batchId) return;
    if (await act(() => confirmGuided(batchId))) { startedAt.current = Date.now(); setStep(4); }
  };

  const resume = (id: string) => { setBatchId(id); startedAt.current = Date.now(); setStep(3); };

  const close = () => {
    if (step >= 3 && step < 5) toast("Verification continues in the background. You'll see the result on the Protection page.");
    if (step === 5) router.refresh();
    onClose();
  };

  if (confirming && ctx && def) {
    return (
      <Dialog labelledBy="cf-title" onClose={() => setConfirming(false)} small role="alertdialog">
        <div className="dialog-head"><span className="ico-tile warn"><Icon name="shield-alert" /></span><div><h2 id="cf-title">Change Protection Settings</h2></div></div>
        <div className="dialog-body">
          <p>{supported.length
            ? <>You&apos;re about to modify {ctx.child.name}&apos;s device protection on {supported.map((d) => d.name).join(" and ")}. Once it&apos;s applied, the change shows in eGuard on {ctx.child.name}&apos;s device.</>
            : <>{ctx.child.name} has no paired device yet. This is saved as {ctx.child.name}&apos;s setting and applied when a device is paired.</>}</p>
          <div className="compare" style={{ marginTop: 14 }}>
            <div><span className="t-meta">Now</span><b>{ctx.policyLabel}</b></div>
            <Icon name="arrow-right" />
            <div><span className="t-meta">New</span><b>{describeConfig(draft)}</b></div>
          </div>
        </div>
        <div className="dialog-foot">
          <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy} data-autofocus>{busy ? <><Icon name="loader-circle" className="spin" />{supported.length ? "Sending…" : "Saving…"}</> : supported.length ? "Continue" : "Save"}</button>
        </div>
      </Dialog>
    );
  }

  const head = (
    <div className="dialog-head">
      <span className="ico-tile"><Icon name={def?.icon ?? "shield-check"} /></span>
      <div className="grow">
        <h2 id="flow-title">{def ? def.name : "Change a protection"}{ctx ? ` for ${ctx.child.name}` : ""}</h2>
        {ctx ? <p className="t-meta">{ctx.devices.map((d) => `${d.name} · ${CAPABILITY_META[d.capability as Capability].label}`).join("  ·  ")}</p> : null}
      </div>
      <button className="icon-btn" data-close aria-label="Close" onClick={close}><Icon name="x" /></button>
    </div>
  );
  const stepper = (
    <>
      <div className="stepper" aria-hidden="true">{STEPS.map((s, i) => <span key={s} className={i <= step ? "done" : ""} />)}</div>
      <div className="step-label">Step {step + 1} of 6 · {STEPS[step]}</div>
    </>
  );

  let body: React.ReactNode = null, foot: React.ReactNode = null;

  if (error) {
    body = <div className="form-error" role="alert"><Icon name="triangle-alert" />{error}</div>;
    foot = <><button className="btn btn-ghost" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={retry} data-autofocus><Icon name="refresh-cw" />Try again</button></>;
  } else if (!key) {
    body = (
      <>
        <p className="muted" style={{ marginBottom: 12 }}>Which protection do you want to change?</p>
        {PROTECTIONS.map((p) => (
          <button key={p.key} className="list-row" onClick={() => setKey(p.key)}>
            <span className="ico-tile"><Icon name={p.icon} /></span><span className="grow t-title">{p.name}</span><span className="chev"><Icon name="chevron-right" /></span>
          </button>
        ))}
      </>
    );
  } else if (!childId) {
    body = !kids ? <Loading height={120} label="Loading children" /> : kids.length ? (
      <>
        <p className="muted" style={{ marginBottom: 12 }}>Which child is this for?</p>
        {kids.map((c) => (
          <button key={c.id} className="list-row" onClick={() => setChildId(c.id)}>
            <Avatar name={c.name} hue={c.hue} photo={c.photo} />
            <span className="grow"><span className="t-title" style={{ display: "block" }}>{c.name}</span>
              <span className="t-meta">{c.devices.length ? c.devices.map((d) => `${d.name} · ${CAPABILITY_META[PROTECTION_BY_KEY[key].caps[d.platform]].label}`).join(", ") : "No device yet · applied once one is paired"}</span></span>
            <span className="chev"><Icon name="chevron-right" /></span>
          </button>
        ))}
      </>
    ) : <div className="form-error"><Icon name="user-plus" /><span className="grow">Add a child first, then pair their device.</span><Link className="link-btn" href="/children/new" onClick={onClose}>Add a child</Link></div>;
  } else if (!ctx || !draft) {
    body = <Loading height={140} label="Loading current settings" />;
  } else if (step === 1) {
    body = (
      <>
        <div className="kv" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
          {ctx.devices.map((d) => (
            <div key={d.id}>
              <dt>{d.name} · {d.platformLabel} · {CAPABILITY_META[d.capability as Capability].label}</dt>
              <dd style={{ justifyContent: "space-between", flexWrap: "wrap" }}><span>{d.currentLabel}</span><CheckBadge status={d.status as never} /></dd>
            </div>
          ))}
        </div>
        <p className="t-meta" style={{ marginTop: 12 }}>Your setting for {ctx.child.name}: <b style={{ color: "var(--ink-2)" }}>{ctx.policyLabel}</b></p>
        {!ctx.devices.length ? (
          <div className="form-ok" style={{ marginTop: 12 }}><Icon name="smartphone" /><span className="grow">{ctx.child.name} has no paired device yet. You can change the setting now; eGuard applies and verifies it once a device is paired.</span><Link className="link-btn" href={`/devices?child=${ctx.child.id}#pair`} onClick={onClose}>Pair a device</Link></div>
        ) : !supported.length ? <div className="form-error" style={{ marginTop: 12 }}><Icon name="circle-slash" />{def!.name} isn&apos;t supported on {ctx.child.name}&apos;s devices, so it isn&apos;t counted in health.</div> : null}
        {ctx.openBatch ? <div className="form-ok" style={{ marginTop: 12 }}><Icon name="loader-circle" />A change is already waiting for verification. <button className="link-btn" onClick={() => resume(ctx.openBatch!)}>Check progress</button></div> : null}
      </>
    );
    foot = <><button className="btn btn-ghost" onClick={close}>Cancel</button><button className="btn btn-primary" disabled={!!ctx.devices.length && !supported.length} onClick={() => setStep(2)}>Continue</button></>;
  } else if (step === 2) {
    const problem = draftProblem(draft);
    body = (
      <>
        <ConfigForm value={draft} onChange={setDraft} childName={ctx.child.name} />
        {problem ? <p className="form-error" id="draft-problem" role="status" style={{ marginTop: 12 }}><Icon name="triangle-alert" />{problem}</p> : null}
      </>
    );
    const guided = supported.some((d) => d.capability !== "AVAILABLE");
    foot = <><button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button><button className="btn btn-primary" disabled={!!problem} onClick={() => setConfirming(true)}>{!supported.length ? "Save" : guided ? "Continue to setup" : "Apply to device"}</button></>;
  } else if (step === 3 || step === 4) {
    const guided = batch?.requests.filter((r) => r.status === "AWAITING_PARENT") ?? [];
    body = (
      <>
        {step === 3 && guided.length ? (
          <div style={{ marginBottom: 16 }}>
            {guided.map((r) => {
              const dev = ctx.devices.find((d) => d.id === r.deviceId);
              return (
                <div key={r.id} style={{ marginBottom: 12 }}>
                  <p className="muted" style={{ marginBottom: 10 }}>{dev?.platformLabel} doesn&apos;t let eGuard change this remotely. On {ctx.child.name}&apos;s {r.deviceName}:</p>
                  <ol className="guide-steps">{(dev?.guide ?? ["Open Settings on the device and turn this protection on."]).map((s) => <li key={s}>{s}</li>)}</ol>
                </div>
              );
            })}
            <label className="check">
              <input type="checkbox" id="guided-done" checked={guidedDone} onChange={(e) => setGuidedDone(e.target.checked)} />
              <span><span className="t-title" style={{ display: "block" }}>I&apos;ve done these steps on the device</span><span className="t-meta">eGuard will check the device next. Nothing is marked done until it&apos;s verified.</span></span>
            </label>
          </div>
        ) : null}
        <div className="progress-list">
          {(batch?.requests ?? []).map((r) => <RequestRow key={r.id} r={r} />)}
          {!batch ? <Loading height={80} label="Sending to devices" /> : null}
        </div>
        {offline ? (
          <p className="form-error" role="alert" style={{ marginTop: 12 }}><Icon name="wifi-off" />Can&apos;t reach eGuard right now. Still trying; the change stays queued either way.</p>
        ) : timedOut ? (
          <p className="form-ok" style={{ marginTop: 12 }}><Icon name="info" />Some devices haven&apos;t answered yet. eGuard keeps the change waiting and verifies it when they sync. You can close this.</p>
        ) : (
          <p className="t-meta" style={{ marginTop: 10 }}>Devices must be online. This usually takes a few seconds.</p>
        )}
      </>
    );
    foot = step === 3 && guided.length ? (
      <>
        <button className="btn btn-ghost" disabled={busy} onClick={cancelChange}>Cancel change</button>
        <button className="btn btn-primary" disabled={!guidedDone || busy} onClick={verifyGuided}>{busy ? <><Icon name="loader-circle" className="spin" />Working…</> : "Verify now"}</button>
      </>
    ) : (
      <><button className="btn btn-secondary" onClick={close}>{timedOut ? "Close" : "Continue in background"}</button><button className="btn btn-primary" disabled>Verifying…</button></>
    );
  } else if (step === 5 && batch) {
    const verified = batch.requests.filter((r) => r.status === "VERIFIED");
    const failed = batch.requests.filter((r) => r.status === "FAILED");
    const first = batch.requests[0];
    body = (
      <>
        <div className="row" style={{ gap: 16, alignItems: "center" }}>
          <HealthRing score={batch.score} total={PROTECTIONS.length} small label={`${ctx.child.name}'s protection health`} />
          <div>
            {failed.length ? (
              <span className="pill tone-warn"><Icon name="triangle-alert" />{failed.length} device{failed.length > 1 ? "s" : ""} didn&apos;t confirm</span>
            ) : verified.length ? (
              <span className="pill tone-ok"><Icon name="circle-check" />Verified on {verified.map((v) => v.deviceName).join(" and ")}</span>
            ) : (
              // Every request ended without a device answer: cancelled here or by another parent
              <span className="pill tone-muted"><Icon name="circle-slash" />Not applied</span>
            )}
            <p style={{ marginTop: 8 }}>{verified.length ? <>{def!.name} is set to <b>{first.to}</b>. </> : <>{def!.name} wasn&apos;t changed on any device. </>}{ctx.child.name}&apos;s protection health is now <b className="num">{batch.score} / {PROTECTIONS.length}</b>.</p>
          </div>
        </div>
        {first.from !== first.to ? (
          <div className="compare" style={{ marginTop: 16 }}>
            <div><span className="t-meta">Before</span><b>{first.from}</b></div><Icon name="arrow-right" /><div><span className="t-meta">After</span><b>{first.to}</b></div>
          </div>
        ) : null}
        {failed.map((f) => <p key={f.id} className="form-error" style={{ marginTop: 12 }}><Icon name="triangle-alert" />{f.deviceName}: {f.failureReason ?? "Device reported a different setting."}</p>)}
        <p className="t-meta" style={{ marginTop: 12 }}>Added to {ctx.child.name}&apos;s configuration history.</p>
      </>
    );
    foot = <><button className="btn btn-secondary" onClick={() => { onClose(); router.push(`/children/${ctx.child.id}?tab=history`); }}>View history</button><button className="btn btn-primary" onClick={close}>Done</button></>;
  }

  return (
    <Dialog labelledBy="flow-title" onClose={close}>
      {head}
      {ctx && !error ? stepper : null}
      <div className="dialog-body">
        {notice && !error ? <div className="form-error" role="alert" style={{ marginBottom: 12 }}><Icon name="triangle-alert" />{notice}</div> : null}
        {body}
      </div>
      {foot ? <div className="dialog-foot">{foot}</div> : null}
    </Dialog>
  );
}

function RequestRow({ r }: { r: BatchState["requests"][number] }) {
  const map: Record<string, { icon: React.ReactNode; text: string }> = {
    PENDING: { icon: <Icon name="loader-circle" className="spin" />, text: r.offline ? "Waiting for the device to come online" : "Sending to device" },
    AWAITING_PARENT: { icon: <Icon name="list-checks" style={{ color: "var(--accent-ink)" }} />, text: "Waiting for you to finish the steps" },
    DELIVERED: { icon: <Icon name="loader-circle" className="spin" />, text: r.mode === "GUIDED" ? "Checking the device" : "Waiting for the device to confirm" },
    VERIFIED: { icon: <Icon name="circle-check" style={{ color: "var(--ok)" }} />, text: "Verified" },
    FAILED: { icon: <Icon name="triangle-alert" style={{ color: "var(--warn)" }} />, text: r.failureReason ?? "Device reported a different setting" },
    CANCELLED: { icon: <Icon name="x" />, text: "Cancelled" },
  };
  const m = map[r.status] ?? map.PENDING;
  return <div className="pl">{m.icon}<span className="grow">{r.deviceName}</span><span className="t-meta">{m.text}</span></div>;
}

/* ---------- Per-protection forms ---------- */

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="setting-row" style={{ paddingTop: 8 }}>
      <div className="grow"><div className="t-title" id={`${id}-l`}>{label}</div>{hint ? <div className="t-meta">{hint}</div> : null}</div>
      <button type="button" className="switch" role="switch" aria-checked={checked} aria-labelledby={`${id}-l`} onClick={() => onChange(!checked)} />
    </div>
  );
}

/** Ratings the picker offers; a value set elsewhere (the mobile app allows any 4–18) is added so it isn't silently changed. */
const RATINGS = [4, 9, 12, 13, 16, 17, 18];

/** Why the draft can't be sent, in words for the parent; null when it's fine. Mirrors ConfigSchema on the server. */
function draftProblem(v: ProtectionConfig): string | null {
  if (v.key === "SCREEN_TIME") {
    const bad = (m: number) => !Number.isInteger(m) || m < 15 || m > 1440;
    if (bad(v.dailyMinutes) || bad(v.weekendMinutes)) return "Set each limit between 15 minutes and 24 hours (1440 minutes), in whole minutes.";
  }
  if (v.key === "BEDTIME" && v.enabled) {
    if (!v.start || !v.end) return "Choose when bedtime starts and ends.";
    if (v.start === v.end) return "Bedtime needs different start and end times.";
  }
  return null;
}

function ConfigForm({ value, onChange, childName }: { value: ProtectionConfig; onChange: (v: ProtectionConfig) => void; childName: string }) {
  const set = (patch: Partial<ProtectionConfig>) => onChange({ ...value, ...patch } as ProtectionConfig);
  // An emptied number field stays empty while typing instead of turning into 0
  const minutes = (s: string) => (s === "" ? Number.NaN : Number(s));
  const shown = (m: number) => (Number.isNaN(m) ? "" : m);
  switch (value.key) {
    case "SCREEN_TIME":
      return (
        <div className="form-grid">
          <div className="field"><label htmlFor="st-d">School days (minutes)</label><input className="input" id="st-d" type="number" min={15} max={1440} step={15} value={shown(value.dailyMinutes)} onChange={(e) => set({ dailyMinutes: minutes(e.target.value) })} aria-describedby="draft-problem" /></div>
          <div className="field"><label htmlFor="st-w">Weekends (minutes)</label><input className="input" id="st-w" type="number" min={15} max={1440} step={15} value={shown(value.weekendMinutes)} onChange={(e) => set({ weekendMinutes: minutes(e.target.value) })} aria-describedby="draft-problem" /></div>
        </div>
      );
    case "BEDTIME":
      return (
        <>
          <Toggle id="bt-on" label="Bedtime schedule" hint="Apps are paused during bedtime. Calls and messages to family stay available." checked={value.enabled} onChange={(v) => set({ enabled: v })} />
          <div className="form-grid" style={{ marginTop: 8 }}>
            <div className="field"><label htmlFor="bt-s">Starts</label><input className="input" id="bt-s" type="time" value={value.start} disabled={!value.enabled} onChange={(e) => set({ start: e.target.value })} /></div>
            <div className="field"><label htmlFor="bt-e">Ends</label><input className="input" id="bt-e" type="time" value={value.end} disabled={!value.enabled} onChange={(e) => set({ end: e.target.value })} /></div>
          </div>
          <div className="seg" role="group" aria-label="Days" style={{ marginTop: 14 }}>
            <button type="button" aria-pressed={value.days === "EVERY_DAY"} onClick={() => set({ days: "EVERY_DAY" })}>Every day</button>
            <button type="button" aria-pressed={value.days === "SCHOOL_NIGHTS"} onClick={() => set({ days: "SCHOOL_NIGHTS" })}>School nights</button>
          </div>
        </>
      );
    case "APP_RESTRICTIONS":
    case "CONTENT":
      return (
        <div className="field">
          <label htmlFor="rating">{value.key === "CONTENT" ? "Allow content rated up to" : "Allow apps rated up to"}</label>
          <select className="input" id="rating" value={value.maxAgeRating} onChange={(e) => set({ maxAgeRating: Number(e.target.value) })}>
            {[...new Set([...RATINGS, value.maxAgeRating])].sort((a, b) => a - b).map((r) => <option key={r} value={r}>{r}+</option>)}
          </select>
        </div>
      );
    case "WEB":
      return (
        <div className="field">
          <label htmlFor="web">Web filtering</label>
          <select className="input" id="web" value={value.mode} onChange={(e) => set({ mode: e.target.value as "OFF" | "FILTER" | "ALLOWLIST" })}>
            <option value="FILTER">Filter adult and unsafe sites</option>
            <option value="ALLOWLIST">Allowed sites only</option>
            <option value="OFF">Off</option>
          </select>
        </div>
      );
    case "APP_APPROVAL":
      return <Toggle id="aa" label="Require approval for new apps" hint={`${childName} asks, you approve from the dashboard or notifications.`} checked={value.enabled} onChange={(v) => set({ enabled: v })} />;
    case "DOWNLOADS":
      return <Toggle id="dl" label="Require approval for downloads and purchases" checked={value.requireApproval} onChange={(v) => set({ requireApproval: v })} />;
    case "LOCATION":
      return <Toggle id="loc" label="Share current location" hint="Updated when the device moves. Places are kept only if location history is on in Privacy settings." checked={value.sharing} onChange={(v) => set({ sharing: v })} />;
    case "NOTIFICATIONS":
      return <Toggle id="nt" label="Silence app notifications during bedtime" checked={value.quietDuringBedtime} onChange={(v) => set({ quietDuringBedtime: v })} />;
    case "UNINSTALL_PROTECTION":
      return <Toggle id="up" label="Prevent eGuard from being removed" hint="Removing eGuard will need a parent's approval." checked={value.enabled} onChange={(v) => set({ enabled: v })} />;
  }
}

/* ================= Configuration check ================= */

type CheckState = { status: "RUNNING" | "COMPLETED"; score: number; verified: boolean; offline: number; results: { deviceId: string; deviceName: string; childName: string; reachable: boolean | null; issues: number | null; reported: boolean }[] };

export function CheckDialog({ deviceId, onClose }: { deviceId?: string; onClose: () => void }) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  const [state, setState] = useState<CheckState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    startCheck(deviceId)
      .then((r) => { if (alive) { if (r.error !== undefined) setError(r.error); else setRunId(r.runId); } })
      .catch(() => alive && setError(FAILED));
    return () => { alive = false; };
  }, [deviceId, attempt]);
  useEffect(() => {
    if (!runId) return;
    let alive = true, misses = 0;
    const tick = async () => {
      try {
        const r = await fetch(`/api/checks/${runId}`);
        if (!alive) return;
        if (!r.ok) throw new Error(String(r.status));
        const data: CheckState = await r.json();
        if (!alive) return;
        misses = 0; setError(null);
        setState(data);
        if (data.status === "COMPLETED") { clearInterval(t); router.refresh(); }
      } catch {
        if (alive && ++misses >= 5) setError("Can't reach eGuard right now. Still trying; the check keeps running on the devices.");
      }
    };
    const t = setInterval(tick, 900);
    tick();
    return () => { alive = false; clearInterval(t); };
  }, [runId, router]);

  const done = state?.status === "COMPLETED";
  // Starting the check failed: nothing is running, so offer to start again
  const failedToStart = !!error && !runId;
  return (
    <Dialog labelledBy="rc-title" onClose={onClose}>
      <div className="dialog-head">
        <span className="ico-tile"><Icon name="scan-search" /></span>
        <div className="grow"><h2 id="rc-title">Configuration Check</h2><p className="t-meta">{state ? `${state.results.length} device${state.results.length === 1 ? "" : "s"} · ${PROTECTIONS.length} protections` : "Starting…"}</p></div>
        <button className="icon-btn" data-close aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="dialog-body">
        {error ? <div className="form-error" role="alert" style={{ marginBottom: 12 }}><Icon name={runId ? "wifi-off" : "triangle-alert"} />{error}</div> : null}
        <div className="progress-list">
          {state?.results.map((r) => (
            <div className="pl" key={r.deviceId}>
              {r.reported ? (r.issues ? <Icon name="triangle-alert" style={{ color: "var(--warn)" }} /> : <Icon name="circle-check" style={{ color: "var(--ok)" }} />)
                : r.reachable === false ? <Icon name="wifi-off" style={{ color: "var(--ink-3)" }} /> : <Icon name="loader-circle" className="spin" />}
              <span className="grow">{r.deviceName} <span className="t-meta">· {r.childName}</span></span>
              {r.reported ? (r.issues ? <span className="pill tone-warn">{r.issues} to review</span> : <span className="pill tone-ok">All verified</span>)
                : r.reachable === false ? <span className="pill tone-muted">Couldn&apos;t reach</span> : <span className="t-meta">Checking…</span>}
            </div>
          ))}
          {!state && !failedToStart ? <Loading height={120} label="Starting the check" /> : null}
        </div>
        {done && state ? (
          <div aria-live="polite">
            <hr className="divider" style={{ margin: "14px 0" }} />
            <div className="row">
              <HealthRing score={state.score} total={PROTECTIONS.length} small />
              <div>
                <div className="t-title">Configuration Health: {state.score} / {PROTECTIONS.length}</div>
                <div className="t-meta">{/* Same wording as the Protection page: offline devices count with their last known state, never as verified */}
                  {state.verified ? "Every protection is verified." : state.score === PROTECTIONS.length ? "Every protection is set, as last reported." : `${PROTECTIONS.length - state.score} protection${PROTECTIONS.length - state.score > 1 ? "s" : ""} still need review.`}
                  {state.offline || state.results.some((r) => r.reachable === false) ? " Devices that didn't answer keep their last known state." : ""}</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="dialog-foot">
        {failedToStart ? (
          <><button className="btn btn-ghost" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={() => { setError(null); setAttempt((n) => n + 1); }}><Icon name="refresh-cw" />Try again</button></>
        ) : done ? (
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        ) : (
          // Closing mid-check is fine: the run finishes and the result shows on the Protection page
          <><button className="btn btn-secondary" onClick={onClose}>Continue in background</button><button className="btn btn-primary" disabled><Icon name="loader-circle" className="spin" />Checking…</button></>
        )}
      </div>
    </Dialog>
  );
}
