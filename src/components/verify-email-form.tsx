"use client";

import Link from "next/link";
import { useActionState } from "react";
import { verifyEmail } from "@/app/actions/auth";
// Its own four icons, not ./icon, so this one-off page doesn't download the app's whole icon set
import { BadgeCheck, Hourglass, Mail, TriangleAlert } from "lucide-react";

const ico = { "aria-hidden": true, strokeWidth: 1.75, style: { width: 36, height: 36 } } as const;

const RESULT = {
  verified: { Icon: BadgeCheck, title: "Email verified", body: "You're all set. You can now pair your children's devices." },
  expired: { Icon: Hourglass, title: "This link has expired", body: "Sign in and choose “Resend link” to get a new one." },
  invalid: { Icon: TriangleAlert, title: "This link doesn't work", body: "It may have been used already, or replaced by a newer link. If you've verified, you're all set." },
} as const;

export function VerifyEmailForm({ token }: { token: string }) {
  const [result, action, pending] = useActionState(verifyEmail, token ? undefined : "invalid");
  if (result) {
    const r = RESULT[result];
    return (
      <div className="verify-card-body">
        <r.Icon {...ico} />
        <h1>{r.title}</h1>
        <p>{r.body}</p>
        <Link className="btn btn-primary" href="/dashboard">Go to eGuard</Link>
      </div>
    );
  }
  return (
    <form action={action} className="verify-card-body">
      <Mail {...ico} />
      <h1>Verify your email</h1>
      <p>Confirm this is your email address to finish setting up eGuard.</p>
      <input type="hidden" name="token" value={token} />
      <button className="btn btn-primary" disabled={pending}>{pending ? "Verifying…" : "Verify my email"}</button>
    </form>
  );
}
