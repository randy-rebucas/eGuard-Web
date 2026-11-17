"use client";

import { useActionState, useState } from "react";
import { linkReviewTicket, regenerateReviewReply, replyToReview, syncReviewsNow } from "@/app/actions/console-reviews";
import { Feedback } from "@/components/feedback";

/**
 * The reply to a store review: edit, save as a draft, or approve and post. The counter turns red past the store's
 * limit (Play: 350 characters), and posting needs the confirmation box, since the reply is public.
 */
export function ReplyEditor({ reviewId, initial, max, storeLabel, replied, trimmed }: {
  reviewId: string; initial: string; max: number; storeLabel: string; replied: boolean; trimmed: boolean;
}) {
  const [state, action, pending] = useActionState(replyToReview, undefined);
  const [text, setText] = useState(state?.fields?.text ?? initial);
  const over = text.trim().length > max;
  return (
    <form key={initial} action={action} className="cn-form" noValidate>
      <Feedback state={state} />
      <input type="hidden" name="id" value={reviewId} />
      <div className="field">
        <label htmlFor="rv-text">{replied ? "Change the public reply" : "Public reply"}</label>
        <textarea className="input cn-textarea" id="rv-text" name="text" value={text} onChange={(e) => setText(e.target.value)} rows={7}
          placeholder="Thank them, answer what they said, and say how to get help (Help & support in the app, or the support email)." />
        <span className="field-hint" aria-live="polite">
          <span className={over ? "cn-tone-bad" : undefined}>{text.trim().length} / {max}</span> characters on {storeLabel}.
          {trimmed ? " The AI's draft was cut to fit: read the ending." : ""}
          {" "}Never ask for a better rating or offer anything for one.
        </span>
      </div>
      <label className="check">
        <input type="checkbox" name="confirm" />
        <span>I&apos;ve read it, and it can go public on {storeLabel} under eGuard&apos;s name.</span>
      </label>
      <div className="cn-actions">
        <button className="btn btn-primary" name="intent" value="post" disabled={pending || over || !text.trim()}>{pending ? "Working…" : replied ? "Approve & update reply" : "Approve & post"}</button>
        <button className="btn btn-secondary" name="intent" value="save" disabled={pending || !text.trim()}>Save draft</button>
      </div>
    </form>
  );
}

/** Ask the AI for a new draft, with an optional instruction */
export function RegenerateForm({ reviewId, provider }: { reviewId: string; provider: string | null }) {
  const [state, action, pending] = useActionState(regenerateReviewReply, undefined);
  if (!provider) return <p className="cn-muted">AI drafts are off: set ANTHROPIC_API_KEY or OPENAI_API_KEY on the server.</p>;
  return (
    <form action={action} className="cn-form cn-inline-form" noValidate>
      <Feedback state={state} />
      <input type="hidden" name="id" value={reviewId} />
      <div className="field">
        <label htmlFor="rv-instruction">New draft with {provider}</label>
        <input className="input" id="rv-instruction" name="instruction" maxLength={500} placeholder="Optional: shorter, in Filipino, mention the setup guide…" />
      </div>
      <div className="cn-actions"><button className="btn btn-secondary btn-sm" disabled={pending}>{pending ? "Writing…" : "Regenerate"}</button></div>
    </form>
  );
}

export function TicketLinkForm({ reviewId, ticketId }: { reviewId: string; ticketId: string | null }) {
  const [state, action, pending] = useActionState(linkReviewTicket, undefined);
  return (
    <form action={action} className="cn-form cn-inline-form" noValidate>
      <Feedback state={state} />
      <input type="hidden" name="id" value={reviewId} />
      <div className="field">
        <label htmlFor="rv-ticket">Support ticket</label>
        <input className="input cn-mono" id="rv-ticket" name="ticketId" defaultValue={ticketId ?? ""} placeholder="Ticket id, if the reviewer also wrote in" />
      </div>
      <div className="cn-actions"><button className="btn btn-secondary btn-sm" disabled={pending}>Save</button></div>
    </form>
  );
}

export function SyncNowForm({ store, label }: { store: string; label: string }) {
  const [state, action, pending] = useActionState(syncReviewsNow, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="store" value={store} />
      <button className="btn btn-ghost btn-sm" disabled={pending}>{pending ? "Syncing…" : `Sync ${label} now`}</button>
      <Feedback state={state} />
    </form>
  );
}
