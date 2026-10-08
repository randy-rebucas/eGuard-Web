"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Circle, Map as LeafletMap } from "leaflet";
import type { MapPlace } from "./family-map";

type Point = { lat: number; lng: number };

const WORLD: [number, number] = [20, 0];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * A small map for choosing where a new place is: tap to drop it, drawn at its radius. The family's saved places are
 * shown dashed, as on the family map. `center`: where to start (a child's location or a saved place), else the world.
 * Loaded client-side only (place-forms imports it with ssr: false).
 */
export default function PlacePicker({ value, radiusM, onPick, places, center, attribution }: {
  value: Point | null; radiusM: number; onPick: (p: Point) => void; places: MapPlace[]; center: Point | null; attribution: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<{ L: typeof import("leaflet"); map: LeafletMap; pick: Circle | null } | null>(null);
  // Fixed for the picker's life: read once when the map is created
  const init = useRef({ places, center, attribution, onPick });
  useEffect(() => { init.current.onPick = onPick; }, [onPick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !host.current) return;
      const { places: saved, center: c, attribution: credit } = init.current;
      const m = L.map(host.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
      if (c) m.setView([c.lat, c.lng], 15); else m.setView(WORLD, 2);
      // Through our server (api/tiles), as on the family map
      L.tileLayer("/api/tiles/{z}/{x}/{y}", { maxZoom: 18, attribution: credit }).addTo(m);
      for (const p of saved) {
        L.circle([p.lat, p.lng], { radius: p.radiusM, className: "map-place", weight: 1.5, dashArray: "4 4", fillOpacity: 0.06, interactive: false })
          .bindTooltip(esc(p.name), { direction: "top" }).addTo(m);
      }
      m.on("click", (e) => init.current.onPick({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.wrap().lng.toFixed(6)) }));
      map.current = { L, map: m, pick: null };
      host.current.dispatchEvent(new Event("eg-map-ready"));
    })();
    return () => { cancelled = true; map.current?.map.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const draw = () => {
      const s = map.current;
      if (!s) return;
      s.pick?.remove();
      s.pick = value ? s.L.circle([value.lat, value.lng], { radius: radiusM, className: "map-pick", weight: 2, fillOpacity: 0.15, interactive: false }).addTo(s.map) : null;
      // Typed coordinates off screen: bring them into view
      if (value && !s.map.getBounds().contains([value.lat, value.lng])) s.map.setView([value.lat, value.lng], Math.max(s.map.getZoom(), 15));
    };
    draw();
    const el = host.current;
    el?.addEventListener("eg-map-ready", draw);
    return () => el?.removeEventListener("eg-map-ready", draw);
  }, [value, radiusM]);

  return <div ref={host} className="leaflet-host" style={{ fontFamily: "var(--font)", background: "var(--surface-2)", cursor: "crosshair" }} role="region" aria-label="Map: tap where the place is. Or type its coordinates below." />;
}
