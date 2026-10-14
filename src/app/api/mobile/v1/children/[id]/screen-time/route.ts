import { NextResponse } from "next/server";
import { z } from "zod";
import { getFamily } from "@/lib/queries";
import { entitlementsFor } from "@/lib/plans";
import { planRequired } from "@/lib/errors";
import { APP_REPORTS_UPGRADE } from "@/lib/plan-access";
import { authed, query } from "@/lib/mobile-api";
import { childFromGraph, getFamilyGraph, screenTime } from "@/lib/mobile-views";

const Query = z.object({ period: z.enum(["today", "7d", "30d"]).default("today") });

/**
 * Screen Time tab: total vs limit, per-day series, top apps, and for `today` a 24-hour breakdown
 * (`hourly` is null when the child's devices don't send hourly data).
 */
export const GET = authed<{ id: string }>(async ({ req, user, params }) => {
  const { period } = query(req, Query);
  const [family, graph] = await Promise.all([getFamily(user.familyId), getFamilyGraph(user.familyId)]);
  const plan = entitlementsFor(family.plan);
  const child = childFromGraph(graph, params.id);
  // 30 days is an advanced report, as on the web's Reports page and the pricing page
  if (period === "30d" && !plan.advancedReports) throw planRequired(APP_REPORTS_UPGRADE);
  // Sent with every period, so the app can lock the 30-day tab before anyone taps it
  const locked = plan.advancedReports ? null : { periods: ["30d"], message: APP_REPORTS_UPGRADE };
  return NextResponse.json({ ...(await screenTime(child, family.timezone, period, plan.appMonitoringLimit)), locked });
});
