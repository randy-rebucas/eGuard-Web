"use client";

/** Parent care on the web: Settings › Notifications › Tips and reminders, and the Safety plan's buttons. */

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import { useAction } from "./flow";
import { activityAction, messageAction, saveCarePreferences, type ActivityAction } from "@/app/actions/care";

export type CarePrefsView = {
  enabled: boolean; inApp: boolean; push: boolean; email: boolean;
  briefings: boolean; followUps: boolean; weeklyPlan: boolean; checkIns: boolean; monthlyReport: boolean;
  briefingDays: number[]; deliveryTime: string; quietStart: string; quietEnd: string;
  language: string; timezone: string | null; effectiveTimezone: string;
  channels: { push: boolean; email: boolean; inApp: boolean };
  languages: { code: string; name: string }[];
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const subscribe = (cb: () => void) => { window.addEventListener("online", cb); window.addEventListener("offline", cb); return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); }; };
/** False while the browser says it's offline; the server render assumes online. */
const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

function Toggle({ id, title, desc, checked, disabled, onChange }: { id: string; title: string; desc: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="setting-row">
      <div className="grow"><div className="t-title" id={id}>{title}</div><div className="t-meta">{desc}</div></div>
      <button type="button" className="switch" role="switch" aria-checked={checked} aria-labelledby={id} disabled={disabled} onClick={() => onChange(!checked)} />
    </div>
  );
}

/**
 * The parent's choices for optional tips, plans and check-ins. Saved together with one button, so a half-chosen
 * schedule never goes live. Switching push or email on is the parent's consent for that channel, and says so.
 */
export function CareSettings({ initial, zones }: { initial: CarePrefsView; zones: string[] }) {
  const [p, setP] = useState(initial);
  const [saved, setSaved] = useState(initial);
  if (saved !== initial) { setSaved(initial); setP(initial); }
  const [pending, run] = useAction();
  const online = useOnline();
  const set = <K extends keyof CarePrefsView>(k: K, v: CarePrefsView[K]) => setP((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(p) !== JSON.stringify(initial);
  const off = !p.enabled;
  const save = () => run(() => saveCarePreferences({
    enabled: p.enabled, inApp: p.inApp, push: p.push, email: p.email,
    briefings: p.briefings, followUps: p.followUps, weeklyPlan: p.weeklyPlan, checkIns: p.checkIns, monthlyReport: p.monthlyReport,
    briefingDays: p.briefingDays, deliveryTime: p.deliveryTime, quietStart: p.quietStart, quietEnd: p.quietEnd, language: p.language as "en" | "fil", timezone: p.timezone,
  }), { ok: "Saved." });
  const toggleDay = (d: number) => set("briefingDays", p.briefingDays.includes(d) ? p.briefingDays.filter((x) => x !== d) : [...p.briefingDays, d].sort());
  const tzName = p.effectiveTimezone.replace(/_/g, " ");

  return (
    <div className="care-settings">
      <Toggle id="care-enabled" title="Tips and reminders from eGuard" checked={p.enabled} onChange={(v) => set("enabled", v)}
        desc="Optional: practical safety tips, a short weekly plan, a reminder about an activity you started, and a monthly summary. Safety alerts never depend on this." />

      <fieldset className="care-group" disabled={off}>
        <legend className="t-title">How they reach you</legend>
        <Toggle id="care-inapp" title="In eGuard" checked={p.inApp} disabled={off} onChange={(v) => set("inApp", v)} desc="On your Safety plan page and in the app. Nothing pops up." />
        <Toggle id="care-push" title="Push notifications" checked={p.push} disabled={off || (!p.channels.push && !p.push)} onChange={(v) => set("push", v)}
          desc={p.channels.push ? "On phones signed in to the eGuard app. Turning this on is your consent to receive them; you can turn it off any time."
            : "Needs the eGuard app on your phone, signed in, with Push notifications on above."} />
        <Toggle id="care-email" title="Email" checked={p.email} disabled={off || (!p.channels.email && !p.email)} onChange={(v) => set("email", v)}
          desc={p.channels.email ? "Turning this on is your consent to receive these emails; every one has a link to stop them." : "Verify your email address first."} />
        <p className="t-meta">eGuard sends at most one push or email a day, and three a week, across all of these. Each message goes one way only, never twice.</p>
      </fieldset>

      <fieldset className="care-group" disabled={off}>
        <legend className="t-title">What you get</legend>
        <Toggle id="care-briefings" title="Family safety tips" checked={p.briefings} disabled={off} onChange={(v) => set("briefings", v)} desc="One practical tip and one thing to try, from eGuard's parent guides." />
        {p.briefings && !off ? (
          <div className="care-days" role="group" aria-label="Days for tips">
            {DAYS.map((d, i) => (
              <button key={d} type="button" className="care-day" aria-pressed={p.briefingDays.includes(i)} aria-label={DAY_NAMES[i]} onClick={() => toggleDay(i)}>{d}</button>
            ))}
            <span className="t-meta">{p.briefingDays.length ? `${p.briefingDays.length} a week` : "No days chosen: no tips"}</span>
          </div>
        ) : null}
        <Toggle id="care-plan" title="Weekly safety plan" checked={p.weeklyPlan} disabled={off} onChange={(v) => set("weeklyPlan", v)} desc="Every Monday: one or two short activities that fit your children's ages." />
        <Toggle id="care-follow" title="Activity reminders" checked={p.followUps} disabled={off} onChange={(v) => set("followUps", v)} desc="One reminder about a day after you start an activity, if it isn't done yet." />
        <Toggle id="care-checkins" title="Check-ins when you've been away" checked={p.checkIns} disabled={off} onChange={(v) => set("checkIns", v)} desc="If you haven't used eGuard for a week or more, up to three helpful messages, a week apart. They stop as soon as you're back." />
        <Toggle id="care-report" title="Monthly summary" checked={p.monthlyReport} disabled={off} onChange={(v) => set("monthlyReport", v)} desc="On the 1st: what you did last month, from your own activity in eGuard." />
      </fieldset>

      <fieldset className="care-group" disabled={off}>
        <legend className="t-title">When</legend>
        <div className="form-grid">
          <div className="field"><label htmlFor="care-time">Send at</label><input id="care-time" className="input" type="time" value={p.deliveryTime} onChange={(e) => set("deliveryTime", e.target.value)} required /></div>
          <div className="field"><label htmlFor="care-quiet-start">Quiet from</label><input id="care-quiet-start" className="input" type="time" value={p.quietStart} onChange={(e) => set("quietStart", e.target.value)} required /></div>
          <div className="field"><label htmlFor="care-quiet-end">Quiet until</label><input id="care-quiet-end" className="input" type="time" value={p.quietEnd} onChange={(e) => set("quietEnd", e.target.value)} required /></div>
          <div className="field">
            <label htmlFor="care-tz">Time zone</label>
            <select id="care-tz" className="input" value={p.timezone ?? ""} onChange={(e) => set("timezone", e.target.value || null)}>
              <option value="">Family time zone</option>
              {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="care-lang">Language</label>
            <select id="care-lang" className="input" value={p.language} onChange={(e) => set("language", e.target.value)}>
              {p.languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
            {p.language !== "en" ? <span className="field-hint">Filipino messages are being reviewed. Until then they arrive in English.</span> : null}
          </div>
        </div>
        <p className="t-meta">Times are in {tzName} time. Push and email wait until quiet hours end; nothing is sent during them.</p>
      </fieldset>

      <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 8 }}>
        <button type="button" className="btn btn-primary" disabled={!dirty || pending || !online} onClick={save}>{pending ? "Saving…" : "Save"}</button>
        {dirty && !pending ? <button type="button" className="btn btn-ghost" onClick={() => setP(initial)}>Undo changes</button> : null}
        {!online ? <span className="t-meta" role="status">You&apos;re offline. Your changes are kept here; save once you&apos;re back online.</span> : null}
      </div>
    </div>
  );
}

const DONE_TOAST: Record<ActivityAction, string> = {
  start: "Started. Your progress is saved.", complete: "Nice work. Marked as done.", dismiss: "Hidden from your suggestions.", restore: "Back in your suggestions.",
};

/** Start, finish, "not for us" and undo, for one activity. */
export function ActivityButtons({ activityKey, status, due, compact }: { activityKey: string; status: string; due: boolean; compact?: boolean }) {
  const [pending, run] = useAction();
  const online = useOnline();
  const act = (a: ActivityAction) => run(() => activityAction(activityKey, a), { ok: DONE_TOAST[a] });
  const sm = compact ? " btn-sm" : "";
  if (status === "DISMISSED") return <button type="button" className={`btn btn-ghost${sm}`} disabled={pending || !online} onClick={() => act("restore")}>Show it again</button>;
  if (status === "COMPLETED" && !due) return <span className="pill tone-ok"><Icon name="check" />Done</span>;
  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      {status === "STARTED"
        ? <button type="button" className={`btn btn-primary${sm}`} disabled={pending || !online} onClick={() => act("complete")}><Icon name="check" />Mark as done</button>
        : <button type="button" className={`btn btn-primary${sm}`} disabled={pending || !online} onClick={() => act("start")}>{status === "COMPLETED" ? "Do it again" : "Start"}</button>}
      {status === "STARTED" ? null : <button type="button" className={`btn btn-secondary${sm}`} disabled={pending || !online} onClick={() => act("complete")}>Already done</button>}
      {compact ? null : <button type="button" className={`btn btn-ghost${sm}`} disabled={pending || !online} onClick={() => act("dismiss")}>Not for us</button>}
    </div>
  );
}

export type CareMessageView = { id: string; title: string; body: string; cta: string; link: string; sentAt: string; when: string; channel: string; unread: boolean };

/** Messages from eGuard on the Safety plan: opening one records the tap, dismissing hides it. */
export function CareMessages({ messages }: { messages: CareMessageView[] }) {
  const router = useRouter();
  const [pending, run] = useAction();
  const [hidden, setHidden] = useState<string[]>([]);
  const shown = messages.filter((m) => !hidden.includes(m.id));
  if (!shown.length) return <p className="t-meta">Nothing yet. Tips, your weekly plan and reminders show up here.</p>;
  return (
    <ul className="care-messages">
      {shown.map((m) => (
        <li key={m.id} className={`care-message${m.unread ? " unread" : ""}`}>
          <span className="ico-tile"><Icon name={m.channel === "EMAIL" ? "mail" : m.channel === "PUSH" ? "bell" : "inbox"} /></span>
          <div className="grow">
            <div className="t-title">{m.title}{m.unread ? <span className="sr-only"> (new)</span> : null}</div>
            <p className="t-meta" style={{ margin: "2px 0 8px" }}>{m.body}</p>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="link-btn" disabled={pending} onClick={() => run(() => messageAction(m.id, "click"), { onOk: (r) => { if ("link" in r) router.push(r.link); } })}>{m.cta} <Icon name="arrow-right" /></button>
              <span className="t-meta">{m.when}</span>
            </div>
          </div>
          <button type="button" className="icon-btn" aria-label={`Dismiss "${m.title}"`} disabled={pending}
            onClick={() => { setHidden((h) => [...h, m.id]); run(() => messageAction(m.id, "dismiss"), { onError: () => setHidden((h) => h.filter((x) => x !== m.id)) }); }}>
            <Icon name="x" />
          </button>
        </li>
      ))}
    </ul>
  );
}
