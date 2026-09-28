"use client";

import { ErrorPanel } from "@/components/boundary";

/** Pages outside the signed-in app: landing, sign-in, email verification. */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "32px 16px" }}>
      <div style={{ maxWidth: 480, width: "100%" }}>
        <ErrorPanel error={error} retry={retry} title="Something went wrong" home="/" />
      </div>
    </main>
  );
}
