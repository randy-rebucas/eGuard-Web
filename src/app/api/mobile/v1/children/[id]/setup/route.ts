import { NextResponse } from "next/server";
import { z } from "zod";
import type { ProtectionConfig } from "@/lib/protections";
import { ConfigSchema, batchStatus, childFor, requestConfigs } from "@/lib/config-service";
import { authed, body, clientLabel } from "@/lib/mobile-api";
import { PROFILE_IDS, profileConfigs } from "@/lib/profiles";
import { CATEGORY_KEYS, CATEGORY_UPGRADE } from "@/lib/app-categories";
import { setCategoryLimit } from "@/lib/family-service";
import { familyEntitlements } from "@/lib/plan-access";
import { planRequired } from "@/lib/errors";

const Body = z.object({
  profile: z.enum(PROFILE_IDS),
  /** Settings the parent changed on the Recommended Setup screen; replace the profile's values */
  overrides: z.array(ConfigSchema).max(10).default([]),
  /** Category limits from Recommended Setup ("Gaming time"); null removes one. Needs a plan with category limits */
  categoryLimits: z.array(z.object({ category: z.enum(CATEGORY_KEYS), dailyLimitMinutes: z.number().int().min(1).max(1440).nullable() })).max(CATEGORY_KEYS.length).default([]),
});

/**
 * Review & Configure: applies a whole profile in one batch. Devices that support a protection get a
 * configuration request (verified when they report back); anything no device can verify yet, such as
 * a child with no paired device, is saved as the child's policy and sent when a device pairs.
 * Poll /batches/{batchId} for Setup Progress.
 */
export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, Body);
  const child = await childFor(user.familyId, params.id);
  // Checked first, so a refused limit never leaves the protections half set up
  if (b.categoryLimits.some((l) => l.dailyLimitMinutes != null) && !(await familyEntitlements(user.familyId)).categoryLimits) throw planRequired(CATEGORY_UPGRADE);
  const age = new Date().getFullYear() - child.birthYear;
  const overrides = new Map(b.overrides.map((o) => [o.key, o as ProtectionConfig]));
  const configs = profileConfigs(b.profile, age).map((c) => overrides.get(c.key) ?? c);
  const result = await requestConfigs(user, child.id, configs, clientLabel(req));
  for (const l of b.categoryLimits) await setCategoryLimit(user, child.id, l.category, l.dailyLimitMinutes, clientLabel(req));
  return NextResponse.json({
    ...result,
    progress: result.batchId ? await batchStatus(user.familyId, result.batchId) : null,
  }, { status: 201 });
});
