import { PageSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton label="Loading device" action>
      <div className="detail-grid">
        <div className="dash-col">
          <div className="skeleton" style={{ height: 300, borderRadius: 20 }} />
          <div className="skeleton" style={{ height: 280, borderRadius: 20 }} />
        </div>
        <div className="skeleton" style={{ height: 380, borderRadius: 20 }} />
      </div>
    </PageSkeleton>
  );
}
