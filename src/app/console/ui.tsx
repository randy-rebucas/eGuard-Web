import Link from "next/link";

/** "Older" (and "Newest") links for a list paged by time. `query` is the rest of the list's query string. */
export function Pager({ nextBefore, paged, query = {} }: { nextBefore: Date | null; paged: boolean; query?: Record<string, string> }) {
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ ...query, ...extra }).filter(([, v]) => v));
    const s = p.toString();
    return s ? `?${s}` : "?";
  };
  if (!nextBefore && !paged) return null;
  return (
    <div className="cn-pager">
      {paged ? <Link className="btn btn-secondary btn-sm" href={qs({})}>Newest</Link> : <span />}
      {nextBefore ? <Link className="btn btn-secondary btn-sm" href={qs({ before: nextBefore.toISOString() })}>Older</Link> : null}
    </div>
  );
}

export function TicketPill({ status }: { status: string }) {
  return <span className={`pill ${status === "OPEN" ? "tone-warn" : "tone-muted"}`}>{status === "OPEN" ? "Open" : status === "CLOSED" ? "Closed" : status}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="cn-empty">{children}</p>;
}
