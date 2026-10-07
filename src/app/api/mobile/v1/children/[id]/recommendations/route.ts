import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { childFor } from "@/lib/config-service";
import { authed, query } from "@/lib/mobile-api";
import { PROFILE_IDS, profileConfigs, recommendedProfile } from "@/lib/profiles";
import { CAPABILITY_META, PROTECTION_BY_KEY, describeConfig } from "@/lib/protections";
import { CATEGORY_BY_KEY, CATEGORY_UPGRADE, recommendedGamingMinutes } from "@/lib/app-categories";
import { familyEntitlements } from "@/lib/plan-access";

const Query = z.object({ profile: z.enum(PROFILE_IDS).optional() });

/**
 * Your recommended setup: every protection's suggested config for the child's age and profile,
 * with how it will be applied on each of the child's devices, and the suggested category limits ("Gaming time";
 * `available` is false on plans without them). Send the (edited) configs and limits to /setup.
 */
export const GET = authed<{ id: string }>(async ({ req, user, params }) => {
  const child = await childFor(user.familyId, params.id);
  const age = new Date().getFullYear() - child.birthYear;
  const profile = query(req, Query).profile ?? recommendedProfile(age);
  const [devices, plan] = await Promise.all([
    db.device.findMany({ where: { childId: child.id }, select: { id: true, name: true, platform: true } }),
    familyEntitlements(user.familyId),
  ]);
  return NextResponse.json({
    childId: child.id, age, profile,
    settings: profileConfigs(profile, age).map((config) => {
      const def = PROTECTION_BY_KEY[config.key];
      return {
        key: config.key, name: def.name, icon: def.icon, config, label: describeConfig(config),
        devices: devices.map((d) => ({ deviceId: d.id, deviceName: d.name, capability: def.caps[d.platform], capabilityLabel: CAPABILITY_META[def.caps[d.platform]].label })),
      };
    }),
    categoryLimits: [{
      category: "GAMES", label: CATEGORY_BY_KEY.GAMES.limitLabel, dailyLimitMinutes: recommendedGamingMinutes(profile),
      available: plan.categoryLimits, upgrade: plan.categoryLimits ? null : CATEGORY_UPGRADE,
    }],
  });
});
