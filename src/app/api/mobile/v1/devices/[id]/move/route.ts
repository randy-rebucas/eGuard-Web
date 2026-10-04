import { NextResponse } from "next/server";
import { z } from "zod";
import { moveDevice } from "@/lib/family-service";
import { ConfirmBody, authed, body } from "@/lib/mobile-api";
import { deviceDetailJson } from "@/lib/mobile-views";

/**
 * Moves the device to another child in the family, without pairing it again. Needs the password (or
 * `confirm: "DELETE"`), and the family gets a "Device moved" alert. Returns the device as GET /devices/{id} does,
 * with `firstCheck: true` until it reports against the new child's protections.
 */
export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, ConfirmBody.extend({ childId: z.string().min(1).max(64) }));
  await moveDevice(user, params.id, b.childId, { password: b.password, phrase: b.confirm });
  return NextResponse.json(await deviceDetailJson(user.familyId, params.id));
});
