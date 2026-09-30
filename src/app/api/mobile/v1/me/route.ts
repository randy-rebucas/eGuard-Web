import { NextResponse } from "next/server";
import { sendVerificationEmailLater } from "@/lib/email-verification";
import { z } from "zod";
import { db } from "@/lib/db";
import { NAME_MAX, NAME_TOO_LONG, changeEmail, deleteAccount } from "@/lib/family-service";
import { meJson } from "@/lib/mobile-account";
import { authed, body } from "@/lib/mobile-api";

export const GET = authed(async ({ user }) => NextResponse.json(await meJson(user.id)));

const validTz = (tz: string) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } };
const Body = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(NAME_MAX, NAME_TOO_LONG).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").optional(),
  /** Required to change `email`: the parent's current password */
  password: z.string().max(200).optional(),
  /** Family time zone; only the family admin can change it */
  timezone: z.string().refine(validTz, "Choose a valid time zone.").optional(),
});

/**
 * Settings › Account. Changing the email needs `password` (403 `wrong_password`, or `password_not_set`
 * for Apple/Google accounts, which set one through /auth/forgot-password first). The new email is
 * unverified until its link is opened, and Apple/Google sign-ins linked to the old one are unlinked.
 */
export const PATCH = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  const emailChanged = b.email ? await changeEmail(user, b.email, b.password ?? "") : false;
  if (b.name) await db.user.update({ where: { id: user.id }, data: { name: b.name } });
  if (emailChanged) await sendVerificationEmailLater(user.id);
  if (b.timezone && user.role === "FAMILY_ADMIN") await db.family.update({ where: { id: user.familyId }, data: { timezone: b.timezone } });
  return NextResponse.json(await meJson(user.id));
});

const DeleteBody = z.object({
  password: z.string().max(200).optional(),
  /** For Apple/Google accounts without a password (`hasPassword: false`): the text "DELETE" */
  confirm: z.string().optional(),
});

/**
 * Delete account (App Store / Play requirement). The family admin's account deletes the whole family
 * (children, devices, history, other parents); another parent's account removes only them.
 */
export const DELETE = authed(async ({ req, user }) => {
  const b = await body(req, DeleteBody);
  const r = await deleteAccount(user, { password: b.password, phrase: b.confirm?.trim() });
  return NextResponse.json({ ok: true, ...r });
});
