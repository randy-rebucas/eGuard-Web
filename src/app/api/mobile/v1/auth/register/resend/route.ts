import { NextResponse } from "next/server";
import { z } from "zod";
import { body, open } from "@/lib/mobile-api";
import { resendSignupCode } from "@/lib/signup";

const Body = z.object({ signup: z.string().min(20).max(200) });

/** "Send a new code": once a minute, 5 emails per sign-up. The earlier code stops working. */
export const POST = open(async ({ req }) => {
  const b = await body(req, Body);
  const { email, expiresAt } = await resendSignupCode(b.signup);
  return NextResponse.json({ ok: true, email, expiresAt });
});
