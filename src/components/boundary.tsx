"use client";

import Link from "next/link";
import { useEffect, useTransition } from "react";
import { catchError, type ErrorInfo } from "next/error";
// Its own three icons, not ./icon: error boundaries load with every page, and the full icon map would come with them
import { LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";

const ico = { "aria-hidden": true, strokeWidth: 1.75 } as const;

type Failure = Error & { digest?: string };

/** Production hides server error messages, so the parent gets a plain explanation and a reference for support. */
function reason(error: Failure) {
  return process.env.NODE_ENV === "production" ? null : error.message;
}

function useRetry(error: Failure, retry: () => void) {
  const [pending, start] = useTransition();
  useEffect(() => { console.error(error); }, [error]);
  return [pending, () => start(() => retry())] as const;
}

/** Whole-page failure: the body of `error.tsx` files. */
export function ErrorPanel({
  error, retry, title = "This page couldn't load", home = "/dashboard", homeLabel = "Go to dashboard",
  note = "Something went wrong on our side. Your protections on devices aren't affected.",
}: { error: Failure; retry: () => void; title?: string; home?: string; homeLabel?: string; note?: string }) {
  const [pending, again] = useRetry(error, retry);
  return (
    <section className="card card-pad" role="alert">
      <div className="empty">
        <span className="ico-tile crit"><TriangleAlert {...ico} /></span>
        <h3>{title}</h3>
        <p>{reason(error) ?? note}</p>
        {error.digest ? <p className="t-meta num">Reference: {error.digest}</p> : null}
        <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button className="btn btn-primary" onClick={again} disabled={pending}>
            {pending ? <><LoaderCircle {...ico} className="spin" />Trying again…</> : <><RefreshCw {...ico} />Try again</>}
          </button>
          <Link className="btn btn-ghost" href={home}>{homeLabel}</Link>
        </div>
      </div>
    </section>
  );
}

function SectionError({ title, error, retry }: { title: string; error: Failure; retry: () => void }) {
  const [pending, again] = useRetry(error, retry);
  return (
    <section className="card section-error" role="alert">
      <span className="ico-tile crit"><TriangleAlert {...ico} /></span>
      <div className="grow">
        <div className="t-title">{title} couldn&apos;t load</div>
        <div className="t-meta">{reason(error) ?? "The rest of the page is fine. Try this part again."}</div>
      </div>
      <button className="btn btn-secondary btn-sm" onClick={again} disabled={pending}>
        {pending ? <><LoaderCircle {...ico} className="spin" />Retrying…</> : <><RefreshCw {...ico} />Retry</>}
      </button>
    </section>
  );
}

/** Contains a failure to one part of a page, so a broken chart doesn't take the page down with it. */
export const SectionBoundary = catchError((props: { title: string }, { error, retry }: ErrorInfo) => (
  <SectionError title={props.title} error={error instanceof Error ? error : new Error(String(error))} retry={retry} />
));
