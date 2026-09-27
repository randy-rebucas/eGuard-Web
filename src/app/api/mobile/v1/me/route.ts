import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { conflict } from "@/lib/errors";
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
  if (b.email && (await db.user.findFirst({ where: { email: b.email, id: { not: user.id } } }))) throw conflict("Another account already uses this email.");
  await db.user.update({ where: { id: user.id }, data: { ...(b.name ? { name: b.name } : {}), ...(b.email ? { email: b.email } : {}) } });
  if (b.timezone && user.role === "FAMILY_ADMIN") await db.family.update({ where: { id: user.familyId }, data: { timezone: b.timezone } });
  return NextResponse.json(await meJson(user.id));
});
