import { PageSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton label="Loading devices" action>
      <div className="devices-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 190, borderRadius: 20 }} />)}</div>
      <div className="skeleton" style={{ height: 260, borderRadius: 20 }} />
    </PageSkeleton>
  );
}
