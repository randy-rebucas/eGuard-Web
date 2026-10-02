"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import { useAction, useFlow } from "./flow";
import { confirmTwoStepSetup, newRecoveryCodes, startTwoStepSetup, turnOffTwoStep } from "@/app/actions/security";

type Setup = { secret: string; qr: string };

/** Settings › Security: turn two-step verification on (QR, confirm a code, save recovery codes) or off. */
export function TwoStepSettings({ enabled, recoveryCodesLeft }: { enabled: boolean; recoveryCodesLeft: number }) {
  const router = useRouter();
  const [pending, run] = useAction();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<{ list: string[]; intro: string } | null>(null);
  /** Turning off or making new codes: which one is asking for a code */
  const [asking, setAsking] = useState<"off" | "codes" | null>(null);
  const [code, setCode] = useState("");

  const title = <div className="t-title">Two-step verification</div>;

  if (codes) return <RecoveryCodes codes={codes.list} intro={codes.intro} onDone={() => { setCodes(null); router.refresh(); }} />;

  if (setup) {
    return (
      <div className="dash-col" style={{ gap: 12 }}>
        {title}
        <ol className="guide-steps">
          <li>Open an authenticator app on your phone: Google Authenticator, Microsoft Authenticator, 1Password or similar.</li>
          <li>Scan this code, or enter the key by hand.</li>
          <li>Type the 6-digit code the app shows.</li>
        </ol>
        <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          {/* Made on our server from the secret; contains only QR modules */}
          <div className="qr" role="img" aria-label="QR code for your authenticator app" style={{ width: 168, height: 168, background: "#fff", borderRadius: 12, padding: 6 }} dangerouslySetInnerHTML={{ __html: setup.qr }} />
          <div className="dash-col" style={{ gap: 6, minWidth: 200 }}>
            <span className="t-meta">Key</span>
            <code className="num" style={{ wordBreak: "break-all", fontSize: 14 }}>{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
          </div>
        </div>
        <form className="row" style={{ gap: 8, flexWrap: "wrap" }} onSubmit={(e) => {
          e.preventDefault();
          run(() => confirmTwoStepSetup(code), { onOk: (r) => { if ("recoveryCodes" in r && r.recoveryCodes) { setSetup(null); setCode(""); setCodes({ list: r.recoveryCodes, intro: "Two-step verification is on." }); } } });
        }}>
          <label className="sr-only" htmlFor="tf-code">Code from the app</label>
          <input className="input" id="tf-code" style={{ width: 160 }} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} required />
          <button className="btn btn-primary" disabled={pending || code.replace(/\s/g, "").length !== 6}>{pending ? "Checking…" : "Turn on"}</button>
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => { setSetup(null); setCode(""); }}>Cancel</button>
        </form>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10, width: "100%" }}>
        <div className="grow">{title}<div className="t-meta">Off. Turn it on so signing in also needs a code from your phone, even if someone learns your password.</div></div>
        <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(startTwoStepSetup, { onOk: (r) => { if ("qr" in r && r.qr) setSetup({ secret: r.secret, qr: r.qr }); } })}>
          {pending ? <><Icon name="loader-circle" className="spin" />Starting…</> : <><Icon name="shield-check" />Turn on</>}
        </button>
      </div>
    );
  }

  return (
    <div className="dash-col" style={{ gap: 10, width: "100%" }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div className="grow">{title}<div className="t-meta">On with an authenticator app · {recoveryCodesLeft} of 10 recovery codes left{recoveryCodesLeft <= 2 ? ". Make new ones soon." : ""}</div></div>
        <span className="pill tone-ok"><Icon name="shield-check" />On</span>
      </div>
      {asking ? (
        <form className="row" style={{ gap: 8, flexWrap: "wrap" }} onSubmit={(e) => {
          e.preventDefault();
          if (asking === "off") run(() => turnOffTwoStep(code), { ok: "Two-step verification is off.", onOk: () => { setAsking(null); setCode(""); router.refresh(); } });
          else run(() => newRecoveryCodes(code), { onOk: (r) => { if ("recoveryCodes" in r && r.recoveryCodes) { setAsking(null); setCode(""); setCodes({ list: r.recoveryCodes, intro: "New recovery codes are ready, and the old ones stopped working." }); } } });
        }}>
          <label className="sr-only" htmlFor="tf-confirm">Code from your authenticator app, or a recovery code</label>
          <input className="input" id="tf-confirm" style={{ width: 200 }} autoComplete="one-time-code" placeholder="Code from your app" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
          <button className="btn btn-primary btn-sm" style={asking === "off" ? { background: "var(--crit)" } : undefined} disabled={pending || !code.trim()}>
            {pending ? "Checking…" : asking === "off" ? "Turn off" : "Make new codes"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => { setAsking(null); setCode(""); }}>Cancel</button>
        </form>
      ) : (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setAsking("codes")}><Icon name="key-round" />New recovery codes</button>
          <button className="btn btn-ghost btn-sm" style={{ color: "var(--crit-ink)" }} onClick={() => setAsking("off")}>Turn off</button>
        </div>
      )}
    </div>
  );
}

/** Shown once, right after they're made: only their hashes are kept. */
function RecoveryCodes({ codes, intro, onDone }: { codes: string[]; intro: string; onDone: () => void }) {
  const { toast } = useFlow();
  const text = `eGuard recovery codes\nEach code works once, to sign in without your authenticator app.\n\n${codes.join("\n")}\n`;
  const copy = () => navigator.clipboard.writeText(text).then(() => toast("Recovery codes copied.", "ok"), () => toast("Couldn't copy. Select the codes and copy them instead.", "error"));
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = "eguard-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="dash-col" style={{ gap: 12, width: "100%" }} role="status">
      <div className="form-ok"><Icon name="circle-check" />{intro} Save these recovery codes somewhere safe; you won&apos;t see them again.</div>
      <p className="t-meta">If you lose your phone, each code signs you in once. Anyone with them can get past this step, so keep them private.</p>
      <ul className="num" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 6, listStyle: "none", padding: 0, fontSize: 15 }}>
        {codes.map((c) => <li key={c}><code>{c}</code></li>)}
      </ul>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-secondary btn-sm" onClick={copy}><Icon name="copy" />Copy</button>
        <button className="btn btn-secondary btn-sm" onClick={download}><Icon name="download" />Download</button>
        <button className="btn btn-primary btn-sm" onClick={onDone}>I&apos;ve saved them</button>
      </div>
    </div>
  );
}
