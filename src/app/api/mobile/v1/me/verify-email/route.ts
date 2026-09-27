import { NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/email-verification";
import { authed } from "@/lib/mobile-api";

/** "Resend link": emails a new verification link (one a minute). `sent: false` means already verified. */
export const POST = authed(async ({ user }) => {
  const sent = await sendVerificationEmail(user.id, { throttle: true });
  return NextResponse.json({ sent, email: user.email }, { status: sent ? 202 : 200 });
});
