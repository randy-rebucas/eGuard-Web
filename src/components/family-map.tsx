"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";

export type MapPerson = {
  id: string; name: string; hue: number; lat: number; lng: number; label: string;
  /** The child's photo URL (childPhotoSrc), or null for their initial */
  photo: string | null;
  /** "2 min ago", shown on the pin so an old position never passes for a live one */
  age: string;
  /** older than a few minutes, or from a device that stopped syncing */
  stale: boolean;
  /** metres; drawn as a circle so a rough fix doesn't look like a street address */
  accuracyM: number | null;
};

/** A place the parents named, drawn as a dashed circle so they can see what counts as "Home" */
export type MapPlace = { id: string; name: string; lat: number; lng: number; radiusM: number };

const OSM_CREDIT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** With nobody to show, a neutral world view (not any one family's city). */
const WORLD: [number, number] = [20, 0];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Minimal Leaflet map with avatar pins. Loaded client-side only. The map is created once; new data only
 * redraws the pins, so an auto-refresh keeps the parent's zoom and position.
 */
/**
 * `attribution`: the tile provider's credit (HTML, from the server's map-tiles config, never user input).
 */
export default function FamilyMap({ people, missing = [], places = [], attribution = OSM_CREDIT }: { people: MapPerson[]; missing?: string[]; places?: MapPlace[]; attribution?: string }) {
  const host = useRef<HTMLDivElement>(null);
  // Server config, fixed for the page's life: read once when the map is created, so it isn't rebuilt
  const credit = useRef(attribution);
  const map = useRef<{ L: typeof import("leaflet"); map: LeafletMap; pins: LayerGroup; framed: string } | null>(null);
  // Redraw only when what's shown changes, not on every re-render with an equal array
  const data = JSON.stringify({ people, places });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !host.current) return;
      const m = L.map(host.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(WORLD, 2);
      // Through our server (api/tiles), so the tile provider never learns which parent looks where
      L.tileLayer("/api/tiles/{z}/{x}/{y}", { maxZoom: 18, attribution: credit.current }).addTo(m);
      map.current = { L, map: m, pins: L.layerGroup().addTo(m), framed: "" };
      host.current.dispatchEvent(new Event("eg-map-ready"));
    })();
    return () => { cancelled = true; map.current?.map.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const draw = () => {
      const s = map.current;
      if (!s) return;
      const { people: list, places: saved } = JSON.parse(data) as { people: MapPerson[]; places: MapPlace[] };
      s.pins.clearLayers();
      for (const p of saved) {
        s.L.circle([p.lat, p.lng], { radius: p.radiusM, className: "map-place", weight: 1.5, dashArray: "4 4", fillOpacity: 0.06 })
          .bindTooltip(esc(p.name), { direction: "top" }).addTo(s.pins);
      }
      for (const p of list) {
        if (p.accuracyM && p.accuracyM > 0) {
          s.L.circle([p.lat, p.lng], { radius: p.accuracyM, color: `hsl(${p.hue} 70% 45%)`, weight: 1, fillOpacity: 0.08, interactive: false }).addTo(s.pins);
        }
        s.L.marker([p.lat, p.lng], {
          title: `${p.name}, ${p.label}, ${p.age}`,
          icon: s.L.divIcon({
            className: "",
            iconSize: [0, 0],
            html: `<div class="map-pin${p.stale ? " stale" : ""}"><span class="avatar" style="--h:${Number(p.hue)}">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : esc(p.name[0] ?? "?")}</span>`
              + `<span class="pin-label">${esc(p.name)} · ${esc(p.label)}<small>${esc(p.age)}</small></span></div>`,
          }),
        }).addTo(s.pins);
      }
      // Frame the children when the set of children changes; afterwards leave the parent's zoom alone
      const who = list.map((p) => p.id).sort().join(",");
      if (who === s.framed) return;
      s.framed = who;
      if (list.length === 1) s.map.setView([list[0].lat, list[0].lng], 15);
      else if (list.length) s.map.fitBounds(s.L.latLngBounds(list.map((p) => [p.lat, p.lng] as [number, number])).pad(0.6));
      else s.map.setView(WORLD, 2);
    };
    draw();
    const el = host.current;
    el?.addEventListener("eg-map-ready", draw);
    return () => el?.removeEventListener("eg-map-ready", draw);
  }, [data]);

  const described = [
    ...people.map((p) => `${p.name} at ${p.label}, ${p.age}`),
    ...missing.map((n) => `${n}: no location`),
  ].join(". ");
  // Inline, because leaflet.css is unlayered and so beats anything in globals.css (all of it is in @layer components)
  return <div ref={host} className="leaflet-host" style={{ fontFamily: "var(--font)", background: "var(--surface-2)" }} role="region" aria-label={`Family map. ${described || "No children to show"}.`} />;
}
