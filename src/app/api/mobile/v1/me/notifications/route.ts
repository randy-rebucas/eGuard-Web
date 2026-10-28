import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authed, body } from "@/lib/mobile-api";
import { familyEntitlements, pushScope } from "@/lib/plan-access";

const select = { notifyPush: true, notifyEmail: true, notifyApproval: true, weeklySummary: true, productUpdates: true } as const;

/**
 * The preferences, plus what push sends. `pushIncluded` is true on every plan now (apps before `pushScope` locked the
 * switch when it was false); `pushScope` says "all" with real-time alerts, "security" for security alerts only.
 */
async function prefsJson(userId: string, familyId: string) {
  const [prefs, plan] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: userId }, select }), familyEntitlements(familyId)]);
  return { ...prefs, pushIncluded: true, pushScope: pushScope(plan) };
}

/** Settings › Notifications (alert preferences). Push can be turned on on every plan; `pushScope` says what it sends. */
export const GET = authed(async ({ user }) => NextResponse.json(await prefsJson(user.id, user.familyId)));

const Body = z.object({
  notifyPush: z.boolean(), notifyEmail: z.boolean(), notifyApproval: z.boolean(), weeklySummary: z.boolean(), productUpdates: z.boolean(),
}).partial();

export const PATCH = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  await db.user.update({ where: { id: user.id }, data: b });
  return NextResponse.json(await prefsJson(user.id, user.familyId));
});
