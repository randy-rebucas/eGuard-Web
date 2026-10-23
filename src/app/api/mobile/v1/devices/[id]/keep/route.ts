import { NextResponse } from "next/server";
import { cancelDeviceRemoval } from "@/lib/family-service";
import { authed } from "@/lib/mobile-api";
import { deviceDetailJson } from "@/lib/mobile-views";

/**
 * Keeps a computer whose removal is waiting (DELETE /devices/{id} answered `pending: true`): it stays in the family,
 * and its next sync carries no uninstall command. Nothing to do for any other device. Returns the device as GET does.
 */
export const POST = authed<{ id: string }>(async ({ user, params }) => {
  await cancelDeviceRemoval(user, params.id);
  return NextResponse.json(await deviceDetailJson(user.familyId, params.id));
});
