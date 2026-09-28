"use client";

import { useEffect } from "react";
import "./globals.css";

/** The root layout itself failed, so nothing else (fonts, theme cookie, providers) can be relied on here. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <html lang="en">
      <body>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "32px 16px" }}>
          <section className="card card-pad" role="alert" style={{ maxWidth: 440, width: "100%" }}>
            <div className="empty">
              <h3>eGuard couldn&apos;t load</h3>
              <p>Something went wrong on our side. Your protections on devices aren&apos;t affected.</p>
              {error.digest ? <p className="t-meta num">Reference: {error.digest}</p> : null}
              <button className="btn btn-primary" onClick={() => retry()}>Try again</button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
