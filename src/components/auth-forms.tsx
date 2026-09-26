"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/app/actions/auth";
import { Icon } from "./icon";

function ErrorBox({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="form-error" role="alert"><Icon name="triangle-alert" />{error}</div>;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="auth-form" noValidate>
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 600 }}>Sign in</h1>
        <p className="muted" style={{ marginTop: 6 }}>Welcome back. Check your family&apos;s protections.</p>
      </div>
      <ErrorBox error={state?.error} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="t-meta">New to eGuard? <Link className="inline-link" href="/register">Create a family account</Link></p>
      {process.env.NODE_ENV !== "production" ? (
        <p className="dev-banner"><Icon name="info" />Demo account: randy@example.com / ChangeMe123!</p>
      ) : null}
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="auth-form" noValidate>
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 600 }}>Create your family account</h1>
        <p className="muted" style={{ marginTop: 6 }}>You&apos;ll be the family admin. You can invite another parent later.</p>
      </div>
      <ErrorBox error={state?.error} />
      <div className="field"><label htmlFor="name">Your name</label><input className="input" id="name" name="name" autoComplete="name" required defaultValue={f.name} /></div>
      <div className="field"><label htmlFor="familyName">Family name</label><input className="input" id="familyName" name="familyName" placeholder="The Cruz Family" required defaultValue={f.familyName} /></div>
      <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required defaultValue={f.email} /></div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={10} required aria-describedby="pw-hint" />
        <span className="field-hint" id="pw-hint">At least 10 characters.</span>
      </div>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
      <p className="t-meta">Already have an account? <Link className="inline-link" href="/login">Sign in</Link></p>
    </form>
  );
}
