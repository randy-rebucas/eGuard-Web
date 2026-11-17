"use client";

import { useActionState } from "react";
import { editTestimonial, proposeTestimonial, savePlayRatingAction, testimonialAction } from "@/app/actions/console-proof";
import { Feedback } from "@/components/feedback";

/** The Play rating as the Play Console shows it (Ratings and reviews › Ratings overview) */
export function PlayRatingForm({ stars, reviews, checkedOn }: { stars?: number; reviews?: number; checkedOn: string }) {
  const [state, action, pending] = useActionState(savePlayRatingAction, undefined);
  return (
    <form action={action} className="cn-form" noValidate>
      <Feedback state={state} />
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="field"><label htmlFor="pr-stars">Stars</label><input className="input" id="pr-stars" name="stars" type="number" step="0.1" min="1" max="5" defaultValue={stars ?? ""} required /></div>
        <div className="field"><label htmlFor="pr-reviews">Ratings counted</label><input className="input" id="pr-reviews" name="reviews" type="number" min="0" defaultValue={reviews ?? ""} required /></div>
        <div className="field"><label htmlFor="pr-date">Checked on</label><input className="input" id="pr-date" name="checkedOn" type="date" defaultValue={checkedOn} required /></div>
      </div>
      <div className="cn-actions"><button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "Saving…" : "Save rating"}</button></div>
    </form>
  );
}

/** A new quote. From console › Feedback the feedback id and its words come prefilled. */
export function ProposeForm({ feedbackId, original, email }: { feedbackId?: string; original?: string; email?: string }) {
  const [state, action, pending] = useActionState(proposeTestimonial, undefined);
  return (
    <form action={action} className="cn-form" noValidate>
      <Feedback state={state} />
      {feedbackId ? (
        <>
          <input type="hidden" name="feedbackId" value={feedbackId} />
          <p className="cn-muted">From {email ?? "a parent"}&apos;s feedback: &ldquo;{original}&rdquo;</p>
        </>
      ) : (
        <>
          <div className="field"><label htmlFor="pp-email">Parent&apos;s account email</label><input className="input" id="pp-email" name="parentEmail" type="email" required /></div>
          <div className="field"><label htmlFor="pp-orig">What they wrote (for the record)</label><textarea className="input cn-textarea" id="pp-orig" name="originalText" rows={3} /></div>
        </>
      )}
      <div className="field">
        <label htmlFor="pp-quote">Quote</label>
        <textarea className="input cn-textarea" id="pp-quote" name="quote" rows={3} maxLength={400} defaultValue={original ?? ""} required />
        <span className="field-hint">Their words. Trimming for length is fine; changing the meaning isn&apos;t. They approve exactly this.</span>
      </div>
      <div className="field">
        <label htmlFor="pp-name">Name shown</label>
        <input className="input" id="pp-name" name="displayName" maxLength={60} placeholder="Maria, Tacloban · Parent of two, Cebu" required />
        <span className="field-hint">The parent can change it when they agree.</span>
      </div>
      <div className="cn-actions"><button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "Saving…" : "Propose"}</button></div>
    </form>
  );
}

export function EditTestimonialForm({ id, quote, displayName, warn }: { id: string; quote: string; displayName: string; warn: boolean }) {
  const [state, action, pending] = useActionState(editTestimonial, undefined);
  return (
    <form action={action} className="cn-form" noValidate>
      <Feedback state={state} />
      <input type="hidden" name="id" value={id} />
      <textarea className="input cn-textarea" name="quote" rows={2} maxLength={400} defaultValue={quote} aria-label="Quote" />
      <input className="input" name="displayName" maxLength={60} defaultValue={displayName} aria-label="Name shown" />
      {warn ? <span className="field-hint">Saving a change clears the parent&apos;s consent and takes it off the site until they agree again.</span> : null}
      <div className="cn-actions"><button className="btn btn-ghost btn-sm" disabled={pending}>Save wording</button></div>
    </form>
  );
}

/** One button for one step: send for consent, publish, unpublish, discard */
export function TestimonialButton({ id, op, label, confirm }: { id: string; op: string; label: string; confirm?: string }) {
  const [state, action, pending] = useActionState(testimonialAction, undefined);
  return (
    <form action={action} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }} style={{ display: "inline-block" }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <button className="btn btn-secondary btn-sm" disabled={pending}>{label}</button>
      <Feedback state={state} />
    </form>
  );
}

export function SortOrderForm({ id, sortOrder }: { id: string; sortOrder: number }) {
  const [state, action, pending] = useActionState(testimonialAction, undefined);
  return (
    <form action={action} className="row" style={{ gap: 4 }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value="order" />
      <input className="input" name="sortOrder" type="number" defaultValue={sortOrder} style={{ width: 72 }} aria-label="Order on the site, lower first" />
      <button className="btn btn-ghost btn-sm" disabled={pending}>Set</button>
      <Feedback state={state} />
    </form>
  );
}
