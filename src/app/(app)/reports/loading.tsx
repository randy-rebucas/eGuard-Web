import { PageSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton label="Loading reports" action>
      <div className="report-metrics">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 130, borderRadius: 20 }} />)}</div>
      <div className="detail-grid">
        <div className="skeleton" style={{ height: 360, borderRadius: 20 }} />
        <div className="skeleton" style={{ height: 280, borderRadius: 20 }} />
      </div>
      <div className="skeleton" style={{ height: 300, borderRadius: 20 }} />
    </PageSkeleton>
  );
}
