import { NextResponse } from "next/server";
import { z } from "zod";
import type { ProtectionConfig } from "@/lib/protections";
import { PROTECTION_BY_KEY } from "@/lib/protections";
import { ConfigSchema, batchStatus, requestConfigs } from "@/lib/config-service";
import { invalid } from "@/lib/errors";
import { authed, body, clientLabel } from "@/lib/mobile-api";

/**
 * Change one protection, e.g. PUT /children/{id}/protections/BEDTIME
 * `{ "enabled": true, "start": "21:30", "end": "06:00", "days": "EVERY_DAY" }`.
 * Returns the batch to poll (202); the setting counts only once each device verifies it. A child with no device yet
 * has nothing to verify it: the setting is saved as their policy and applied when one pairs (200, `batchId: null`).
 */
export const PUT = authed<{ id: string; key: string }>(async ({ req, user, params }) => {
  const key = params.key.toUpperCase();
  if (!(key in PROTECTION_BY_KEY)) throw invalid("Unknown protection.");
  const { baseVersion, ...raw } = await body(req, z.record(z.string(), z.unknown()));
  if (baseVersion !== undefined && (typeof baseVersion !== "string" || baseVersion.length > 64)) throw invalid("baseVersion must be the version from GET /children/{id}/protections.");
  const parsed = ConfigSchema.safeParse({ ...raw, key });
  if (!parsed.success) throw invalid(parsed.error.issues[0].message);
  // baseVersion (optional): 409 `stale` when the setting changed since the app loaded it
  const { batchId, saved } = await requestConfigs(user, params.id, [parsed.data as ProtectionConfig], clientLabel(req), { strict: true, baseVersion });
  if (!batchId) return NextResponse.json({ batchId: null, saved });
  return NextResponse.json(await batchStatus(user.familyId, batchId), { status: 202 });
});
