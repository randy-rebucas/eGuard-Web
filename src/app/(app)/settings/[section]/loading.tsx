/** Inside the settings card: the page title and section nav stay put while a section loads. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading settings" className="dash-col" style={{ gap: 16 }}>
      <div aria-hidden="true" className="dash-col" style={{ gap: 16 }}>
        <div className="skeleton" style={{ height: 24, width: "min(220px, 60%)" }} />
        <div className="skeleton" style={{ height: 16, width: "min(420px, 90%)" }} />
        <div className="form-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}</div>
        <div className="skeleton" style={{ height: 42, width: 140, borderRadius: 999 }} />
      </div>
    </div>
  );
}
