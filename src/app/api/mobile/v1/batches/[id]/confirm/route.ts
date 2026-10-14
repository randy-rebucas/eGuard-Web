import { NextResponse } from "next/server";
import { z } from "zod";
import { batchStatus, confirmGuided } from "@/lib/config-service";
import { authed, query } from "@/lib/mobile-api";
import { PROTECTIONS } from "@/lib/protections";

const Query = z.object({
  key: z.enum(PROTECTIONS.map((p) => p.key) as [string, ...string[]], { message: "Unknown protection" }).optional(),
});

/**
 * Guided setup: "I've done the steps, verify now". The devices are asked for a full report. `?key=` confirms only
 * that protection's steps; without it, every guided step in the batch.
 */
export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  const { key } = query(req, Query);
  const { confirmed } = await confirmGuided(user.familyId, params.id, key as Parameters<typeof confirmGuided>[2]);
  return NextResponse.json({ confirmed, ...(await batchStatus(user.familyId, params.id)) });
});
