import { PageSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton label="Loading child" action>
      <div className="skeleton" style={{ height: 46, borderRadius: 12 }} />
      <div className="detail-grid">
        <div className="dash-col">
          <div className="skeleton" style={{ height: 260, borderRadius: 20 }} />
          <div className="skeleton" style={{ height: 340, borderRadius: 20 }} />
        </div>
        <div className="skeleton" style={{ height: 420, borderRadius: 20 }} />
      </div>
    </PageSkeleton>
  );
}
