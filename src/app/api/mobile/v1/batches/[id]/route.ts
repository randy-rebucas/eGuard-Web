import { NextResponse } from "next/server";
import { batchStatus, cancelBatch } from "@/lib/config-service";
import { authed } from "@/lib/mobile-api";
import { simulateTick } from "@/lib/simulator";

/**
 * Setup Progress / "Waiting for device": poll every 1–2 s until `done`. Per protection and device:
 * PENDING → DELIVERED → VERIFIED or FAILED; guided setup starts AWAITING_PARENT with `guide` steps.
 */
export const GET = authed<{ id: string }>(async ({ user, params }) => {
  await simulateTick(user.familyId);
  return NextResponse.json(await batchStatus(user.familyId, params.id));
});

/** Cancel whatever in the batch hasn't been verified yet. */
export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  const r = await cancelBatch(user.familyId, params.id);
  return NextResponse.json(r);
});
