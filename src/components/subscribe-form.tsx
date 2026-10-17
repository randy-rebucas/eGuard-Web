"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, MailCheck } from "lucide-react";
import { subscribeAction } from "@/app/actions/subscribe";
import { recaptchaToken } from "./recaptcha";

/**
 * A mailing-list sign-up (lib/subscribers): the footer's eGuard news, or /iphone's launch list. reCAPTCHA (when the
 * server has keys) loads only when someone submits, so the footer doesn't add Google's script to every page.
 * `promise` says exactly what they'll get; the confirmation email repeats it.
 */
export function SubscribeForm({ list, source, promise, siteKey, cta = "Sign up", tone = "light", short }: {
  list: "NEWSLETTER" | "IOS_LAUNCH"; source: string; promise: string; siteKey: string | null; cta?: string; tone?: "light" | "card";
  /** A one-line note instead of the full one (the footer); the confirmation email still spells everything out */
  short?: string;
}) {
  const [state, dispatch, pending] = useActionState(subscribeAction, undefined);
  const id = `sub-${source}`;
  if (state?.ok) {
    return <p className={`sub-done sub-${tone}`} role="status"><MailCheck aria-hidden="true" />{state.ok}</p>;
  }
  return (
    <form
      className={`sub sub-${tone}`}
      noValidate
      action={async (form) => {
        if (siteKey) {
          const token = await recaptchaToken(siteKey, "subscribe");
          if (token) form.set("g-recaptcha-response", token);
        }
        dispatch(form);
      }}
    >
      <input type="hidden" name="list" value={list} />
      <input type="hidden" name="source" value={source} />
      <label htmlFor={id} className="sr-only">Email address</label>
      <div className="sub-row">
        <input id={id} name="email" type="email" autoComplete="email" inputMode="email" required placeholder="you@example.com"
          defaultValue={state?.email ?? ""} aria-invalid={state?.error ? true : undefined} aria-describedby={`${id}-note`} />
        <button disabled={pending}>{pending ? "Sending…" : cta}{pending ? null : <ArrowRight aria-hidden="true" />}</button>
      </div>
      {state?.error ? <p className="sub-error" role="alert">{state.error}</p> : null}
      <p className="sub-note" id={`${id}-note`}>
        {/* The footer's Company column already links /privacy, so the short note doesn't repeat it */}
        {short ?? <>You&apos;ll get {promise}. We&apos;ll email you a link to confirm first, and every email has an unsubscribe link that deletes your address. <Link href="/privacy#mailing-lists">How we use your email</Link></>}
      </p>
      {siteKey ? (
        <p className="sub-note sub-captcha">
          Protected by reCAPTCHA; Google&apos;s <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">policies</a> apply.
        </p>
      ) : null}
    </form>
  );
}
