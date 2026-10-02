import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, body } from "@/lib/mobile-api";
import { regenerateRecoveryCodes } from "@/lib/two-factor";

const Body = z.object({ code: z.string().trim().min(6).max(40) });

/** New recovery codes (the old ones stop working). Needs a current authenticator code or a recovery code. */
export const POST = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  return NextResponse.json(await regenerateRecoveryCodes(user, b.code));
});
