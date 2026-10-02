import { NextResponse } from "next/server";
import { authed } from "@/lib/mobile-api";
import { startSetup } from "@/lib/two-factor";

/**
 * Step 1 of turning on two-step verification: a new secret. Show `uri` as a QR code (or open it, which hands it to
 * an authenticator app on the same phone) and `secret` for typing in by hand. Calling again replaces the secret.
 */
export const POST = authed(async ({ user }) => NextResponse.json(await startSetup(user)));
