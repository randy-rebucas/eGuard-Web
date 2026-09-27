import { NextResponse } from "next/server";
import { batchStatus, confirmGuided } from "@/lib/config-service";
import { authed } from "@/lib/mobile-api";

/** Guided setup: "I've done the steps, verify now". The devices are asked for a full report. */
export const POST = authed<{ id: string }>(async ({ user, params }) => {
  const { confirmed } = await confirmGuided(user.familyId, params.id);
  return NextResponse.json({ confirmed, ...(await batchStatus(user.familyId, params.id)) });
});
