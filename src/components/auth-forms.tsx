"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { type FormState, acceptInvitation, declineInvitation, forgotPassword, login, register, resendSignup, resetPasswordWithToken, verifySecondStep, verifySignup } from "@/app/actions/auth";
import type { WebProvider } from "@/lib/oauth-web";
import { GoogleMark, LinkedInMark } from "./brand-marks";
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

declare global {
  interface Window {
    grecaptcha?: { ready: (cb: () => void) => void; execute: (siteKey: string, o: { action: string }) => Promise<string> };
  }
}

let recaptchaScript: Promise<void> | undefined;
function loadRecaptcha(siteKey: string) {
  return (recaptchaScript ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    s.async = true;
    s.onload = () => window.grecaptcha?.ready(() => resolve());
    s.onerror = () => { recaptchaScript = undefined; reject(new Error("reCAPTCHA didn't load")); };
    document.head.appendChild(s);
  }));
}

/** A token lasts 2 minutes, so the field gets a new one before then. */
const RECAPTCHA_REFRESH_MS = 90_000;

/**
 * Google reCAPTCHA v3 (lib/bot-check): keeps a token for this form's `action` in a hidden field, from when the page
 * opens, refreshed before it expires and after each try (`resetOn`, the form's last result), since a token works
 * once. Nothing to click. Google's badge is hidden (auth.css), so the notice its terms ask for is shown instead.
 */
function BotCheck({ siteKey, action, resetOn }: { siteKey?: string | null; action: string; resetOn?: unknown }) {
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!siteKey) return;
    let gone = false;
    const refresh = () => loadRecaptcha(siteKey)
      .then(() => window.grecaptcha!.execute(siteKey, { action }))
      .then((token) => { if (!gone && field.current) field.current.value = token; })
      .catch(() => {});
    void refresh();
    const timer = setInterval(refresh, RECAPTCHA_REFRESH_MS);
    return () => { gone = true; clearInterval(timer); };
  }, [siteKey, action, resetOn]);
  if (!siteKey) return null;
  return (
    <>
      <input type="hidden" name="g-recaptcha-response" ref={field} />
      <p className="auth-recaptcha">
        Protected by reCAPTCHA. Google&apos;s <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and{" "}
        <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> apply.
      </p>
    </>
  );
}

const SOCIAL: Record<WebProvider, { label: string; Mark: () => React.ReactElement }> = {
  google: { label: "Google", Mark: GoogleMark },
  linkedin: { label: "LinkedIn", Mark: LinkedInMark },
};

/**
 * "Continue with Google / LinkedIn": plain forms posting to /auth/<provider>, which sends the browser on to the
 * provider. `blocked`: why it can't start yet (create account's guardian confirmation), shown instead of leaving.
 */
function SocialSignIn({ providers, intent, next = "", guardian = false, blocked }: {
  providers: WebProvider[]; intent: "login" | "register"; next?: string; guardian?: boolean; blocked?: () => boolean;
}) {
  const [leaving, setLeaving] = useState<WebProvider | null>(null);
  // Back from the provider's page restores this one from the back/forward cache, buttons still disabled
  useEffect(() => {
    const restored = (e: PageTransitionEvent) => { if (e.persisted) setLeaving(null); };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);
  if (!providers.length) return null;
  return (
    <>
      <div className="auth-social">
        {providers.map((p) => {
          const { label, Mark } = SOCIAL[p];
          return (
            <form key={p} method="post" action={`/auth/${p}`} onSubmit={(e) => {
              if (blocked?.()) e.preventDefault();
              else setLeaving(p);
            }}>
              <input type="hidden" name="intent" value={intent} />
              {next ? <input type="hidden" name="next" value={next} /> : null}
              {guardian ? <input type="hidden" name="guardian" value="on" /> : null}
              <button className="auth-social-btn" disabled={leaving !== null}><Mark />{leaving === p ? `Opening ${label}…` : `Continue with ${label}`}</button>
            </form>
          );
        })}
      </div>
      <div className="auth-or">or</div>
    </>
  );
}

/** Why a Google / LinkedIn sign-in came back here (lib/oauth-errors) */
function Notice({ text }: { text?: string | null }) {
  if (!text) return null;
  return <div className="auth-notice" role="status"><Icon name="info" /><span>{text}</span></div>;
}

/**
 * `next`: the signed-in page to return to after signing in (already checked by safeNext on the server).
 * `providers`: the Google / LinkedIn sign-ins set up on this server; `notice`: why one came back without signing in.
 */
export function LoginForm({ next = "", providers = [], notice, botCheck }: { next?: string; providers?: WebProvider[]; notice?: string | null; botCheck?: string | null }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <div className="auth-form">
      <Header title="Welcome back" sub={next ? "Sign in to continue where you left off." : "Sign in to manage your family's digital safety."} />
      {state?.error ? <ErrorBox error={state.error} /> : <Notice text={notice} />}
      <SocialSignIn providers={providers} intent="login" next={next} />
      <form action={action} className="auth-fields" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <IconInput id="email" label="Email address" icon="mail" type="email" autoComplete="email" placeholder="you@example.com" required defaultValue={state?.fields?.email ?? ""} />
        <PasswordInput id="password" label="Password" autoComplete="current-password" placeholder="Enter your password" required>
          <Link className="auth-forgot" href="/forgot-password">Forgot password?</Link>
        </PasswordInput>
        <BotCheck siteKey={botCheck} action="login" resetOn={state} />
        <button className="btn btn-primary auth-submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      </form>
      {/* Apple sign-in is app-only, so an account made that way has no password on the website yet */}
      {state?.error ? (
        <p className="auth-foot">Signed up in the eGuard app with Apple? <Link href="/forgot-password">Set a password</Link> to sign in here.</p>
      ) : null}
      <p className="auth-foot">Don&apos;t have an account? <Link href="/register">Create account</Link></p>
      {process.env.NODE_ENV !== "production" ? (
        <p className="dev-banner"><Icon name="info" />Demo account: randy@example.com / ChangeMe123!</p>
      ) : null}
    </div>
  );
}

/** /login/two-step: the authenticator code, or a recovery code for a parent without their phone. */
export function TwoStepForm({ next = "" }: { next?: string }) {
  const [state, action, pending] = useActionState(verifySecondStep, undefined);
  const [recovery, setRecovery] = useState(false);
  if (state?.fields?.expired) {
    return (
      <div className="auth-form">
        <Header title="Sign in again" sub={state.error ?? "This sign-in expired."} />
        <Link className="btn btn-primary auth-submit" href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Back to sign in</Link>
      </div>
    );
  }
  return (
    <form action={action} className="auth-form" noValidate>
      <Header title="Two-step verification" sub={recovery ? "Enter one of the recovery codes you saved when you turned this on. Each works once." : "Enter the 6-digit code from your authenticator app."} />
      <ErrorBox error={state?.error} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {recovery ? (
        <IconInput key="rc" id="code" label="Recovery code" icon="key-round" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="xxxx-xxxx-xxxx" required autoFocus />
      ) : (
        <IconInput key="otp" id="code" label="Verification code" icon="shield-check" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} placeholder="123456" required autoFocus />
      )}
      <button className="btn btn-primary auth-submit" disabled={pending}>{pending ? "Checking…" : "Verify and sign in"}</button>
      <p className="auth-foot">
        <button type="button" className="link-btn" onClick={() => setRecovery((r) => !r)}>{recovery ? "Use the authenticator app instead" : "Can't use your app? Use a recovery code"}</button>
      </p>
      <p className="auth-foot">Lost your phone and your recovery codes? Email eGuard support from your account&apos;s address. <Link href="/login">Start over</Link></p>
    </form>
  );
}

const MIN_PASSWORD = 10;

export function RegisterForm({ providers = [], notice, botCheck }: { providers?: WebProvider[]; notice?: string | null; botCheck?: string | null }) {
  const [state, action, pending] = useActionState(register, undefined);
  const [password, setPassword] = useState("");
  const f = state?.fields ?? {};
  const [guardian, setGuardian] = useState(f.guardian === "on");
  const [needGuardian, setNeedGuardian] = useState(false);
  const guardianRef = useRef<HTMLInputElement>(null);
  const longEnough = password.length >= MIN_PASSWORD;
  // A new account from Google / LinkedIn needs the same confirmation as one made with the form
  const blocked = () => {
    if (guardian) return false;
    setNeedGuardian(true);
    guardianRef.current?.focus();
    return true;
  };
  // With Google / LinkedIn offered it comes first, since it covers them too; `form` keeps it in the form's data
  const guardianBox = (
    <label className="check">
      <input type="checkbox" name="guardian" form="register-form" required ref={guardianRef} checked={guardian} onChange={(e) => setGuardian(e.target.checked)} />
      <span>I&apos;m a parent or legal guardian, 18 or older. Children don&apos;t need their own account — you&apos;ll add them after sign-up.</span>
    </label>
  );
  return (
    <div className="auth-form">
      <Header title="Create your account" sub="Start your family's digital safety journey today." />
      {state?.error ? <ErrorBox error={state.error} /> : <Notice text={notice} />}
      {needGuardian && !guardian ? <ErrorBox error="Confirm you're a parent or legal guardian, 18 or older, first." /> : null}
      {providers.length ? guardianBox : null}
      <SocialSignIn providers={providers} intent="register" guardian={guardian} blocked={blocked} />
      <form action={action} id="register-form" className="auth-fields" noValidate>
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
        {providers.length ? null : guardianBox}
        <BotCheck siteKey={botCheck} action="register" resetOn={state} />
        <button className="btn btn-primary auth-submit" disabled={pending}>{pending ? "Sending your code…" : "Create account"}</button>
      </form>
      <p className="auth-foot">Already have an account? <Link href="/login">Sign in</Link></p>
    </div>
  );
}

type Stamped = (FormState & { at?: number }) | undefined;
/** Stamps an action's result, so a page with two forms can show whichever answered last. */
const stamped = (fn: (s: FormState, f: FormData) => Promise<FormState>) =>
  async (s: Stamped, f: FormData): Promise<Stamped> => ({ ...(await fn(s, f)), at: Date.now() });
const verifyStamped = stamped(verifySignup);
const resendStamped = stamped(() => resendSignup());

/** /register/verify: the 6-digit code emailed by the create-account form (lib/signup). */
export function VerifySignupForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(verifyStamped, undefined);
  const [resent, resend, resending] = useActionState(resendStamped, undefined);
  const latest = (state?.at ?? 0) > (resent?.at ?? 0) ? state : resent;
  if (latest?.fields?.expired) {
    return (
      <div className="auth-form">
        <Header title="Start again" sub={latest.error ?? "This sign-up expired."} />
        <Link className="btn btn-primary auth-submit" href="/register">Back to create account</Link>
      </div>
    );
  }
  return (
    <div className="auth-form">
      <Header title="Check your email" sub={`We sent a 6-digit code to ${email}. Enter it to finish creating your account.`} />
      {latest?.error ? <ErrorBox error={latest.error} /> : <Notice text={latest?.ok} />}
      <form action={action} className="auth-fields" noValidate>
        <IconInput id="code" label="Code" icon="mail" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} placeholder="123456" required autoFocus />
        <button className="btn btn-primary auth-submit" disabled={pending}>{pending ? "Checking…" : "Create account"}</button>
      </form>
      <form action={resend}>
        <p className="auth-foot">
          Nothing after a minute? Check your spam folder, or{" "}
          <button className="link-btn" disabled={resending}>{resending ? "sending…" : "send a new code"}</button>.
        </p>
      </form>
      <p className="auth-foot">Wrong email? <Link href="/register">Start again</Link></p>
    </div>
  );
}

export function ForgotPasswordForm({ botCheck }: { botCheck?: string | null }) {
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
      <BotCheck siteKey={botCheck} action="reset" resetOn={state} />
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

type Invite = { name: string; email: string; familyName: string; invitedBy: string | null };

/** /accept-invite: says which family it is before anything happens, then accept (with a password) or decline. */
export function AcceptInviteForm({ token, invite }: { token: string; invite: Invite }) {
  const [state, action, pending] = useActionState(acceptInvitation, undefined);
  const [declined, decline, declining] = useActionState(declineInvitation, undefined);
  const [password, setPassword] = useState("");
  const longEnough = password.length >= MIN_PASSWORD;
  if (declined?.ok) {
    return (
      <div className="auth-form">
        <Header title="Invitation declined" sub={declined.ok} />
        <p className="auth-foot">Want eGuard for your own family? <Link href="/register">Create an account</Link></p>
      </div>
    );
  }
  const busy = pending || declining;
  return (
    <div className="auth-form">
      <Header title={`Join ${invite.familyName}`}
        sub={`${invite.invitedBy ?? "The family admin"} invited you (${invite.email}) to help manage this family's protections on eGuard. You'll see the children, their devices and alerts.`} />
      <ErrorBox error={state?.error ?? declined?.error} />
      <form action={action} className="auth-form" noValidate style={{ padding: 0 }}>
        <input type="hidden" name="token" value={token} />
        <PasswordInput
          id="password" label="Choose your password" autoComplete="new-password" placeholder="Create a password" minLength={MIN_PASSWORD} required
          aria-describedby="pw-rules" value={password} onChange={(e) => setPassword(e.target.value)}
        >
          <ul className="auth-rules" id="pw-rules">
            <li data-ok={longEnough}><Icon name={longEnough ? "circle-check" : "circle-dashed"} />At least {MIN_PASSWORD} characters</li>
          </ul>
        </PasswordInput>
        <button className="btn btn-primary auth-submit" disabled={busy}>{pending ? "Joining…" : `Accept and join ${invite.familyName}`}</button>
      </form>
      <form action={decline}>
        <input type="hidden" name="token" value={token} />
        <button className="btn btn-ghost auth-submit" disabled={busy}>{declining ? "Declining…" : "Decline"}</button>
      </form>
      <p className="auth-foot">Don&apos;t know this family? Decline, or ignore the email. Nothing is set up until you accept.</p>
    </div>
  );
}
