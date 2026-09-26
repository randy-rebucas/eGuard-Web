"use client";

import dynamic from "next/dynamic";
import type { MapPerson } from "@/components/family-map";

const FamilyMap = dynamic(() => import("@/components/family-map"), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ position: "absolute", inset: 0, borderRadius: 0 }} />,
});

export function LazyMap({ people }: { people: MapPerson[] }) {
  return <FamilyMap people={people} />;
}
