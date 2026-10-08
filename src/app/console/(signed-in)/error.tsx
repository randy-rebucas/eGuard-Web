"use client";

import { ErrorPanel } from "@/components/boundary";

/** A console page or action failed: staff copy, and the bar and nav stay (the root boundary is written for parents). */
export default function ConsoleError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <ErrorPanel
      error={error} retry={retry} home="/" homeLabel="Console home"
      note="The server couldn't finish this. Try again, or quote the reference below when reporting it."
    />
  );
}
