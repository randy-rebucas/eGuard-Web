import { NextResponse } from "next/server";
import { listIdentities } from "@/lib/family-service";
import { authed } from "@/lib/mobile-api";

/** Apple/Google sign-ins linked to this parent (Privacy & security). */
export const GET = authed(async ({ user }) => NextResponse.json({ identities: await listIdentities(user.id) }));
