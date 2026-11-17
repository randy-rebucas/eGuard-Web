"use client";

import { useActionState, useState, useTransition } from "react";
import { sendFeedback } from "@/app/actions/feedback";
import { withdrawTestimonial } from "@/app/actions/testimonials";
import { Feedback } from "./feedback";
import { Icon } from "./icon";

const KINDS = [
  ["FEEDBACK", "General feedback"],
  ["BUG", "Something's not working"],
  ["IDEA", "An idea"],
] as const;

/** Settings › Support › Send feedback. Something broken, with "you may contact me", opens a ticket (lib/feedback). */
export function FeedbackForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(sendFeedback, undefined);
  const [comment, setComment] = useState("");
  const [kind, setKind] = useState<string>("FEEDBACK");
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state?.ok) setComment("");
    else if (state?.fields) { setComment(state.fields.comment ?? ""); setKind(state.fields.kind ?? "FEEDBACK"); }
  }
  return (
    <form action={action} className="dash-col" style={{ gap: 14 }}>
      <Feedback state={state} />
      <div className="field">
        <label htmlFor="fb-k">What kind</label>
        <select className="input" id="fb-k" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="fb-c">Your feedback</label>
        <textarea className="input" id="fb-c" name="comment" rows={5} value={comment} onChange={(e) => setComment(e.target.value)} minLength={3} maxLength={2000} required />
        <span className="field-hint">Read by the eGuard team. Need an answer about your account? Use Contact support above.</span>
      </div>
      <label className="check">
        <input type="checkbox" name="contactOk" defaultChecked />
        <span>eGuard may email me at {email} about this</span>
      </label>
      <div><button className="btn btn-secondary" disabled={pending}>{pending ? "Sending…" : <><Icon name="message-circle" />Send feedback</>}</button></div>
    </form>
  );
}

/** Settings › Privacy: take a quote back. It comes off eguard.family at once. */
export function WithdrawQuoteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  if (done) return <span className="pill tone-muted">Withdrawn</span>;
  return (
    <button className="btn btn-secondary btn-sm" disabled={pending}
      onClick={() => { if (window.confirm("Remove your words from eguard.family? They won't be used again.")) start(async () => { await withdrawTestimonial(id); setDone(true); }); }}>
      Withdraw
    </button>
  );
}
