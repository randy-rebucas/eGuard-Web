"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { closeTwoStepPrompt } from "@/app/actions/family";
import { Icon } from "./icon";

/**
 * On the dashboard of a family admin without two-step verification: theirs is the account that controls every child's
 * protections, so a stolen password matters most there. "Not now" hides it for 90 days.
 */
export function TwoStepPrompt() {
  const [closed, setClosed] = useState(false);
  const [pending, start] = useTransition();
  if (closed) return null;
  return (
    <div className="verify-banner info-banner" role="status">
      <Icon name="shield-check" />
      <p>
        <strong>Protect your family&apos;s account with two-step verification.</strong>{" "}
        You&apos;re the family admin, so anyone with your password could change every child&apos;s protections. A code from your phone stops them.
      </p>
      <Link className="btn btn-primary" href="/settings/security#two-step">Turn on</Link>
      <button className="btn btn-ghost" disabled={pending} onClick={() => start(async () => { await closeTwoStepPrompt(); setClosed(true); })}>Not now</button>
    </div>
  );
}
