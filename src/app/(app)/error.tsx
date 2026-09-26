"use client";

import { Icon } from "@/components/icon";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className="card card-pad">
      <div className="empty">
        <span className="ico-tile crit"><Icon name="triangle-alert" /></span>
        <h3>This page couldn&apos;t load</h3>
        <p>{process.env.NODE_ENV === "production" ? "Something went wrong on our side. Your protections on devices aren't affected." : error.message}</p>
        <button className="btn btn-primary" onClick={() => retry()}>Try again</button>
      </div>
    </section>
  );
}
