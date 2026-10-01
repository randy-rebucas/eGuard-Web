import { NextResponse } from "next/server";
import { resendInvite } from "@/lib/invitations";
import { authed } from "@/lib/mobile-api";

/** Sends a pending invitation again, with a fresh link. `409` if they already accepted. */
export const POST = authed<{ id: string }>(async ({ user, params }) => {
  await resendInvite(user, params.id);
  return NextResponse.json({ ok: true });
});
