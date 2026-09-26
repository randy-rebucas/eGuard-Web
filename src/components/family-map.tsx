"use client";

import { useEffect, useRef } from "react";

export type MapPerson = { id: string; name: string; hue: number; lat: number; lng: number; label: string };

/** Minimal Leaflet map with avatar pins. Loaded client-side only. */
export default function FamilyMap({ people }: { people: MapPerson[] }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !host.current) return;
      map = L.map(host.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
      const markers = people.map((p) =>
        L.marker([p.lat, p.lng], {
          title: `${p.name}, ${p.label}`,
          icon: L.divIcon({
            className: "",
            iconSize: [0, 0],
            html: `<div class="map-pin"><span class="avatar" style="--h:${p.hue}">${esc(p.name[0])}</span><span class="pin-label">${esc(p.name)} · ${esc(p.label)}</span></div>`,
          }),
        }).addTo(map!),
      );
      if (markers.length === 1) map.setView([people[0].lat, people[0].lng], 15);
      else if (markers.length) map.fitBounds(L.latLngBounds(people.map((p) => [p.lat, p.lng] as [number, number])).pad(0.6));
      else map.setView([14.6, 121.03], 11);
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [people]);
  return <div ref={host} className="leaflet-host" role="region" aria-label={`Map showing ${people.map((p) => `${p.name} at ${p.label}`).join(" and ") || "no locations"}`} />;
}
