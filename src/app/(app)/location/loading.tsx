import { PageSkeleton } from "@/components/ui";

/** The page's shape: the map, and beside it the children, saved places and history cards. */
export default function Loading() {
  return (
    <PageSkeleton label="Loading locations">
      <div className="detail-grid">
        <div className="skeleton" style={{ minHeight: 420, borderRadius: 20 }} />
        <div className="dash-col">
          <div className="skeleton" style={{ height: 220, borderRadius: 20 }} />
          <div className="skeleton" style={{ height: 120, borderRadius: 20 }} />
          <div className="skeleton" style={{ height: 80, borderRadius: 20 }} />
        </div>
      </div>
    </PageSkeleton>
  );
}
