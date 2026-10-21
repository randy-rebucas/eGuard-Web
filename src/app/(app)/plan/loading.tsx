import { PageSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton label="Loading your safety plan" action>
      <div className="card" style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 260 }} />)}
      </div>
      <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}
      </div>
    </PageSkeleton>
  );
}
