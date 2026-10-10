"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { authenticate, createSession, destroySession, hashPassword, requireUser } from "@/lib/auth";
import { CHALLENGE_COOKIE, completeChallenge, needsSecondStep, startChallenge } from "@/lib/two-factor";
import { LIMITS, clientIpFrom, enforce, hit, ipKey } from "@/lib/rate-limit";
import { requestPasswordResetQuietly, resetPassword } from "@/lib/password-reset";
import { type VerifyResult, sendVerificationEmail, sendVerificationEmailLater, verifyEmailToken } from "@/lib/email-verification";
import { ServiceError } from "@/lib/errors";
import { RegisterSchema, createFamily } from "@/lib/family-service";
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
    user = await authenticate(parsed.data.email, parsed.data.password, clientIpFrom(await headers()));
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

/** The password (or reset link) checked out and a code is needed: no session yet, just the challenge. */
async function toSecondStep(userId: string, next: string | null): Promise<never> {
  const { challenge, expiresAt } = await startChallenge(userId);
  (await cookies()).set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt,
  });
  redirect(`/login/two-step${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}

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
      if (e.code === "challenge_expired") jar.delete(CHALLENGE_COOKIE);
      return { error: e.message, fields: e.code === "challenge_expired" ? { expired: "1" } : undefined };
    }
    throw e;
  }
  jar.delete(CHALLENGE_COOKIE);
  await createSession(done.user.id);
  // A recovery code is gone once used: say so where new ones can be made
  if (done.usedRecoveryCode) redirect(`/settings/security?recovery=${done.recoveryCodesLeft ?? 0}`);
  redirect(safeNext(form.get("next")) ?? "/dashboard");
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(["name", "familyName", "email", "password"].map((k) => [k, String(form.get(k) ?? "")]));
  const guardian = form.get("guardian") === "on";
  const parsed = RegisterSchema.safeParse({ ...raw, guardian });
  const fields = { name: raw.name, familyName: raw.familyName, email: raw.email, guardian: guardian ? "on" : "" };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  let userId: string;
  try {
    await enforce(ipKey("signup", clientIpFrom(await headers())), LIMITS.signupIp);
    // Only the hash goes on: the plain password stops here
    const { name, familyName, email, password } = parsed.data;
    userId = (await createFamily({ name, familyName, email, passwordHash: await hashPassword(password) })).id;
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message, fields };
    throw e;
  }
  await sendVerificationEmailLater(userId);
  await createSession(userId);
  redirect("/dashboard");
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
