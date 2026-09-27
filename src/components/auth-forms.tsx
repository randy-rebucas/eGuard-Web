"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { forgotPassword, login, register, resetPasswordWithToken } from "@/app/actions/auth";
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
      <PasswordInput id="password" label="Password" autoComplete="current-password" placeholder="Enter your password" required>
        <Link className="auth-forgot" href="/forgot-password">Forgot password?</Link>
      </PasswordInput>
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

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPassword, undefined);
  if (state?.ok) {
    return (
      <div className="auth-form">
        <Header title="Check your email" sub={state.ok} />
        <p className="auth-foot"><Link href="/login">Back to sign in</Link></p>
      </div>
    );
  }
  return (
    <form action={action} className="auth-form" noValidate>
      <Header title="Forgot your password?" sub="Enter your email and we'll send you a link to choose a new one." />
      <ErrorBox error={state?.error} />
      <IconInput id="email" label="Email address" icon="mail" type="email" autoComplete="email" placeholder="you@example.com" required defaultValue={state?.fields?.email ?? ""} />
      <button className="btn btn-primary auth-submit" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
      <p className="auth-foot">Remembered it? <Link href="/login">Sign in</Link></p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordWithToken, undefined);
  const [password, setPassword] = useState("");
  const longEnough = password.length >= MIN_PASSWORD;
  if (!token) {
    return (
      <div className="auth-form">
        <Header title="This link doesn't work" sub="Open the link from your email again, or ask for a new one." />
        <Link className="btn btn-primary auth-submit" href="/forgot-password">Send a new link</Link>
      </div>
    );
  }
  return (
    <form action={action} className="auth-form" noValidate>
      <Header title="Choose a new password" sub="You'll be signed out everywhere else, then signed in here." />
      <ErrorBox error={state?.error} />
      <input type="hidden" name="token" value={token} />
      <PasswordInput
        id="password" label="New password" autoComplete="new-password" placeholder="Create a password" minLength={MIN_PASSWORD} required
        aria-describedby="pw-rules" value={password} onChange={(e) => setPassword(e.target.value)}
      >
        <ul className="auth-rules" id="pw-rules">
          <li data-ok={longEnough}><Icon name={longEnough ? "circle-check" : "circle-dashed"} />At least {MIN_PASSWORD} characters</li>
        </ul>
      </PasswordInput>
      <button className="btn btn-primary auth-submit" disabled={pending}>{pending ? "Saving…" : "Save password"}</button>
      {state?.error ? <p className="auth-foot"><Link href="/forgot-password">Send a new link</Link></p> : null}
    </form>
  );
}
