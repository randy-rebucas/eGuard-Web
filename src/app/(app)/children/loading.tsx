import { PageSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton label="Loading children" action>
      <div className="children-grid">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 20 }} />)}</div>
      <div className="skeleton" style={{ height: 240, borderRadius: 20 }} />
    </PageSkeleton>
  );
}
