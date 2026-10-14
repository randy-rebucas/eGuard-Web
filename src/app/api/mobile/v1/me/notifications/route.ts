import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authed, body } from "@/lib/mobile-api";
import { planRequired } from "@/lib/errors";
import { familyEntitlements, planWith } from "@/lib/plan-access";

const select = { notifyPush: true, notifyEmail: true, notifyApproval: true, weeklySummary: true, productUpdates: true } as const;

/**
 * The preferences, plus `pushIncluded`: whether the plan sends push alerts at all (real-time alerts). Without it the
 * stored `notifyPush` (on by default) says nothing, so the app shows the switch locked instead of "on".
 */
async function prefsJson(userId: string, familyId: string) {
  const [prefs, plan] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: userId }, select }), familyEntitlements(familyId)]);
  return { ...prefs, pushIncluded: plan.realtimeAlerts };
}

/** Settings › Notifications (alert preferences). Push needs a plan with real-time alerts (403 `plan_required` on Free). */
export const GET = authed(async ({ user }) => NextResponse.json(await prefsJson(user.id, user.familyId)));

const Body = z.object({
  notifyPush: z.boolean(), notifyEmail: z.boolean(), notifyApproval: z.boolean(), weeklySummary: z.boolean(), productUpdates: z.boolean(),
}).partial();

export const PATCH = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  if (b.notifyPush && !(await familyEntitlements(user.familyId)).realtimeAlerts) {
    // Only turning it on is refused: `notifyPush: true` sent back unchanged with another switch (it's on by default,
    // Free included) mustn't make turning off email alerts fail
    const { notifyPush } = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { notifyPush: true } });
    if (!notifyPush) throw planRequired(`Push alerts are included with ${planWith((e) => e.realtimeAlerts).name}.`);
  }
  await db.user.update({ where: { id: user.id }, data: b });
  return NextResponse.json(await prefsJson(user.id, user.familyId));
});
