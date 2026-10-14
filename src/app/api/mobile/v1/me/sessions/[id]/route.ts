import { NextResponse } from "next/server";
import { authed } from "@/lib/mobile-api";
import { signOutSession } from "@/lib/sessions";

/**
 * Signs out one of this parent's other sessions (a lost or shared phone, an old browser). Its push token goes with
 * it. The current session is signed out with POST /auth/logout instead.
 */
export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  await signOutSession(user, params.id);
  return NextResponse.json({ ok: true });
});
