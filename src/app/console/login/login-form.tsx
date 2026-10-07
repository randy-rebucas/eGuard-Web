"use client";

import { useActionState } from "react";
import { consoleLogin } from "@/app/actions/console";
import { Feedback } from "@/components/feedback";

export function ConsoleLoginForm() {
  const [state, action, pending] = useActionState(consoleLogin, undefined);
  return (
    <form action={action} className="cn-form" noValidate>
      <Feedback state={state} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="username" required defaultValue={state?.fields?.email ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="code">Authenticator code</label>
        <input className="input" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} placeholder="123456" required />
      </div>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
