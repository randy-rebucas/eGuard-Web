"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Icon } from "./icon";
import { useFlow } from "./flow";
import type { MapPlace } from "./family-map";
import { createPlace, deletePlace, updatePlace } from "@/app/actions/places";
import { DEFAULT_RADIUS_M, PLACE_RADII, parseLatLng } from "@/lib/place-radii";

const PlacePicker = dynamic(() => import("./place-picker"), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ position: "absolute", inset: 0, borderRadius: 0 }} />,
});

/** Arrive / leave alert switches for a place (new or saved) */
function NoticeFields({ name, arrive, leave, onArrive, onLeave }: { name: string; arrive: boolean; leave: boolean; onArrive: (b: boolean) => void; onLeave: (b: boolean) => void }) {
  return (
    <fieldset className="check-list" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="t-meta" style={{ marginBottom: 4 }}>Alert me (email and push, as set in Notifications)</legend>
      <label className="check">
        <input type="checkbox" checked={arrive} onChange={(e) => onArrive(e.target.checked)} />
        <span className="t-title" style={{ fontSize: 14 }}>When a child arrives at {name.trim() || "this place"}</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={leave} onChange={(e) => onLeave(e.target.checked)} />
        <span className="t-title" style={{ fontSize: 14 }}>When a child leaves {name.trim() || "this place"}</span>
      </label>
    </fieldset>
  );
}

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

/**
 * "Add a place" anywhere, before a child has been there (School before the first day): tap the map, or type or
 * paste its coordinates for keyboard use. The browser's own location isn't offered (Permissions-Policy blocks it).
 */
export function AddPlaceButton({ places, center, attribution }: { places: MapPlace[]; center: { lat: number; lng: number } | null; attribution: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [radius, setRadius] = useState<number>(DEFAULT_RADIUS_M);
  const [at, setAt] = useState<{ lat: number; lng: number } | null>(null);
  const [coords, setCoords] = useState("");
  const [arrive, setArrive] = useState(false);
  const [leave, setLeave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { toast } = useFlow();
  const router = useRouter();
  const idp = useId();
  const reset = () => { setOpen(false); setName(""); setRadius(DEFAULT_RADIUS_M); setAt(null); setCoords(""); setArrive(false); setLeave(false); setError(null); };
  if (!open) return <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}><Icon name="plus" />Add a place</button>;
  const pick = (p: { lat: number; lng: number }) => { setAt(p); setCoords(`${p.lat}, ${p.lng}`); setError(null); };
  const typed = (s: string) => { setCoords(s); setAt(parseLatLng(s)); };
  const save = () => start(async () => {
    if (!at) { setError(coords.trim() ? "Those coordinates aren't valid. Use latitude, longitude, e.g. 14.6507, 121.0494." : "Tap the map where the place is."); return; }
    const r = await createPlace({ name, lat: at.lat, lng: at.lng, radiusM: radius, notifyArrive: arrive, notifyLeave: leave });
    if (r.error) { setError(r.error); return; }
    toast(`Saved ${name.trim()}.`);
    reset();
    router.refresh();
  });
  return (
    <form className="dash-col" style={{ gap: 8, marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
      <PlaceFields idp={idp} name={name} radius={radius} onName={setName} onRadius={setRadius} />
      <div style={{ position: "relative", height: 260, borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)" }}>
        <PlacePicker value={at} radiusM={radius} onPick={pick} places={places} center={center} attribution={attribution} />
      </div>
      <div className="field">
        <label htmlFor={`${idp}-coords`}>Where it is</label>
        <input id={`${idp}-coords`} className="input" value={coords} inputMode="decimal" placeholder="Tap the map, or paste e.g. 14.6507, 121.0494" aria-describedby={`${idp}-coords-hint`} onChange={(e) => typed(e.target.value)} />
        <div id={`${idp}-coords-hint`} className="t-meta">{at ? `Within ${radius < 1000 ? `${radius} m` : "1 km"} of the circle's centre counts as ${name.trim() || "this place"}.` : "Latitude, longitude, as a maps app copies them."}</div>
      </div>
      <NoticeFields name={name} arrive={arrive} leave={leave} onArrive={setArrive} onLeave={setLeave} />
      {error ? <div className="form-error" role="alert"><Icon name="triangle-alert" />{error}</div> : null}
      <div className="row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={pending || !name.trim()}>{pending ? "Saving…" : "Save place"}</button>
      </div>
    </form>
  );
}

/** "Alerts when someone arrives and leaves" / "… arrives" / "… leaves", or nothing with notices off */
const noticeText = (p: { notifyArrive: boolean; notifyLeave: boolean }) =>
  p.notifyArrive || p.notifyLeave ? `Alerts when someone ${[p.notifyArrive ? "arrives" : null, p.notifyLeave ? "leaves" : null].filter(Boolean).join(" and ")}` : null;

type Place = { id: string; name: string; radiusM: number; notifyArrive: boolean; notifyLeave: boolean };

/**
 * One saved place in the list: rename, change its radius or its arrive / leave alerts, or remove it.
 * `removeOnly`: on a plan without location sharing, places can only be removed.
 */
export function PlaceRow({ place, removeOnly = false }: { place: Place; removeOnly?: boolean }) {
  const [mode, setMode] = useState<"view" | "edit" | "remove">("view");
  // What the form started from: only fields changed since are saved, so a change another parent made in the
  // meantime isn't undone
  const [base, setBase] = useState(place);
  const [name, setName] = useState(place.name);
  const [radius, setRadius] = useState(place.radiusM);
  const [arrive, setArrive] = useState(place.notifyArrive);
  const [leave, setLeave] = useState(place.notifyLeave);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { toast } = useFlow();
  const router = useRouter();
  const idp = useId();
  const close = () => { setMode("view"); setError(null); };
  // Starts from the place as it is now (the page refreshes), not as it was when the page first loaded
  const edit = () => { setBase(place); setName(place.name); setRadius(place.radiusM); setArrive(place.notifyArrive); setLeave(place.notifyLeave); setError(null); setMode("edit"); };
  const run = (fn: () => Promise<{ error?: string }>, done: string) => start(async () => {
    const r = await fn();
    if (r.error) { setError(r.error); return; }
    toast(done);
    setMode("view"); setError(null);
    router.refresh();
  });
  const save = () => {
    const changes = {
      ...(name.trim() !== base.name ? { name } : {}),
      ...(radius !== base.radiusM ? { radiusM: radius } : {}),
      ...(arrive !== base.notifyArrive ? { notifyArrive: arrive } : {}),
      ...(leave !== base.notifyLeave ? { notifyLeave: leave } : {}),
    };
    if (!Object.keys(changes).length) { close(); return; }
    run(() => updatePlace(place.id, changes), `Saved ${name.trim()}.`);
  };

  return (
    <div className="setting-row" style={{ flexWrap: "wrap" }}>
      <span className="ico-tile"><Icon name={/home/i.test(place.name) ? "house" : /school/i.test(place.name) ? "school" : "map-pin"} /></span>
      <div className="grow">
        <div className="t-title">{place.name}</div>
        <div className="t-meta">Within {place.radiusM < 1000 ? `${place.radiusM} m` : "1 km"}{noticeText(place) ? ` · ${noticeText(place)}` : ""}</div>
      </div>
      {mode === "view" ? (
        <div className="row" style={{ gap: 4 }}>
          {removeOnly ? null : <button type="button" className="btn btn-ghost btn-sm" onClick={edit} aria-label={`Edit ${place.name}`}><Icon name="pencil" />Edit</button>}
          <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--crit-ink)" }} onClick={() => { setError(null); setMode("remove"); }} aria-label={`Remove ${place.name}`}><Icon name="trash" />Remove</button>
        </div>
      ) : null}
      {mode === "edit" ? (
        <form className="dash-col" style={{ gap: 8, flexBasis: "100%" }} onSubmit={(e) => { e.preventDefault(); save(); }}>
          <PlaceFields idp={idp} name={name} radius={radius} onName={setName} onRadius={setRadius} />
          <NoticeFields name={name} arrive={arrive} leave={leave} onArrive={setArrive} onLeave={setLeave} />
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
