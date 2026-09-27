"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  clearLoginFailures, createSession, destroySession, hashPassword, loginRateLimited, noteLoginFailure, requireUser, verifyPassword,
} from "@/lib/auth";
import { type VerifyResult, sendVerificationEmail, sendVerificationEmailQuietly, verifyEmailToken } from "@/lib/email-verification";
import { ServiceError } from "@/lib/errors";
import { RegisterSchema, createFamily } from "@/lib/family-service";

export type FormState = { error?: string; ok?: string; fields?: Record<string, string> } | undefined;

const LoginSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address."), password: z.string().min(1, "Enter your password.") });

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = LoginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  const email = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { email } };
  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  const key = `${parsed.data.email}|${ip}`;
  if (loginRateLimited(key)) return { error: "Too many attempts. Wait 10 minutes and try again.", fields: { email } };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    noteLoginFailure(key);
    return { error: "That email and password don't match an eGuard account.", fields: { email } };
  }
  clearLoginFailures(key);
  await createSession(user.id);
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
  return verifyEmailToken(String(form.get("token") ?? ""));
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
