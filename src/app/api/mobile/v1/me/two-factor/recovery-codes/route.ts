import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, body } from "@/lib/mobile-api";
import { regenerateRecoveryCodes } from "@/lib/two-factor";

const CODE_HINT = "Enter the 6-digit code from your authenticator app, or a recovery code.";
const Body = z.object({ code: z.string(CODE_HINT).trim().min(6, CODE_HINT).max(40, CODE_HINT) });

/** New recovery codes (the old ones stop working). Needs a current authenticator code or a recovery code. */
export const POST = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  return NextResponse.json(await regenerateRecoveryCodes(user, b.code));
});
