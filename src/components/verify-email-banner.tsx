"use client";

import { useActionState } from "react";
import { resendVerificationEmail } from "@/app/actions/auth";
import { Icon } from "./icon";

/** Shown across the app until the parent verifies their email; pairing a device waits on it. */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendVerificationEmail, undefined);
  return (
    <form action={action} className="verify-banner" role="status">
      <Icon name="mail" />
      <p>
        <strong>Verify your email to pair your children&apos;s devices.</strong>{" "}
        {state?.ok ?? state?.error ?? <>We sent a link to {email}.</>}
      </p>
      <button className="btn btn-secondary" disabled={pending}>{pending ? "Sending…" : "Resend link"}</button>
    </form>
  );
}
