/* Shaped like the device page (crumbs, header card, key facts, protections beside requests and settings), so nothing jumps when it loads */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading device" className="dash-col" style={{ gap: 20 }}>
      <div aria-hidden="true" className="dash-col" style={{ gap: 20 }}>
        <div>
          <div className="skeleton" style={{ height: 16, width: 180, marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 152, borderRadius: 20 }} />
        </div>
        <div className="skeleton" style={{ height: 78, borderRadius: 16 }} />
        <div className="detail-grid">
          <div className="skeleton" style={{ height: 640, borderRadius: 20 }} />
          <div className="dash-col">
            <div className="skeleton" style={{ height: 280, borderRadius: 20 }} />
            <div className="skeleton" style={{ height: 260, borderRadius: 20 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
