import { Suspense } from "react";
import { Loading } from "@/components/ui";

/**
 * Wraps a page's form, which reads the session (to send signed-in parents on), tokens in the URL or the database.
 * Only the form waits on the request: the layout's panel is in the static shell, and moving between these pages
 * shows the placeholder right away. The boundary has to be in the page, below the layout the pages share.
 */
export function FormSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading height={340} radius={14} label="Loading" style={{ marginTop: 22 }} />}>{children}</Suspense>;
}
