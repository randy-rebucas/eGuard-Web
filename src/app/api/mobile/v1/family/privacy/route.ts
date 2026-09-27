import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/family-service";
import { authed, body, requireAdminUser } from "@/lib/mobile-api";

const select = { keepLocationHistory: true, shareAnalytics: true, retentionDays: true } as const;

/** Settings › Privacy: data and security choices for the whole family. */
export const GET = authed(async ({ user }) => NextResponse.json(await db.family.findUniqueOrThrow({ where: { id: user.familyId }, select })));

const Body = z.object({ keepLocationHistory: z.boolean(), shareAnalytics: z.boolean() }).partial();

export const PATCH = authed(async ({ req, user }) => {
  requireAdminUser(user);
  const b = await body(req, Body);
  const family = await db.family.update({ where: { id: user.familyId }, data: b, select });
  for (const [k, v] of Object.entries(b)) await audit(user.familyId, user.name, `privacy.${k}`, String(v));
  // Turning history off deletes the history already kept
  if (b.keepLocationHistory === false) await db.locationVisit.deleteMany({ where: { child: { familyId: user.familyId } } });
  return NextResponse.json(family);
});
