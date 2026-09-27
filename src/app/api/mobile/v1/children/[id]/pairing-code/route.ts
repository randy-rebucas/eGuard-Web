import { NextResponse } from "next/server";
import { createPairingCode } from "@/lib/family-service";
import { authed } from "@/lib/mobile-api";

/** Add a device: a one-time code (15 minutes) for the child's device to POST to /api/device/v1/pair. */
export const POST = authed<{ id: string }>(async ({ user, params }) =>
  NextResponse.json(await createPairingCode(user, params.id), { status: 201 }));
