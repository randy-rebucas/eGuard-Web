import Link from "next/link";
import { notFound } from "next/navigation";
import { logStaff, requireStaff } from "@/lib/staff-auth";
import { openDraft, storeReviewDetail } from "@/lib/review-queries";
import { REPLY_MAX, STORE_LABEL, type Store } from "@/lib/store-reviews/types";
import { AI_PROVIDER_LABEL, aiProvider } from "@/lib/ai";
import { setReviewIgnored } from "@/app/actions/console-reviews";
import { label, stamp } from "../../../format";
import { ReviewPill } from "../../../ui";
import { RegenerateForm, ReplyEditor, TicketLinkForm } from "../../../review-forms";

export const metadata = { title: "Store review" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

export default async function ReviewPage(props: PageProps<"/console/reviews/[id]">) {
  const staff = await requireStaff();
  const { id } = await props.params;
  const r = await storeReviewDetail(id);
  if (!r) notFound();
  await logStaff(staff.id, "review.view", `review:${r.id}`);
  const store = r.store as Store;
  const draft = openDraft(r.replies, r.textHash);
  const provider = aiProvider();
  const history = r.replies.filter((x) => x !== draft);
  return (
    <>
      <div>
        <p className="cn-eyebrow"><Link className="inline-link" href="/reviews">Store reviews</Link></p>
        <h1 className="cn-h1"><span aria-label={`${r.rating} stars`}>{stars(r.rating)}</span> {r.reviewTitle ?? ""}</h1>
      </div>
      <section className="card card-pad">
        <div className="card-head">
          <ReviewPill status={r.status} />
          <form action={setReviewIgnored}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="ignore" value={r.status === "IGNORED" ? "false" : "true"} />
            <button className="btn btn-ghost btn-sm" disabled={r.status === "POSTING"}>{r.status === "IGNORED" ? "Stop ignoring" : "Ignore"}</button>
          </form>
        </div>
        <p className="cn-message">{r.text || <span className="cn-muted">(No written review, only stars.)</span>}</p>
        <dl className="cn-dl">
          <dt>Store</dt><dd>{STORE_LABEL[store]}</dd>
          <dt>By</dt><dd>{r.authorName ?? "—"} <span className="cn-muted">(the store name they chose: we can&apos;t tell which family, if any)</span></dd>
          <dt>Posted</dt><dd>{stamp(r.reviewedAt)}</dd>
          {r.appVersion ? <><dt>App version</dt><dd>{r.appVersion}</dd></> : null}
          {r.device ? <><dt>Device</dt><dd>{r.device}</dd></> : null}
          {r.language || r.territory ? <><dt>Language / country</dt><dd>{[r.language, r.territory].filter(Boolean).join(" · ")}</dd></> : null}
        </dl>
      </section>

      <section className="card card-pad">
        <div className="card-head"><h2 className="cn-h2">AI reading</h2></div>
        {r.classifiedAt ? (
          <dl className="cn-dl">
            <dt>Summary</dt><dd>{r.summary ?? "—"}</dd>
            <dt>Sentiment</dt><dd>{label(r.sentiment)}</dd>
            <dt>Topics</dt><dd>{r.topics.map(label).join(", ") || "—"}</dd>
            <dt>Urgency</dt><dd>{label(r.urgency)}</dd>
            <dt>Reads like a child</dt><dd>{r.likelyChild ? "Yes: answer kindly, or not at all" : "No"}</dd>
          </dl>
        ) : <p className="cn-muted">{provider ? "Not read yet: the next maintenance run reads it (every 10 minutes)." : "AI isn't set up on this server."}</p>}
        <RegenerateForm reviewId={r.id} provider={provider ? AI_PROVIDER_LABEL[provider] : null} />
      </section>

      <section className="card card-pad">
        <div className="card-head"><h2 className="cn-h2">Reply</h2></div>
        {r.storeReplyText ? (
          <>
            <p className="cn-muted">On {STORE_LABEL[store]} now{r.storeReplyAt ? `, since ${stamp(r.storeReplyAt)}` : ""}:</p>
            <p className="cn-message">{r.storeReplyText}</p>
          </>
        ) : null}
        {draft?.status === "FAILED" ? <p className="form-error" role="alert">Posting failed: {draft.postError ?? "unknown error"}. Check it and try again.</p> : null}
        {r.status === "POSTING" ? <p className="cn-muted">Posting now… reload in a moment.</p> : (
          <ReplyEditor reviewId={r.id} initial={draft?.text ?? ""} max={REPLY_MAX[store]} storeLabel={STORE_LABEL[store]} replied={!!r.storeReplyText} trimmed={!!draft?.trimmed} />
        )}
        {draft ? <p className="cn-muted">Draft by {draft.source === "AI" ? `AI (${draft.provider ?? "?"})` : "staff"}, {stamp(draft.updatedAt)}.</p> : null}
      </section>

      <section className="card card-pad">
        <div className="card-head"><h2 className="cn-h2">Follow-up</h2></div>
        <TicketLinkForm reviewId={r.id} ticketId={r.ticketId} />
        {r.ticketId ? <p><Link className="inline-link" href={`/tickets/${r.ticketId}`}>Open the ticket</Link></p> : null}
      </section>

      {history.length ? (
        <section className="card">
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Earlier replies</th><th>By</th><th>State</th><th>When</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{h.text}</td>
                    <td>{h.source === "AI" ? "AI" : "Staff"}</td>
                    <td>{label(h.status)}{h.postError ? ` (${h.postError})` : ""}</td>
                    <td>{stamp(h.postedAt ?? h.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
