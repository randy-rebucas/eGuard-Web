import { PageSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton label="Loading locations">
      <div className="skeleton" style={{ height: 420, borderRadius: 20 }} />
      <div className="children-grid">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 150, borderRadius: 20 }} />)}</div>
    </PageSkeleton>
  );
}
