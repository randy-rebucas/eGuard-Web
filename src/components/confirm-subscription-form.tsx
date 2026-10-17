"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Hourglass, MailCheck, MailQuestion, TriangleAlert } from "lucide-react";
import { confirmAction } from "@/app/actions/subscribe";

const ico = { "aria-hidden": true, strokeWidth: 1.75, style: { width: 36, height: 36 } } as const;

/**
 * Where a mailing-list confirmation link lands. Nothing changes until the button is pressed, so a mail scanner
 * opening the link doesn't sign anyone up.
 */
export function ConfirmSubscriptionForm({ token }: { token: string }) {
  const [result, action, pending] = useActionState(confirmAction, token ? undefined : "invalid");
  if (result === "done") {
    return (
      <div className="verify-card-body">
        <MailCheck {...ico} />
        <h1>You&apos;re on the list</h1>
        <p>Thanks for confirming. Every email we send has an unsubscribe link, and using it deletes your address.</p>
        <Link className="btn btn-primary" href="/learn">Read our free guides</Link>
      </div>
    );
  }
  if (result === "invalid") {
    return (
      <div className="verify-card-body">
        <TriangleAlert {...ico} />
        <h1>This link doesn&apos;t work</h1>
        <p>It may have been used already, be incomplete, or be more than a week old. If you still want our emails, sign up again at the bottom of any page on eguard.family.</p>
        <Link className="btn btn-primary" href="/">Go to eguard.family</Link>
      </div>
    );
  }
  const limited = result === "limited";
  return (
    <form action={action} className="verify-card-body">
      {limited ? <Hourglass {...ico} /> : <MailQuestion {...ico} />}
      <h1>{limited ? "Too many tries" : "Confirm your email"}</h1>
      <p role={limited ? "alert" : undefined}>
        {limited ? "Wait a few minutes, then try the button again." : "Press the button to confirm you'd like emails from eGuard. If you didn't sign up, just close this page."}
      </p>
      <input type="hidden" name="token" value={token} />
      <button className="btn btn-primary" disabled={pending}>{pending ? "Confirming…" : "Confirm"}</button>
    </form>
  );
}
