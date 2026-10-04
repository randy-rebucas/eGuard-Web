import { PageSkeleton } from "@/components/ui";

/* Shaped like the Devices page (no header button; a child's section, then the two pairing cards), so nothing jumps */
export default function Loading() {
  return (
    <PageSkeleton label="Loading devices">
      <div className="skeleton" style={{ height: 30, width: "min(240px, 60%)" }} />
      <div className="devices-grid">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 190, borderRadius: 20 }} />)}</div>
      <div className="skeleton" style={{ height: 230, borderRadius: 20 }} />
      <div className="skeleton" style={{ height: 230, borderRadius: 20 }} />
    </PageSkeleton>
  );
}
