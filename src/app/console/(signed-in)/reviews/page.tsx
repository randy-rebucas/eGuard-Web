import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { REVIEW_STATUSES, REVIEW_STATUS_LABEL, listStoreReviews, reviewFilter, reviewStats } from "@/lib/review-queries";
import { STORES, STORE_LABEL, TOPICS, type Store } from "@/lib/store-reviews/types";
import { googlePlayConfig } from "@/lib/google-play";
import { appStoreConfig } from "@/lib/store-reviews/app-store";
import { ago, beforeParam, label, stamp } from "../../format";
import { Empty, FilterTabs, Pager, ReviewPill, StatGrid } from "../../ui";
import { SyncNowForm } from "../../review-forms";

export const metadata = { title: "Store reviews" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);
const avg = (v: { avg: number | null; n: number } | undefined) => (v?.avg != null ? `${v.avg.toFixed(2)}★` : "—");

export default async function ReviewsPage(props: PageProps<"/console/reviews">) {
  await requireStaff();
  const sp = await props.searchParams;
  const f = reviewFilter(sp);
  const before = beforeParam(sp.before);
  const [{ rows, nextBefore }, stats] = await Promise.all([listStoreReviews(f, before), reviewStats()]);
  const configured: Record<Store, boolean> = { GOOGLE_PLAY: !!googlePlayConfig(), APP_STORE: !!appStoreConfig() };
  const query = {
    status: f.status ?? "", store: f.store ?? "", stars: f.stars ? String(f.stars) : "", sentiment: f.sentiment ?? "",
    topic: f.topic ?? "", urgency: f.urgency ?? "", child: f.likelyChild ? "1" : "",
  };
  return (
    <>
      <h1 className="cn-h1">Store reviews</h1>
      <StatGrid stats={[
        { label: "Waiting for a reply", value: stats.waiting, href: "/reviews?status=DRAFTED", tone: stats.waiting ? "warn" : undefined },
        { label: "1–2★ unanswered (90 days)", value: stats.lowUnanswered, href: "/reviews?stars=1", tone: stats.lowUnanswered ? "bad" : undefined },
        { label: "Google Play, 30 days", value: avg(stats.d30.GOOGLE_PLAY), hint: `${stats.d30.GOOGLE_PLAY?.n ?? 0} reviews · all time ${avg(stats.all.GOOGLE_PLAY)}` },
        { label: "App Store, 30 days", value: avg(stats.d30.APP_STORE), hint: `${stats.d30.APP_STORE?.n ?? 0} reviews · all time ${avg(stats.all.APP_STORE)}` },
      ]} />
      <section className="card card-pad">
        <div className="card-head"><h2 className="cn-h2">Sync</h2></div>
        <dl className="cn-dl">
          {STORES.map((s) => {
            const st = stats.sync[s];
            return (
              <div key={s} style={{ display: "contents" }}>
                <dt>{STORE_LABEL[s]}</dt>
                <dd>
                  {!configured[s] ? <span className="cn-muted">Not set up ({s === "GOOGLE_PLAY" ? "GOOGLE_PLAY_*" : "APP_STORE_CONNECT_*, APP_STORE_APP_ID"})</span> : (
                    <>
                      Last success {st?.lastSuccessAt ? ago(st.lastSuccessAt) : "never"}
                      {st?.lastError && (!st.lastSuccessAt || (st.lastRunAt && st.lastSuccessAt < st.lastRunAt)) ? <> · <span className="cn-tone-bad">{st.lastError}</span></> : null}
                      <SyncNowForm store={s} label={STORE_LABEL[s]} />
                    </>
                  )}
                </dd>
              </div>
            );
          })}
          <dt>Reply time</dt><dd>{stats.medianReplyHours != null ? `Median ${stats.medianReplyHours < 48 ? `${Math.round(stats.medianReplyHours)} hours` : `${Math.round(stats.medianReplyHours / 24)} days`} (90 days)` : "—"}</dd>
          <dt>Top topics</dt><dd>{stats.topics.length ? stats.topics.map((t) => `${label(t.topic)} (${t.n})`).join(" · ") : "—"}</dd>
        </dl>
      </section>
      <FilterTabs label="Status" base="/reviews" param="status" value={query.status} query={query}
        options={[{ value: "", label: "All" }, ...REVIEW_STATUSES.map((s) => ({ value: s, label: REVIEW_STATUS_LABEL[s] }))]} />
      <FilterTabs label="Store" base="/reviews" param="store" value={query.store} query={query}
        options={[{ value: "", label: "Both stores" }, ...STORES.map((s) => ({ value: s, label: STORE_LABEL[s] }))]} />
      <FilterTabs label="Stars" base="/reviews" param="stars" value={query.stars} query={query}
        options={[{ value: "", label: "Any stars" }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}★` }))]} />
      <FilterTabs label="Sentiment" base="/reviews" param="sentiment" value={query.sentiment} query={query}
        options={[{ value: "", label: "Any sentiment" }, { value: "NEGATIVE", label: "Negative" }, { value: "NEUTRAL", label: "Neutral" }, { value: "POSITIVE", label: "Positive" }]} />
      <FilterTabs label="Urgency" base="/reviews" param="urgency" value={query.urgency} query={query}
        options={[{ value: "", label: "Any urgency" }, { value: "HIGH", label: "High" }, { value: "NORMAL", label: "Normal" }, { value: "LOW", label: "Low" }]} />
      <FilterTabs label="Topic" base="/reviews" param="topic" value={query.topic} query={query}
        options={[{ value: "", label: "Any topic" }, ...TOPICS.map((t) => ({ value: t, label: label(t) }))]} />
      <FilterTabs label="Reviewer" base="/reviews" param="child" value={query.child} query={query}
        options={[{ value: "", label: "Everyone" }, { value: "1", label: "Reads like a child" }]} />
      <section className="card">
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Review</th><th>Stars</th><th>Store</th><th>About</th><th>Status</th><th>Posted</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link prefetch={false} className="inline-link" href={`/reviews/${r.id}`}>{r.reviewTitle || r.text.slice(0, 90) || "(stars only)"}{!r.reviewTitle && r.text.length > 90 ? "…" : ""}</Link>
                      {r.summary ? <><br /><span className="cn-muted">{r.summary}</span></> : null}
                    </td>
                    <td aria-label={`${r.rating} stars`}>{stars(r.rating)}</td>
                    <td>{STORE_LABEL[r.store as Store]}</td>
                    <td>
                      {r.topics.map(label).join(", ") || "—"}
                      {r.urgency === "HIGH" ? <> <span className="pill tone-crit">Urgent</span></> : null}
                      {r.likelyChild ? <> <span className="pill tone-muted">Child?</span></> : null}
                    </td>
                    <td><ReviewPill status={r.status} /></td>
                    <td>{stamp(r.reviewedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No reviews here.</Empty>}
      </section>
      <Pager nextBefore={nextBefore} paged={!!before} query={query} />
    </>
  );
}
