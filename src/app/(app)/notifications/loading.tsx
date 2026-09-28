import { PageSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton label="Loading notifications" action>
      <div className="skeleton" style={{ height: 46, borderRadius: 12 }} />
      <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 76 }} />)}
      </div>
    </PageSkeleton>
  );
}
