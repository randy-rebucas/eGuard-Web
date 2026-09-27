import { NextResponse, after } from "next/server";
import { sendVerificationEmailQuietly } from "@/lib/email-verification";
import { z } from "zod";
import { db } from "@/lib/db";
import { conflict, isUniqueViolation } from "@/lib/errors";
import { userIdForMailbox } from "@/lib/family-service";
import { meJson } from "@/lib/mobile-account";
import { authed, body } from "@/lib/mobile-api";

export const GET = authed(async ({ user }) => NextResponse.json(await meJson(user.id)));

const validTz = (tz: string) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } };
const Body = z.object({
  name: z.string().trim().min(2, "Enter your name.").optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").optional(),
  /** Family time zone; only the family admin can change it */
  timezone: z.string().refine(validTz, "Choose a valid time zone.").optional(),
});

/** Settings › Account. */
export const PATCH = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  const taken = () => conflict("Another account already uses this email.");
  if (b.email && (await userIdForMailbox(b.email, user.id))) throw taken();
  const emailChanged = !!b.email && b.email !== user.email;
  await db.user.update({
    where: { id: user.id },
    // A new email is unverified until they open the link we send it
    data: { ...(b.name ? { name: b.name } : {}), ...(emailChanged ? { email: b.email, emailVerifiedAt: null } : {}) },
  }).catch((e) => { throw isUniqueViolation(e) ? taken() : e; });
  if (emailChanged) after(() => sendVerificationEmailQuietly(user.id));
  if (b.timezone && user.role === "FAMILY_ADMIN") await db.family.update({ where: { id: user.familyId }, data: { timezone: b.timezone } });
  return NextResponse.json(await meJson(user.id));
});
