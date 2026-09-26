"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  clearLoginFailures, createSession, destroySession, hashPassword, loginRateLimited, noteLoginFailure, verifyPassword,
} from "@/lib/auth";

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

const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  familyName: z.string().trim().min(2, "Enter a family name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters for your password."),
});

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(["name", "familyName", "email", "password"].map((k) => [k, String(form.get(k) ?? "")]));
  const parsed = RegisterSchema.safeParse(raw);
  const fields = { name: raw.name, familyName: raw.familyName, email: raw.email };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  if (await db.user.findUnique({ where: { email: parsed.data.email } })) {
    return { error: "An account with this email already exists. Sign in instead.", fields };
  }
  const renews = new Date(); renews.setMonth(renews.getMonth() + 1);
  const family = await db.family.create({
    data: {
      name: parsed.data.familyName, plan: "eGuard Plus", deviceLimit: 8, renewsAt: renews,
      users: { create: { name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password), role: "FAMILY_ADMIN" } },
    },
    include: { users: true },
  });
  await createSession(family.users[0].id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
