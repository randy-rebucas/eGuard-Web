import { NextResponse } from "next/server";
import { z } from "zod";
import { childFor } from "@/lib/config-service";
import { categoryLimits, categoryUsage, setCategoryLimit } from "@/lib/family-service";
import { APP_CATEGORIES, CATEGORY_KEYS, CATEGORY_UPGRADE } from "@/lib/app-categories";
import { appMinutesOn, dateFromKey, dayKey, getFamily } from "@/lib/queries";
import { authed, body, clientLabel } from "@/lib/mobile-api";
import { familyEntitlements } from "@/lib/plan-access";

/**
 * Category limits ("Gaming time"): every category with its limit (null for none) and the minutes used today by the
 * child's apps in it. `available` is false on plans without category limits (`upgrade` says which plan has them).
 */
export const GET = authed<{ id: string }>(async ({ user, params }) => {
  const child = await childFor(user.familyId, params.id);
  const family = await getFamily(user.familyId);
  const [limits, usage, plan] = await Promise.all([
    categoryLimits(child.id),
    appMinutesOn([child.id], dateFromKey(dayKey(new Date(), family.timezone))),
    familyEntitlements(user.familyId),
  ]);
  const today = await categoryUsage(child.id, usage);
  return NextResponse.json({
    available: plan.categoryLimits,
    upgrade: plan.categoryLimits ? null : CATEGORY_UPGRADE,
    categories: APP_CATEGORIES.map((c) => ({
      category: c.key, label: c.label, limitLabel: c.limitLabel,
      dailyLimitMinutes: limits.find((l) => l.category === c.key)?.dailyLimitMinutes ?? null,
      todayMinutes: today.get(c.key) ?? 0,
    })),
  });
});

const Body = z.object({
  category: z.enum(CATEGORY_KEYS),
  /** null removes the limit */
  dailyLimitMinutes: z.number().int().min(1).max(1440).nullable(),
});

/** Sets or removes one category's daily limit. 403 `plan_required` setting one on a plan without them. */
export const PUT = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, Body);
  const child = await childFor(user.familyId, params.id);
  return NextResponse.json(await setCategoryLimit(user, child.id, b.category, b.dailyLimitMinutes, clientLabel(req)));
});
