"use client";

import Link from "next/link";
import { useActionState } from "react";
import { answerTestimonial } from "@/app/actions/testimonials";
// Its own icons, not ./icon, so this one-off page doesn't download the app's whole icon set
import { MessageSquareQuote, CircleCheck, CircleX } from "lucide-react";

const ico = { "aria-hidden": true, strokeWidth: 1.75, style: { width: 36, height: 36 } } as const;

type View = { status: string; quote: string; displayName: string };

/**
 * A parent's answer to "May we share your words?". Nothing changes until a button is pressed (mail scanners open
 * links). After agreeing, the same link withdraws.
 */
export function TestimonialConsent({ token, view, consentText }: { token: string; view: View; consentText: string }) {
  const [result, action, pending] = useActionState(answerTestimonial, undefined);
  const done = result?.done;
  if (done) {
    return (
      <div className="verify-card-body">
        {done === "agreed" ? <CircleCheck {...ico} /> : <CircleX {...ico} />}
        <h1>{done === "agreed" ? "Thank you!" : done === "declined" ? "No problem" : "Withdrawn"}</h1>
        <p>
          {done === "agreed" ? "Your words may now appear on eguard.family. You can withdraw at any time from this same link."
            : done === "declined" ? "Nothing will be shared. Thank you for your feedback all the same."
              : "Your words are off eguard.family now, and won't be used again."}
        </p>
        <Link className="btn btn-primary" href="/">Go to eguard.family</Link>
      </div>
    );
  }

  const quote = <blockquote style={{ margin: "8px 0", padding: "12px 16px", borderLeft: "3px solid var(--primary, #2563eb)", textAlign: "left" }}>&ldquo;{view.quote}&rdquo;<br /><span className="t-meta">— {view.displayName}</span></blockquote>;

  if (view.status === "CONSENTED" || view.status === "PUBLISHED") {
    return (
      <form action={action} className="verify-card-body">
        <MessageSquareQuote {...ico} />
        <h1>{view.status === "PUBLISHED" ? "Your words are on eguard.family" : "You agreed to share your words"}</h1>
        {quote}
        <p>Changed your mind? Withdraw, and they&apos;ll be removed from the site at once.</p>
        {result?.error ? <p className="form-error" role="alert">{result.error}</p> : null}
        <input type="hidden" name="token" value={token} />
        <button className="btn btn-secondary" name="decision" value="withdraw" disabled={pending}>Withdraw</button>
      </form>
    );
  }

  if (view.status !== "AWAITING_CONSENT") {
    return (
      <div className="verify-card-body">
        <CircleX {...ico} />
        <h1>Nothing to answer here</h1>
        <p>{view.status === "WITHDRAWN" ? "You withdrew this, so it isn't used." : view.status === "DECLINED" ? "You said no, so nothing is shared." : "This request was changed. Look for a newer email from eGuard."}</p>
        <Link className="btn btn-primary" href="/">Go to eguard.family</Link>
      </div>
    );
  }

  return (
    <form action={action} className="verify-card-body" style={{ gap: 12 }}>
      <MessageSquareQuote {...ico} />
      <h1>May we share your words?</h1>
      <p>We&apos;d like to show this on eguard.family, exactly as it is:</p>
      {quote}
      <div className="field" style={{ textAlign: "left" }}>
        <label htmlFor="tc-name">The name shown with it</label>
        <input className="input" id="tc-name" name="displayName" defaultValue={view.displayName} maxLength={60} />
        <span className="field-hint">A first name and town, or a description like &ldquo;Parent of two, Cebu&rdquo;. Change it if you like.</span>
      </div>
      <label className="check" style={{ textAlign: "left" }}>
        <input type="checkbox" name="confirm" />
        <span>{consentText}</span>
      </label>
      {result?.error ? <p className="form-error" role="alert">{result.error}</p> : null}
      <input type="hidden" name="token" value={token} />
      <div className="row" style={{ gap: 8, justifyContent: "center" }}>
        <button className="btn btn-primary" name="decision" value="agree" disabled={pending}>I agree</button>
        <button className="btn btn-secondary" name="decision" value="decline" disabled={pending}>No, thanks</button>
      </div>
    </form>
  );
}
