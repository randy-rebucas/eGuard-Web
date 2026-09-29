"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBrowserPolicy } from "@/app/actions/family";
import { Icon } from "./icon";

type Unknown = "ALLOW" | "WARN" | "BLOCK";
export type BrowserPolicyValues = {
  version: number;
  safeBrowsing: boolean;
  safeSearch: boolean;
  blockedCategories: string[];
  blockedDomains: string[];
  allowedDomains: string[];
  unknownSitesPolicy: Unknown;
  schedule: { enabled: boolean; startTime: string; endTime: string } | null;
};

const UNKNOWN: { key: Unknown; label: string; text: string }[] = [
  { key: "ALLOW", label: "Allow", text: "Other websites open normally. Blocked categories and sites still apply." },
  { key: "WARN", label: "Warn first", text: "Other websites show a notice first; your child can continue." },
  { key: "BLOCK", label: "Allowed only", text: "Only sites on the allowed list open. Best for young children." },
];

const lines = (list: string[]) => list.join("\n");
const parse = (text: string) => text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);

/** Browser protection editor. The server validates and normalises everything; this only collects it. */
export function BrowserPolicyForm({ childId, childName, initial, categories }: {
  childId: string;
  childName: string;
  initial: BrowserPolicyValues;
  categories: { key: string; label: string; hint: string }[];
}) {
  const id = useId();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [blocked, setBlocked] = useState(lines(initial.blockedDomains));
  const [allowed, setAllowed] = useState(lines(initial.allowedDomains));
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const schedule = v.schedule ?? { enabled: false, startTime: "21:00", endTime: "06:00" };
  const set = (patch: Partial<BrowserPolicyValues>) => { setV({ ...v, ...patch }); setResult(null); };
  const toggleCategory = (k: string) =>
    set({ blockedCategories: v.blockedCategories.includes(k) ? v.blockedCategories.filter((c) => c !== k) : [...v.blockedCategories, k] });

  const save = () => start(async () => {
    const r = await saveBrowserPolicy(childId, {
      safeBrowsing: v.safeBrowsing, safeSearch: v.safeSearch, blockedCategories: v.blockedCategories,
      blockedDomains: parse(blocked), allowedDomains: parse(allowed), unknownSitesPolicy: v.unknownSitesPolicy,
      schedule: v.schedule,
    });
    if (r.error !== undefined) { setResult({ error: r.error }); return; }
    setResult({ ok: r.version === v.version ? "No changes to save." : `Saved. ${childName}'s browsers pick this up within 5 minutes.` });
    setV({ ...v, version: r.version });
    setBlocked(lines(r.blockedDomains));
    setAllowed(lines(r.allowedDomains));
    router.refresh();
  });

  return (
    <form className="dash-col" style={{ gap: 22 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
      <fieldset className="bp-group">
        <legend className="t-title">Blocked categories</legend>
        <p className="t-meta">Sites eGuard knows belong to these categories are blocked. New sites may not be listed yet, so add any you notice below.</p>
        <div className="check-list">
          {categories.map((c) => (
            <label key={c.key} className="check">
              <input type="checkbox" checked={v.blockedCategories.includes(c.key)} onChange={() => toggleCategory(c.key)} />
              <span><span className="t-title" style={{ fontSize: 14 }}>{c.label}</span><span className="t-meta" style={{ display: "block" }}>{c.hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="bp-group">
        <legend className="t-title">Search and safety</legend>
        <div className="check-list">
          <label className="check">
            <input type="checkbox" checked={v.safeSearch} onChange={(e) => set({ safeSearch: e.target.checked })} />
            <span><span className="t-title" style={{ fontSize: 14 }}>SafeSearch</span><span className="t-meta" style={{ display: "block" }}>Filters explicit results on Google, Bing and DuckDuckGo</span></span>
          </label>
          <label className="check">
            <input type="checkbox" checked={v.safeBrowsing} onChange={(e) => set({ safeBrowsing: e.target.checked })} />
            <span><span className="t-title" style={{ fontSize: 14 }}>Browser safety warnings</span><span className="t-meta" style={{ display: "block" }}>Keeps the browser&apos;s own malware and phishing protection on (Chrome does this automatically; Edge and Firefox need a setting)</span></span>
          </label>
        </div>
      </fieldset>

      <div className="bp-lists">
        <div className="field">
          <label htmlFor={`${id}-blocked`}>Blocked sites</label>
          <textarea id={`${id}-blocked`} className="input bp-textarea" value={blocked} spellCheck={false} placeholder={"example.com\nanother-site.com"}
            onChange={(e) => { setBlocked(e.target.value); setResult(null); }} aria-describedby={`${id}-lists-hint`} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-allowed`}>Always allowed</label>
          <textarea id={`${id}-allowed`} className="input bp-textarea" value={allowed} spellCheck={false} placeholder={"school.edu\nkhanacademy.org"}
            onChange={(e) => { setAllowed(e.target.value); setResult(null); }} aria-describedby={`${id}-lists-hint`} />
        </div>
        <p id={`${id}-lists-hint`} className="t-meta" style={{ gridColumn: "1 / -1" }}>One site per line. A site includes its subdomains: youtube.com also covers m.youtube.com. Allowed sites open even inside a blocked category.</p>
      </div>

      <fieldset className="bp-group">
        <legend className="t-title">Other websites</legend>
        <div className="seg" role="group" aria-label="Other websites">
          {UNKNOWN.map((u) => (
            <button key={u.key} type="button" aria-pressed={v.unknownSitesPolicy === u.key} onClick={() => set({ unknownSitesPolicy: u.key })}>{u.label}</button>
          ))}
        </div>
        <p className="t-meta">{UNKNOWN.find((u) => u.key === v.unknownSitesPolicy)?.text}</p>
      </fieldset>

      <fieldset className="bp-group">
        <legend className="t-title">Focus hours</legend>
        <label className="check" style={{ maxWidth: 520 }}>
          <input type="checkbox" checked={schedule.enabled} onChange={(e) => set({ schedule: { ...schedule, enabled: e.target.checked } })} />
          <span><span className="t-title" style={{ fontSize: 14 }}>Only allowed sites during set hours</span><span className="t-meta" style={{ display: "block" }}>For homework or bedtime, in your family&apos;s time zone</span></span>
        </label>
        {schedule.enabled ? (
          <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="field"><label htmlFor={`${id}-from`}>From</label><input id={`${id}-from`} className="input" type="time" value={schedule.startTime} onChange={(e) => set({ schedule: { ...schedule, startTime: e.target.value } })} /></div>
            <div className="field"><label htmlFor={`${id}-to`}>Until</label><input id={`${id}-to`} className="input" type="time" value={schedule.endTime} onChange={(e) => set({ schedule: { ...schedule, endTime: e.target.value } })} /></div>
          </div>
        ) : null}
      </fieldset>

      {result?.error ? <div className="form-error" role="alert"><Icon name="triangle-alert" />{result.error}</div> : null}
      {result?.ok ? <div className="form-ok" role="status"><Icon name="circle-check" />{result.ok}</div> : null}
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <span className="t-meta num">Version {v.version}</span>
        <button className="btn btn-primary" disabled={pending}>{pending ? <><Icon name="loader-circle" className="spin" />Saving…</> : "Save browser protection"}</button>
      </div>
    </form>
  );
}
