import Link from "next/link";
import { Icon } from "@/components/icon";
import { Brand } from "@/components/logo";

/**
 * Most visitors who land here followed an old or mistyped link from a search or another site, not from the
 * dashboard, so the way out leads to the public pages first. Parents who are signed in still get the dashboard.
 */
export default function NotFound() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "32px 16px" }}>
      <div className="card card-pad" style={{ maxWidth: 440, width: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
        <Link href="/" aria-label="eGuard home" style={{ alignSelf: "flex-start" }}><Brand tagline={false} /></Link>
        <div className="empty" style={{ padding: "12px 0" }}>
          <span className="ico-tile"><Icon name="search-x" /></span>
          <h3>We couldn&apos;t find that page</h3>
          <p>It may have moved, or the link is wrong. Try one of these instead.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            <Link className="btn btn-primary" href="/">Go to the homepage</Link>
            <Link className="btn btn-secondary" href="/dashboard">Your dashboard</Link>
          </div>
          <nav aria-label="Popular pages" style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", justifyContent: "center", marginTop: 8 }}>
            <Link href="/help">Help Center</Link>
            <Link href="/learn">Knowledge Center</Link>
            <Link href="/protections">Protections</Link>
            <Link href="/pricing">Pricing</Link>
          </nav>
        </div>
      </div>
    </main>
  );
}
