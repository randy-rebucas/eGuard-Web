import { NextResponse } from "next/server";
import { z } from "zod";
import type { ProtectionConfig } from "@/lib/protections";
import { ConfigSchema, batchStatus, childFor, requestConfigs } from "@/lib/config-service";
import { authed, body, clientLabel } from "@/lib/mobile-api";
import { PROFILE_IDS, profileConfigs } from "@/lib/profiles";

const Body = z.object({
  profile: z.enum(PROFILE_IDS),
  /** Settings the parent changed on the Recommended Setup screen; replace the profile's values */
  overrides: z.array(ConfigSchema).max(10).default([]),
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
  const age = new Date().getFullYear() - child.birthYear;
  const overrides = new Map(b.overrides.map((o) => [o.key, o as ProtectionConfig]));
  const configs = profileConfigs(b.profile, age).map((c) => overrides.get(c.key) ?? c);
  const result = await requestConfigs(user, child.id, configs, clientLabel(req));
  return NextResponse.json({
    ...result,
    progress: result.batchId ? await batchStatus(user.familyId, result.batchId) : null,
  }, { status: 201 });
});
