export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 12 }}>
      <div className="skeleton" style={{ height: 44, width: "min(360px, 70%)" }} />
      <div className="metrics">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 150, borderRadius: 20 }} />)}
      </div>
      <div className="skeleton" style={{ height: 320, borderRadius: 20 }} />
    </div>
  );
}
