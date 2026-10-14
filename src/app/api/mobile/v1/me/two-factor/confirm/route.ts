import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, body } from "@/lib/mobile-api";
import { confirmSetup } from "@/lib/two-factor";

const CODE_HINT = "Enter the 6-digit code from your authenticator app.";
const Body = z.object({ code: z.string(CODE_HINT).trim().min(6, CODE_HINT).max(10, CODE_HINT) });

/** Step 2: a code from the authenticator app turns it on. Returns the 10 recovery codes; they're never shown again. */
export const POST = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  return NextResponse.json(await confirmSetup(user, b.code));
});
