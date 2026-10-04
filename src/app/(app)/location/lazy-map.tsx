"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { MapPerson, MapPlace } from "@/components/family-map";

const FamilyMap = dynamic(() => import("@/components/family-map"), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ position: "absolute", inset: 0, borderRadius: 0 }} />,
});

export function LazyMap({ people, missing, places, attribution }: { people: MapPerson[]; missing: string[]; places: MapPlace[]; attribution: string }) {
  return <FamilyMap people={people} missing={missing} places={places} attribution={attribution} />;
}

/** How often an open Location page fetches newer positions (only while the tab is visible). */
const REFRESH_MS = 30_000;

/** Keeps the page current while a parent watches it, without reloading or resetting the map. */
export function LocationRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const t = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", refresh); };
  }, [router]);
  return null;
}
