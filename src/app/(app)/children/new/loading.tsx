import { PageSkeleton } from "@/components/ui";

/** The add-child form, not the children grid the parent route's skeleton shows. */
export default function Loading() {
  return (
    <PageSkeleton label="Loading">
      <div className="card card-pad dash-col" style={{ gap: 16, maxWidth: 568 }}>
        <div className="form-grid" style={{ maxWidth: 520 }}>{[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}</div>
        <div className="skeleton" style={{ height: 150, borderRadius: 12, maxWidth: 520 }} />
        <div className="skeleton" style={{ height: 44, width: 110, borderRadius: 12 }} />
      </div>
    </PageSkeleton>
  );
}
