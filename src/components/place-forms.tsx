"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Icon } from "./icon";
import { useFlow } from "./flow";
import { createPlace, deletePlace, updatePlace } from "@/app/actions/places";
import { DEFAULT_RADIUS_M, PLACE_RADII } from "@/lib/place-radii";

function PlaceFields({ name, radius, onName, onRadius, idp }: { name: string; radius: number; onName: (s: string) => void; onRadius: (n: number) => void; idp: string }) {
  return (
    <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="field grow" style={{ minWidth: 160 }}>
        <label htmlFor={`${idp}-name`}>Place name</label>
        <input id={`${idp}-name`} className="input" value={name} maxLength={40} placeholder="Home, School…" autoFocus onChange={(e) => onName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${idp}-radius`}>Counts within</label>
        <select id={`${idp}-radius`} className="input" value={radius} onChange={(e) => onRadius(Number(e.target.value))}>
          {PLACE_RADII.map((r) => <option key={r} value={r}>{r < 1000 ? `${r} m` : "1 km"}</option>)}
        </select>
      </div>
    </div>
  );
}

/** "Name this place": saves a spot a child was at (their current location or a visit) as a named place. */
export function NamePlaceButton({ lat, lng, label = "Name this place" }: { lat: number; lng: number; label?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [radius, setRadius] = useState<number>(DEFAULT_RADIUS_M);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { toast } = useFlow();
  const router = useRouter();
  const idp = useId();
  if (!open) return <button type="button" className="link-btn" onClick={() => setOpen(true)}><Icon name="map-pin" size={14} />{label}</button>;
  const save = () => start(async () => {
    const r = await createPlace({ name, lat, lng, radiusM: radius });
    if (r.error) { setError(r.error); return; }
    toast(`Saved ${name.trim()}. Visits there now show its name.`);
    setOpen(false); setName(""); setError(null);
    router.refresh();
  });
  return (
    <form className="dash-col" style={{ gap: 8, marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
      <PlaceFields idp={idp} name={name} radius={radius} onName={setName} onRadius={setRadius} />
      {error ? <div className="form-error" role="alert"><Icon name="triangle-alert" />{error}</div> : null}
      <div className="row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={pending || !name.trim()}>{pending ? "Saving…" : "Save place"}</button>
      </div>
    </form>
  );
}

/** "Alerts when someone arrives and leaves" / "… arrives" / "… leaves", or nothing with notices off */
const noticeText = (p: { notifyArrive: boolean; notifyLeave: boolean }) =>
  p.notifyArrive || p.notifyLeave ? `Alerts when someone ${[p.notifyArrive ? "arrives" : null, p.notifyLeave ? "leaves" : null].filter(Boolean).join(" and ")}` : null;

/** One saved place in the list: rename, change its radius or its arrive / leave alerts, or remove it. */
export function PlaceRow({ place }: { place: { id: string; name: string; radiusM: number; notifyArrive: boolean; notifyLeave: boolean } }) {
  const [mode, setMode] = useState<"view" | "edit" | "remove">("view");
  const [name, setName] = useState(place.name);
  const [radius, setRadius] = useState(place.radiusM);
  const [arrive, setArrive] = useState(place.notifyArrive);
  const [leave, setLeave] = useState(place.notifyLeave);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { toast } = useFlow();
  const router = useRouter();
  const idp = useId();
  const close = () => { setMode("view"); setError(null); setName(place.name); setRadius(place.radiusM); setArrive(place.notifyArrive); setLeave(place.notifyLeave); };
  const run = (fn: () => Promise<{ error?: string }>, done: string) => start(async () => {
    const r = await fn();
    if (r.error) { setError(r.error); return; }
    toast(done);
    setMode("view"); setError(null);
    router.refresh();
  });

  return (
    <div className="setting-row" style={{ flexWrap: "wrap" }}>
      <span className="ico-tile"><Icon name={/home/i.test(place.name) ? "house" : /school/i.test(place.name) ? "school" : "map-pin"} /></span>
      <div className="grow">
        <div className="t-title">{place.name}</div>
        <div className="t-meta">Within {place.radiusM < 1000 ? `${place.radiusM} m` : "1 km"}{noticeText(place) ? ` · ${noticeText(place)}` : ""}</div>
      </div>
      {mode === "view" ? (
        <div className="row" style={{ gap: 4 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode("edit")} aria-label={`Edit ${place.name}`}><Icon name="pencil" />Edit</button>
          <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--crit-ink)" }} onClick={() => setMode("remove")} aria-label={`Remove ${place.name}`}><Icon name="trash" />Remove</button>
        </div>
      ) : null}
      {mode === "edit" ? (
        <form className="dash-col" style={{ gap: 8, flexBasis: "100%" }} onSubmit={(e) => { e.preventDefault(); run(() => updatePlace(place.id, { name, radiusM: radius, notifyArrive: arrive, notifyLeave: leave }), `Saved ${name.trim()}.`); }}>
          <PlaceFields idp={idp} name={name} radius={radius} onName={setName} onRadius={setRadius} />
          <fieldset className="check-list" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="t-meta" style={{ marginBottom: 4 }}>Alert me (email and push, as set in Notifications)</legend>
            <label className="check">
              <input type="checkbox" checked={arrive} onChange={(e) => setArrive(e.target.checked)} />
              <span className="t-title" style={{ fontSize: 14 }}>When a child arrives at {name.trim() || "this place"}</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={leave} onChange={(e) => setLeave(e.target.checked)} />
              <span className="t-title" style={{ fontSize: 14 }}>When a child leaves {name.trim() || "this place"}</span>
            </label>
          </fieldset>
          {error ? <div className="form-error" role="alert"><Icon name="triangle-alert" />{error}</div> : null}
          <div className="row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={close}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={pending || !name.trim()}>{pending ? "Saving…" : "Save"}</button>
          </div>
        </form>
      ) : null}
      {mode === "remove" ? (
        <div className="dash-col" style={{ gap: 8, flexBasis: "100%" }}>
          <p className="t-meta" style={{ color: "var(--ink-2)" }}>Visits at {place.name} lose its name (another saved place that covers them names them instead). Nothing else is deleted.</p>
          {error ? <div className="form-error" role="alert"><Icon name="triangle-alert" />{error}</div> : null}
          <div className="row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={close}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" style={{ background: "var(--crit)" }} disabled={pending} onClick={() => run(() => deletePlace(place.id), `Removed ${place.name}.`)}>{pending ? "Removing…" : `Remove ${place.name}`}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
