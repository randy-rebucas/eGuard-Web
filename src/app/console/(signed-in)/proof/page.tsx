import { requireStaff } from "@/lib/staff-auth";
import { feedbackForQuote } from "@/lib/feedback-queries";
import { canPublish, listForConsole } from "@/lib/testimonials";
import { ingestedPlayStats, playRating } from "@/lib/social-proof-data";
import { MAX_RATING_AGE_DAYS, MIN_PLAY_REVIEWS, RATING_STALE_WARN_DAYS, daysSince, proof } from "@/lib/social-proof";
import { label, stamp } from "../../format";
import { Empty } from "../../ui";
import { EditTestimonialForm, PlayRatingForm, ProposeForm, SortOrderForm, TestimonialButton } from "../../proof-forms";

export const metadata = { title: "Social proof" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

const TONE: Record<string, string> = {
  PROPOSED: "tone-muted", AWAITING_CONSENT: "tone-warn", CONSENTED: "tone-accent", PUBLISHED: "tone-ok", WITHDRAWN: "tone-crit", DECLINED: "tone-muted",
};
const STATUS_LABEL: Record<string, string> = {
  PROPOSED: "Proposed", AWAITING_CONSENT: "Waiting for the parent", CONSENTED: "Agreed", PUBLISHED: "On the site", WITHDRAWN: "Withdrawn", DECLINED: "Declined",
};

/**
 * What the public site shows as proof (docs/marketing-site-review.md › Social proof): the Google Play rating, typed in
 * from the Play Console, and parents' quotes, each published only after the parent agreed to the exact words.
 */
export default async function ProofPage(props: PageProps<"/console/proof">) {
  await requireStaff();
  const sp = await props.searchParams;
  const feedbackId = typeof sp.feedback === "string" ? sp.feedback : "";
  const [rating, ingested, rows, fromFeedback] = await Promise.all([
    playRating(), ingestedPlayStats(), listForConsole(),
    feedbackId ? feedbackForQuote(feedbackId) : null,
  ]);
  const age = rating ? daysSince(rating.checkedOn) : Infinity;
  const shown = proof({ playRating: rating });
  const gap = rating && ingested.avg != null ? Math.abs(rating.stars - ingested.avg) : 0;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <h1 className="cn-h1">Social proof</h1>
      <p className="cn-muted">What eguard.family shows under &ldquo;What parents say&rdquo;. Never put ratings in structured data: Google only accepts ratings collected on the site itself.</p>

      <section className="card card-pad">
        <div className="card-head"><h2 className="cn-h2">Google Play rating</h2></div>
        {rating && age > RATING_STALE_WARN_DAYS ? (
          <p className="form-error" role="alert">Checked {Math.floor(age)} days ago. {age > MAX_RATING_AGE_DAYS ? "It's hidden from the site until you check it again." : `It's hidden from the site after ${MAX_RATING_AGE_DAYS} days: check it again in the Play Console.`}</p>
        ) : null}
        <dl className="cn-dl">
          <dt>On the site</dt><dd>{shown.rating ? `${shown.rating.stars.toFixed(1)}★ from ${shown.rating.reviews.toLocaleString("en-US")} ratings` : `Nothing (${!rating ? "not entered" : rating.reviews < MIN_PLAY_REVIEWS ? `fewer than ${MIN_PLAY_REVIEWS} ratings` : "too old"})`}</dd>
          <dt>Reviews eGuard synced</dt><dd>{ingested.n ? `${ingested.avg?.toFixed(2)}★ average of ${ingested.n} written reviews` : "None yet"} <span className="cn-muted">(written reviews only: Play&apos;s rating also counts stars without words, so they differ)</span></dd>
        </dl>
        {gap > 0.5 ? <p className="form-error" role="alert">That&apos;s {gap.toFixed(1)}★ away from the synced reviews. Check the number in the Play Console before saving.</p> : null}
        <PlayRatingForm stars={rating?.stars} reviews={rating?.reviews} checkedOn={today} />
      </section>

      <section className="card card-pad">
        <div className="card-head"><h2 className="cn-h2">Propose a quote</h2></div>
        <p className="cn-muted">From a parent&apos;s own words: their feedback (Feedback › &ldquo;Quote this&rdquo;) or an email to support. Store reviews can&apos;t be used: reviewers are anonymous and can&apos;t agree.</p>
        {fromFeedback?.comment
          ? <ProposeForm feedbackId={fromFeedback.id} original={fromFeedback.comment} email={fromFeedback.user.email} />
          : <ProposeForm />}
      </section>

      <section className="card">
        <div className="card-head card-pad cn-head-flush"><h2>Quotes</h2></div>
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Quote</th><th>Parent</th><th>State</th><th>Next step</th><th>Order</th></tr></thead>
              <tbody>
                {rows.map((t) => {
                  const live = ["PROPOSED", "AWAITING_CONSENT", "CONSENTED", "PUBLISHED"].includes(t.status);
                  return (
                    <tr key={t.id}>
                      <td style={{ minWidth: 280 }}>
                        {live
                          ? <EditTestimonialForm id={t.id} quote={t.quote ?? ""} displayName={t.displayName ?? ""} warn={t.status === "CONSENTED" || t.status === "PUBLISHED"} />
                          : <span className="cn-muted">{t.quote ? `“${t.quote}” — ${t.displayName}` : "(erased)"}</span>}
                      </td>
                      <td>{t.user?.email ?? "Account deleted"}<br /><span className="cn-muted">{label(t.source)} · {stamp(t.createdAt)}</span></td>
                      <td>
                        <span className={`pill ${TONE[t.status] ?? "tone-muted"}`}>{STATUS_LABEL[t.status] ?? t.status}</span>
                        {t.consentAt ? <><br /><span className="cn-muted">Agreed {stamp(t.consentAt)}</span></> : null}
                        {t.withdrawnAt ? <><br /><span className="cn-muted">{t.status === "DECLINED" ? "Declined" : "Withdrawn"} {stamp(t.withdrawnAt)}</span></> : null}
                      </td>
                      <td>
                        {t.status === "PROPOSED" ? <><TestimonialButton id={t.id} op="send" label="Ask the parent" confirm="Email the parent this exact quote and name, asking for consent?" /> <TestimonialButton id={t.id} op="discard" label="Discard" /></> : null}
                        {t.status === "AWAITING_CONSENT" ? <TestimonialButton id={t.id} op="send" label="Send again" /> : null}
                        {t.status === "CONSENTED" && canPublish(t) ? <TestimonialButton id={t.id} op="publish" label="Publish" confirm="Put this quote on eguard.family?" /> : null}
                        {t.status === "PUBLISHED" ? <TestimonialButton id={t.id} op="unpublish" label="Take off the site" /> : null}
                      </td>
                      <td>{t.status === "PUBLISHED" ? <SortOrderForm id={t.id} sortOrder={t.sortOrder} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>No quotes yet. Propose one from a parent&apos;s feedback.</Empty>}
      </section>
    </>
  );
}
