import { NextResponse } from "next/server";
import { z } from "zod";
import { DeviceName, removeDevice, renameDevice, setPrimaryDevice } from "@/lib/family-service";
import { ConfirmBody, authed, body } from "@/lib/mobile-api";
import { deviceDetailJson } from "@/lib/mobile-views";

/** Device detail: every protection, its platform capability and when it was last verified. */
export const GET = authed<{ id: string }>(async ({ user, params }) => NextResponse.json(await deviceDetailJson(user.familyId, params.id)));

/** Renames the device and/or makes it its child's primary device (`isPrimary: true`; there's no "un-primary"). */
export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, z.object({ name: DeviceName.optional(), isPrimary: z.literal(true).optional() })
    .refine((x) => x.name !== undefined || x.isPrimary, "Send a name or isPrimary: true."));
  if (b.name !== undefined) await renameDevice(user, params.id, b.name);
  if (b.isPrimary) await setPrimaryDevice(user, params.id);
  return NextResponse.json(await deviceDetailJson(user.familyId, params.id));
});

/**
 * Removes the device from the family. Its token stops working immediately. Needs the parent's password,
 * and the family gets a "Device removed" alert (emailed), since eGuard stops verifying the device.
 * `deleteHistory: true` also deletes the screen time, app usage and places it recorded; by default they're kept.
 */
export const DELETE = authed<{ id: string }>(async ({ req, user, params }) => {
  // A missing password gets 403 wrong_password (after the 404 check), like a wrong one
  const b = await body(req, ConfirmBody.extend({ deleteHistory: z.boolean().optional() }));
  await removeDevice(user, params.id, { password: b.password, phrase: b.confirm }, { deleteHistory: b.deleteHistory === true });
  return NextResponse.json({ ok: true });
});
