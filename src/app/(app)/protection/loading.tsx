import { PageSkeleton } from "@/components/ui";

/* Shaped like the Protection page (health card with its 10 checks, the 10 setting cards, platform support), so nothing jumps */
export default function Loading() {
  return (
    <PageSkeleton label="Loading protection" action>
      <div className="card card-pad">
        <div className="health">
          <div className="skeleton" style={{ width: 148, height: 148, borderRadius: "50%", flex: "none" }} />
          <div className="grow" style={{ display: "grid", gap: 10 }}>
            <div className="skeleton" style={{ height: 14, width: 160 }} />
            <div className="skeleton" style={{ height: 30, width: "min(360px, 80%)" }} />
            <div className="skeleton" style={{ height: 16, width: "min(520px, 95%)" }} />
          </div>
        </div>
        <div className="check-list" style={{ marginTop: 26 }}>{Array.from({ length: 10 }, (_, i) => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 14 }} />)}</div>
      </div>
      <div className="skeleton" style={{ height: 26, width: 220 }} />
      <div className="prot-grid">{Array.from({ length: 10 }, (_, i) => <div key={i} className="skeleton" style={{ height: 230, borderRadius: 20 }} />)}</div>
      <div className="skeleton" style={{ height: 200, borderRadius: 20 }} />
    </PageSkeleton>
  );
}
