"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { authenticate, createSession, destroySession, hashPassword, requireUser } from "@/lib/auth";
import { LIMITS, clientIpFrom, enforce, hit, ipKey } from "@/lib/rate-limit";
import { requestPasswordResetQuietly, resetPassword } from "@/lib/password-reset";
import { type VerifyResult, sendVerificationEmail, sendVerificationEmailQuietly, verifyEmailToken } from "@/lib/email-verification";
import { ServiceError } from "@/lib/errors";
import { RegisterSchema, createFamily } from "@/lib/family-service";

export type FormState = { error?: string; ok?: string; fields?: Record<string, string> } | undefined;

const LoginSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address."), password: z.string().min(1, "Enter your password.") });

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = LoginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  const email = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { email } };
  let userId: string;
  try {
    userId = (await authenticate(parsed.data.email, parsed.data.password, clientIpFrom(await headers()))).id;
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message, fields: { email } };
    throw e;
  }
  await createSession(userId);
  redirect("/dashboard");
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
    userId = (await createFamily({ ...parsed.data, passwordHash: await hashPassword(parsed.data.password) })).id;
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message, fields };
    throw e;
  }
  after(() => sendVerificationEmailQuietly(userId));
  await createSession(userId);
  redirect("/dashboard");
}

/** The button on /verify-email. A POST, so mail scanners that open links don't use up the token. */
export async function verifyEmail(_: VerifyResult | undefined, form: FormData): Promise<VerifyResult> {
  if ((await hit(ipKey("token", clientIpFrom(await headers())), LIMITS.tokenIp)).limited) return "invalid";
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
  try {
    const user = await resetPassword(String(form.get("token") ?? ""), String(form.get("password") ?? ""), clientIpFrom(await headers()));
    await createSession(user.id);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  redirect("/dashboard");
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
