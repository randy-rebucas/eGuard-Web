import { PageSkeleton } from "@/components/ui";

/* Shaped like the organization page (counts, join code beside admins, sponsor codes), so nothing jumps when it loads */
export default function Loading() {
  return (
    <PageSkeleton label="Loading organization">
      <div className="org-stats">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 84, borderRadius: 16 }} />)}
      </div>
      <div className="org-grid">
        <div className="skeleton" style={{ height: 220, borderRadius: 20 }} />
        <div className="skeleton" style={{ height: 220, borderRadius: 20 }} />
      </div>
      <div className="skeleton" style={{ height: 420, borderRadius: 20 }} />
    </PageSkeleton>
  );
}
