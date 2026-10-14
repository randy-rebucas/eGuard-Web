import { NextResponse } from "next/server";
import { z } from "zod";
import type { ProtectionKey } from "@prisma/client";
import { batchStatus, cancelBatch } from "@/lib/config-service";
import { PROTECTIONS } from "@/lib/protections";
import { authed, query } from "@/lib/mobile-api";
import { simulateTick } from "@/lib/simulator";

const Query = z.object({
  key: z.enum(PROTECTIONS.map((p) => p.key) as [string, ...string[]], { message: "Unknown protection" }).optional(),
});

/**
 * Setup Progress / "Waiting for device": poll every 1–2 s until `done`. Per protection and device:
 * PENDING → DELIVERED → VERIFIED or FAILED; guided setup starts AWAITING_PARENT with `guide` steps.
 */
export const GET = authed<{ id: string }>(async ({ user, params }) => {
  await simulateTick(user.familyId);
  return NextResponse.json(await batchStatus(user.familyId, params.id));
});

/**
 * Cancel whatever in the batch hasn't been verified yet. `?key=` cancels only that protection's change (a protection
 * screen's "Cancel change"), so the rest of a setup batch keeps going.
 */
export const DELETE = authed<{ id: string }>(async ({ req, user, params }) => {
  const { key } = query(req, Query);
  return NextResponse.json(await cancelBatch(user.familyId, params.id, key as ProtectionKey | undefined));
});
