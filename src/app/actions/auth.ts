"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { authenticate, clearCookie, createSession, destroySession, requireUser } from "@/lib/auth";
import { BOT_CHECK_FIELD, verifyHuman } from "@/lib/bot-check";
import { SIGNUP_COOKIE, finishSignup, resendSignupCode, startSignup } from "@/lib/signup";
import { CHALLENGE_COOKIE, completeChallenge, needsSecondStep } from "@/lib/two-factor";
import { toSecondStep } from "@/lib/web-signin";
import { LIMITS, clientIpFrom, enforce, hit, ipKey } from "@/lib/rate-limit";
import { requestPasswordResetQuietly, resetPassword } from "@/lib/password-reset";
import { type VerifyResult, sendVerificationEmail, verifyEmailToken } from "@/lib/email-verification";
import { ServiceError } from "@/lib/errors";
import { RegisterSchema } from "@/lib/family-service";
import { safeNext } from "@/lib/return-to";
import { acceptInvite, declineInvite } from "@/lib/invitations";

export type FormState = { error?: string; ok?: string; fields?: Record<string, string> } | undefined;

const LoginSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address."), password: z.string().min(1, "Enter your password.") });

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = LoginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  const email = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { email } };
  let user: Awaited<ReturnType<typeof authenticate>>;
  try {
    const ip = clientIpFrom(await headers());
    await verifyHuman(form.get(BOT_CHECK_FIELD), ip, "login");
    user = await authenticate(parsed.data.email, parsed.data.password, ip);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message, fields: { email } };
    throw e;
  }
  // Checked again here: the hidden field is whatever the browser sent
  const next = safeNext(form.get("next"));
  if (needsSecondStep(user)) await toSecondStep(user.id, next);
  await createSession(user.id);
  redirect(next ?? "/dashboard");
}

/* ---------- Two-step verification ---------- */

/** /login/two-step: the authenticator code or a recovery code, then the session. */
export async function verifySecondStep(_: FormState, form: FormData): Promise<FormState> {
  const jar = await cookies();
  const challenge = jar.get(CHALLENGE_COOKIE)?.value;
  if (!challenge) redirect("/login");
  const code = String(form.get("code") ?? "").trim();
  if (!code) return { error: "Enter the code from your authenticator app." };
  let done: Awaited<ReturnType<typeof completeChallenge>>;
  try {
    done = await completeChallenge(challenge, code);
  } catch (e) {
    if (e instanceof ServiceError) {
      // Expired or out of attempts: the challenge is gone, so the form can't be used again
      if (e.code === "challenge_expired") await clearCookie(CHALLENGE_COOKIE);
      return { error: e.message, fields: e.code === "challenge_expired" ? { expired: "1" } : undefined };
    }
    throw e;
  }
  await clearCookie(CHALLENGE_COOKIE);
  await createSession(done.user.id);
  // A recovery code is gone once used: say so where new ones can be made
  if (done.usedRecoveryCode) redirect(`/settings/security?recovery=${done.recoveryCodesLeft ?? 0}`);
  redirect(safeNext(form.get("next")) ?? "/dashboard");
}

/**
 * Create account, step 1 (lib/signup): stores the sign-up and emails a code, then on to /register/verify. Looks the
 * same whether or not the email already has an account.
 */
export async function register(_: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(["name", "familyName", "email", "password"].map((k) => [k, String(form.get(k) ?? "")]));
  const guardian = form.get("guardian") === "on";
  const parsed = RegisterSchema.safeParse({ ...raw, guardian });
  const fields = { name: raw.name, familyName: raw.familyName, email: raw.email, guardian: guardian ? "on" : "" };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  try {
    const ip = clientIpFrom(await headers());
    await verifyHuman(form.get(BOT_CHECK_FIELD), ip, "register");
    // Only the hash is stored: the plain password stops here
    const { name, familyName, email, password } = parsed.data;
    const { ticket, expiresAt } = await startSignup({ name, familyName, email, password }, ip);
    (await cookies()).set(SIGNUP_COOKIE, ticket, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt,
    });
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message, fields };
    throw e;
  }
  redirect("/register/verify");
}

/** Create account, step 2: the emailed code. Creates the family, signs in, and opens the dashboard. */
export async function verifySignup(_: FormState, form: FormData): Promise<FormState> {
  const jar = await cookies();
  const ticket = jar.get(SIGNUP_COOKIE)?.value;
  if (!ticket) return { error: "This sign-up has expired. Fill in the form again to get a new code.", fields: { expired: "1" } };
  const code = String(form.get("code") ?? "").trim();
  if (!code) return { error: "Enter the 6-digit code from the email." };
  let userId: string;
  try {
    userId = (await finishSignup(ticket, code, clientIpFrom(await headers()))).id;
  } catch (e) {
    if (e instanceof ServiceError) {
      if (e.code === "signup_expired") await clearCookie(SIGNUP_COOKIE);
      return { error: e.message, fields: e.code === "signup_expired" ? { expired: "1" } : undefined };
    }
    throw e;
  }
  await clearCookie(SIGNUP_COOKIE);
  await createSession(userId);
  redirect("/dashboard");
}

/** "Send a new code" on /register/verify */
export async function resendSignup(): Promise<FormState> {
  const jar = await cookies();
  const ticket = jar.get(SIGNUP_COOKIE)?.value;
  if (!ticket) return { error: "This sign-up has expired. Fill in the form again to get a new code.", fields: { expired: "1" } };
  try {
    const { email, expiresAt } = await resendSignupCode(ticket);
    jar.set(SIGNUP_COOKIE, ticket, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
    return { ok: `We sent a new code to ${email}. Only the newest code works.` };
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message, fields: e.code === "signup_expired" ? { expired: "1" } : undefined };
    throw e;
  }
}

/** The button on /verify-email. A POST, so mail scanners that open links don't use up the token. */
export async function verifyEmail(_: VerifyResult | "limited" | undefined, form: FormData): Promise<VerifyResult | "limited"> {
  // Not "invalid": that page says the link may already be used, which would wrongly tell the parent they're done
  if ((await hit(ipKey("token", clientIpFrom(await headers())), LIMITS.tokenIp)).limited) return "limited";
  return verifyEmailToken(String(form.get("token") ?? ""));
}

/** /forgot-password. Says the same thing whether or not the account exists. */
export async function forgotPassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.string().trim().toLowerCase().email("Enter a valid email address.").safeParse(form.get("email"));
  const email = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { email } };
  const ip = clientIpFrom(await headers());
  try {
    await verifyHuman(form.get(BOT_CHECK_FIELD), ip, "reset");
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message, fields: { email } };
    throw e;
  }
  if ((await hit(ipKey("reset", ip), LIMITS.resetIp)).limited) return { error: "Too many requests. Try again in an hour.", fields: { email } };
  after(() => requestPasswordResetQuietly(parsed.data, null));
  return { ok: `If an eGuard account uses ${parsed.data}, we sent it a link to reset the password. It expires in an hour.` };
}

/** /reset-password: sets the new password, signs out every session, then signs in here. */
export async function resetPasswordWithToken(_: FormState, form: FormData): Promise<FormState> {
  let user: Awaited<ReturnType<typeof resetPassword>>;
  try {
    user = await resetPassword(String(form.get("token") ?? ""), String(form.get("password") ?? ""), clientIpFrom(await headers()));
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  // The new password is saved, but an emailed link alone mustn't get past two-step verification
  if (needsSecondStep(user)) await toSecondStep(user.id, null);
  await createSession(user.id);
  redirect("/dashboard");
}

/** /accept-invite: chooses a password, joins the family, and signs in here. */
export async function acceptInvitation(_: FormState, form: FormData): Promise<FormState> {
  try {
    await enforce(ipKey("token", clientIpFrom(await headers())), LIMITS.tokenIp);
    const user = await acceptInvite(String(form.get("token") ?? ""), String(form.get("password") ?? ""));
    await createSession(user.id);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  redirect("/dashboard");
}

/** /accept-invite › Decline: nothing about the person stays with that family. */
export async function declineInvitation(_: FormState, form: FormData): Promise<FormState> {
  try {
    await enforce(ipKey("token", clientIpFrom(await headers())), LIMITS.tokenIp);
    const { familyName } = await declineInvite(String(form.get("token") ?? ""));
    return { ok: `You declined the invitation to ${familyName}. Nothing was set up, and they can't add you without a new invitation.` };
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
}

/** "Resend link" on the verify-your-email banner. */
export async function resendVerificationEmail(): Promise<FormState> {
  const u = await requireUser();
  try {
    const sent = await sendVerificationEmail(u.id, { throttle: true });
    return { ok: sent ? `We sent a new link to ${u.email}.` : "Your email is already verified." };
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
