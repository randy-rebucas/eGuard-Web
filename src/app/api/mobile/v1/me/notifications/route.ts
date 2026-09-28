import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authed, body } from "@/lib/mobile-api";
import { planRequired } from "@/lib/errors";
import { familyEntitlements, planWith } from "@/lib/plan-access";

const select = { notifyPush: true, notifyEmail: true, notifyApproval: true, weeklySummary: true } as const;

/** Settings › Notifications (alert preferences). Push needs a plan with real-time alerts (403 `plan_required` on Free). */
export const GET = authed(async ({ user }) => NextResponse.json(await db.user.findUniqueOrThrow({ where: { id: user.id }, select })));

const Body = z.object({
  notifyPush: z.boolean(), notifyEmail: z.boolean(), notifyApproval: z.boolean(), weeklySummary: z.boolean(),
}).partial();

export const PATCH = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  if (b.notifyPush && !(await familyEntitlements(user.familyId)).realtimeAlerts) {
    throw planRequired(`Real-time alerts are included with ${planWith((e) => e.realtimeAlerts).name}.`);
  }
  return NextResponse.json(await db.user.update({ where: { id: user.id }, data: b, select }));
});
