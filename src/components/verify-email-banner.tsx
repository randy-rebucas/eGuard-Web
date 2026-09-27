"use client";

import { useActionState } from "react";
import { resendVerificationEmail } from "@/app/actions/auth";
import { Icon } from "./icon";

/** Shown across the app until the parent verifies their email; pairing a device waits on it. */
/** `linkSent` is false when no live link exists, e.g. the sign-up email failed to send. */
export function VerifyEmailBanner({ email, linkSent }: { email: string; linkSent: boolean }) {
  const [state, action, pending] = useActionState(resendVerificationEmail, undefined);
  const sent = linkSent || !!state?.ok;
  return (
    <form action={action} className="verify-banner" role="status">
      <Icon name="mail" />
      <p>
        <strong>Verify your email to pair your children&apos;s devices.</strong>{" "}
        {state?.ok ?? state?.error ?? (linkSent ? <>We sent a link to {email}.</> : <>We couldn&apos;t send a link to {email} yet. Send one now.</>)}
      </p>
      <button className="btn btn-secondary" disabled={pending}>{pending ? "Sending…" : sent ? "Resend link" : "Send link"}</button>
    </form>
  );
}
