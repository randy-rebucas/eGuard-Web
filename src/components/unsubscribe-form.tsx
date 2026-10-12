"use client";

import Link from "next/link";
import { useActionState } from "react";
import { unsubscribe } from "@/app/actions/email";
// Its own icons, not ./icon, so this one-off page doesn't download the app's whole icon set
import { Hourglass, MailCheck, MailX, TriangleAlert } from "lucide-react";

const ico = { "aria-hidden": true, strokeWidth: 1.75, style: { width: 36, height: 36 } } as const;

/**
 * Where a product update's "Unsubscribe" link lands. Nothing changes until the button is pressed, so a mail
 * scanner opening the link doesn't unsubscribe anyone.
 */
export function UnsubscribeForm({ token }: { token: string }) {
  const [result, action, pending] = useActionState(unsubscribe, token ? undefined : "invalid");
  if (result === "done") {
    return (
      <div className="verify-card-body">
        <MailCheck {...ico} />
        <h1>You&apos;re unsubscribed</h1>
        <p>You won&apos;t get product updates from eGuard any more. Alerts, your weekly summary and notices about your account still come as set in Settings › Notifications, where you can also turn product updates back on.</p>
        <Link className="btn btn-primary" href="/settings/notifications">Open Settings</Link>
      </div>
    );
  }
  if (result === "invalid") {
    return (
      <div className="verify-card-body">
        <TriangleAlert {...ico} />
        <h1>This link doesn&apos;t work</h1>
        <p>It may be incomplete. You can turn product updates off in Settings › Notifications.</p>
        <Link className="btn btn-primary" href="/settings/notifications">Open Settings</Link>
      </div>
    );
  }
  const limited = result === "limited";
  return (
    <form action={action} className="verify-card-body">
      {limited ? <Hourglass {...ico} /> : <MailX {...ico} />}
      <h1>{limited ? "Too many tries" : "Unsubscribe from product updates?"}</h1>
      <p role={limited ? "alert" : undefined}>
        {limited ? "Wait a few minutes, then try the button again." : "You'll stop getting emails about new eGuard features. Alerts, your weekly summary and notices about your account aren't affected."}
      </p>
      <input type="hidden" name="token" value={token} />
      <button className="btn btn-primary" disabled={pending}>{pending ? "Unsubscribing…" : "Unsubscribe"}</button>
    </form>
  );
}
