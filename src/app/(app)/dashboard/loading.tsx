export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading dashboard" className="dash-col">
      <div aria-hidden="true" className="dash-col">
        <div className="skeleton" style={{ height: 280, borderRadius: 24 }} />
        <div className="metrics">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 170, borderRadius: 20 }} />)}
        </div>
        <div className="dash-grid">
          <div className="dash-col">
            <div className="children-grid">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 20 }} />)}</div>
            <div className="skeleton" style={{ height: 340, borderRadius: 20 }} />
          </div>
          <div className="dash-col">
            <div className="skeleton" style={{ height: 300, borderRadius: 20 }} />
            <div className="skeleton" style={{ height: 280, borderRadius: 20 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
