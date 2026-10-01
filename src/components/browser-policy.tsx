"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideAccessRequest, saveBrowserPolicy } from "@/app/actions/family";
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
/** One site per line (commas also work). Not spaces, so "not a site" is reported as typed. */
const parse = (text: string) => text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);

/** Browser protection editor. The server validates and normalises everything; this only collects it. */
export function BrowserPolicyForm({ childId, childName, initial, categories }: {
  childId: string;
  childName: string;
  initial: BrowserPolicyValues;
  categories: { key: string; label: string; hint: string; note: string; count: number }[];
}) {
  const id = useId();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [blocked, setBlocked] = useState(lines(initial.blockedDomains));
  const [allowed, setAllowed] = useState(lines(initial.allowedDomains));
  const [result, setResult] = useState<{ ok?: string; error?: string; stale?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [seen, setSeen] = useState(initial.version);
  const load = (p: BrowserPolicyValues) => { setV(p); setBlocked(lines(p.blockedDomains)); setAllowed(lines(p.allowedDomains)); setDirty(false); };
  // A newer version arrived (an approved access request, another parent): take it unless the parent is mid-edit
  if (initial.version !== seen) {
    setSeen(initial.version);
    if (!dirty && initial.version > v.version) load(initial);
  }
  const schedule = v.schedule ?? { enabled: false, startTime: "21:00", endTime: "06:00" };
  const set = (patch: Partial<BrowserPolicyValues>) => { setV({ ...v, ...patch }); setResult(null); setDirty(true); };
  const toggleCategory = (k: string) =>
    set({ blockedCategories: v.blockedCategories.includes(k) ? v.blockedCategories.filter((c) => c !== k) : [...v.blockedCategories, k] });

  const save = () => start(async () => {
    const r = await saveBrowserPolicy(childId, {
      safeBrowsing: v.safeBrowsing, safeSearch: v.safeSearch, blockedCategories: v.blockedCategories,
      blockedDomains: parse(blocked), allowedDomains: parse(allowed), unknownSitesPolicy: v.unknownSitesPolicy,
      schedule: v.schedule,
    }, v.version);
    if (r.error !== undefined) { setResult({ error: r.error, stale: r.code === "stale_version" || r.code === "conflict" }); return; }
    setResult({ ok: r.version === v.version ? "No changes to save." : `Saved. ${childName}'s browsers pick this up within 5 minutes.` });
    setV({ ...v, version: r.version });
    setBlocked(lines(r.blockedDomains));
    setAllowed(lines(r.allowedDomains));
    setDirty(false);
    router.refresh();
  });

  return (
    <form className="dash-col" style={{ gap: 22 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
      <fieldset className="bp-group">
        <legend className="t-title">Blocked categories</legend>
        <p className="t-meta">eGuard blocks the sites on each category&apos;s list. The lists are a starting point, not complete: add any other sites you want blocked below.</p>
        <div className="check-list">
          {categories.map((c) => (
            <label key={c.key} className="check">
              <input type="checkbox" checked={v.blockedCategories.includes(c.key)} onChange={() => toggleCategory(c.key)} />
              <span><span className="t-title" style={{ fontSize: 14 }}>{c.label}</span><span className="t-meta" style={{ display: "block" }}>{c.hint}</span>
                <span className={`bp-note ${c.count ? "" : "bp-note-muted"}`}>{c.note}</span></span>
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
            onChange={(e) => { setBlocked(e.target.value); setResult(null); setDirty(true); }} aria-describedby={`${id}-lists-hint`} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-allowed`}>Always allowed</label>
          <textarea id={`${id}-allowed`} className="input bp-textarea" value={allowed} spellCheck={false} placeholder={"school.edu\nkhanacademy.org"}
            onChange={(e) => { setAllowed(e.target.value); setResult(null); setDirty(true); }} aria-describedby={`${id}-lists-hint`} />
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
        {v.unknownSitesPolicy === "BLOCK" && !parse(allowed).length
          ? <p className="form-error" role="status"><Icon name="triangle-alert" />The allowed list is empty, so every website will be blocked. Add the sites {childName} needs above.</p> : null}
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

      {result?.error ? (
        <div className="form-error" role="alert">
          <Icon name="triangle-alert" /><span className="grow">{result.error}</span>
          {result.stale ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setResult(null); router.refresh(); load(initial); }}>Load latest settings</button> : null}
        </div>
      ) : null}
      {result?.ok ? <div className="form-ok" role="status"><Icon name="circle-check" />{result.ok}</div> : null}
      {dirty && initial.version > v.version && !result ? (
        <p className="t-meta" role="status">These settings were changed elsewhere while you were editing (version {initial.version}). Saving now would be refused; load the latest first.</p>
      ) : null}
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <span className="t-meta num">Version {v.version}{dirty ? " · unsaved changes" : ""}</span>
        <button className="btn btn-primary" disabled={pending}>{pending ? <><Icon name="loader-circle" className="spin" />Saving…</> : "Save browser protection"}</button>
      </div>
    </form>
  );
}

export type AccessRequestView = { id: string; domain: string; reason: string | null; status: string; duration: string | null; createdAt: string; decidedAt: string | null; decidedBy: string | null; expiresAt: string | null };

const DURATIONS: { key: string; label: string }[] = [
  { key: "15M", label: "15 minutes" },
  { key: "1H", label: "1 hour" },
  { key: "TODAY", label: "Rest of today" },
  { key: "ALWAYS", label: "Always" },
];

/** A child's open request to open a blocked site: approve for a while, always, or decline. */
export function AccessRequestRow({ r, childName, when }: { r: AccessRequestView; childName: string; when: string }) {
  const router = useRouter();
  const [duration, setDuration] = useState("1H");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = useId();
  const decide = (decision: "APPROVE" | "DENY") => start(async () => {
    const res = await decideAccessRequest(r.id, decision === "APPROVE" ? { decision, duration } : { decision });
    if (res.error !== undefined) { setError(res.error); return; }
    router.refresh();
  });
  return (
    <li className="bp-request">
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="t-title" style={{ overflowWrap: "anywhere" }}>{r.domain}</div>
        <div className="t-meta">{childName} asked {when}{r.reason ? <> · &ldquo;{r.reason}&rdquo;</> : null}</div>
        {error ? <div className="form-error" role="alert" style={{ marginTop: 8 }}><Icon name="triangle-alert" />{error}</div> : null}
      </div>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <label className="sr-only" htmlFor={`${id}-dur`}>Allow for</label>
        <select id={`${id}-dur`} className="input" style={{ height: 36, width: "auto" }} value={duration} onChange={(e) => setDuration(e.target.value)} disabled={pending}>
          {DURATIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
        <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => decide("APPROVE")}>Allow</button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => decide("DENY")}>Decline</button>
      </div>
    </li>
  );
}
