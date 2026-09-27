"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login, register } from "@/app/actions/auth";
import { Icon } from "./icon";

function ErrorBox({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="form-error" role="alert"><Icon name="triangle-alert" />{error}</div>;
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="auth-head">
      <h1>{title}</h1>
      <p>{sub}</p>
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; icon: string };

function IconInput({ label, icon, id, ...rest }: InputProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-input">
        <Icon name={icon} />
        <input className="input" id={id} name={id} {...rest} />
      </div>
    </div>
  );
}

function PasswordInput({ label, id, children, ...rest }: Omit<InputProps, "icon" | "type"> & { children?: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-input">
        <Icon name="lock" />
        <input className="input" id={id} name={id} type={shown ? "text" : "password"} {...rest} />
        <button type="button" className="auth-reveal" onClick={() => setShown((s) => !s)} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown}>
          <Icon name={shown ? "eye-off" : "eye"} />
        </button>
      </div>
      {children}
    </div>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="auth-form" noValidate>
      <Header title="Welcome back" sub="Sign in to manage your family's digital safety." />
      <ErrorBox error={state?.error} />
      <IconInput id="email" label="Email address" icon="mail" type="email" autoComplete="email" placeholder="you@example.com" required defaultValue={state?.fields?.email ?? ""} />
      <PasswordInput id="password" label="Password" autoComplete="current-password" placeholder="Enter your password" required />
      <button className="btn btn-primary auth-submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="auth-foot">Don&apos;t have an account? <Link href="/register">Create account</Link></p>
      {process.env.NODE_ENV !== "production" ? (
        <p className="dev-banner"><Icon name="info" />Demo account: randy@example.com / ChangeMe123!</p>
      ) : null}
    </form>
  );
}

const MIN_PASSWORD = 10;

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);
  const [password, setPassword] = useState("");
  const f = state?.fields ?? {};
  const longEnough = password.length >= MIN_PASSWORD;
  return (
    <form action={action} className="auth-form" noValidate>
      <Header title="Create your account" sub="Start your family's digital safety journey today." />
      <ErrorBox error={state?.error} />
      <IconInput id="name" label="Full name" icon="user" autoComplete="name" placeholder="Your full name" required defaultValue={f.name} />
      <IconInput id="familyName" label="Family name" icon="users" placeholder="The Cruz Family" required defaultValue={f.familyName} />
      <IconInput id="email" label="Email address" icon="mail" type="email" autoComplete="email" placeholder="you@example.com" required defaultValue={f.email} />
      <PasswordInput
        id="password" label="Password" autoComplete="new-password" placeholder="Create a password" minLength={MIN_PASSWORD} required
        aria-describedby="pw-rules" value={password} onChange={(e) => setPassword(e.target.value)}
      >
        <ul className="auth-rules" id="pw-rules">
          <li data-ok={longEnough}><Icon name={longEnough ? "circle-check" : "circle-dashed"} />At least {MIN_PASSWORD} characters</li>
        </ul>
      </PasswordInput>
      <label className="check">
        <input type="checkbox" name="guardian" required defaultChecked={f.guardian === "on"} />
        <span>I&apos;m a parent or legal guardian, 18 or older. Children don&apos;t need their own account — you&apos;ll add them after sign-up.</span>
      </label>
      <button className="btn btn-primary auth-submit" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
      <p className="auth-foot">Already have an account? <Link href="/login">Sign in</Link></p>
    </form>
  );
}
