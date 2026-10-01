import { NextResponse } from "next/server";
import { z } from "zod";
import { getFamily } from "@/lib/queries";
import { entitlementsFor } from "@/lib/plans";
import { planRequired } from "@/lib/errors";
import { REPORTS_UPGRADE } from "@/lib/plan-access";
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
  // 30 days is an advanced report, as on the web's Reports page and the pricing page
  if (period === "30d" && !plan.advancedReports) throw planRequired(REPORTS_UPGRADE);
  return NextResponse.json(await screenTime(childFromGraph(graph, params.id), family.timezone, period, plan.appMonitoringLimit));
});
