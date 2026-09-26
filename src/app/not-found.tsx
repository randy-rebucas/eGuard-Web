import Link from "next/link";
import { Icon } from "@/components/icon";
import { Brand } from "@/components/logo";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "32px 16px" }}>
      <div className="card card-pad" style={{ maxWidth: 440, width: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
        <Brand tagline={false} />
        <div className="empty" style={{ padding: "12px 0" }}>
          <span className="ico-tile"><Icon name="search-x" /></span>
          <h3>We couldn&apos;t find that page</h3>
          <p>It may have been removed, or the link is wrong.</p>
          <Link className="btn btn-primary" href="/dashboard">Back to dashboard</Link>
        </div>
      </div>
    </main>
  );
}
