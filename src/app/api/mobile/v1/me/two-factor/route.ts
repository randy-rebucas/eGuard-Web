import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, body } from "@/lib/mobile-api";
import { disable, status } from "@/lib/two-factor";

const Code = z.object({ code: z.string().trim().min(6).max(40) });

/** Whether two-step verification is on, can be turned on here, and how many recovery codes are left. */
export const GET = authed(async ({ user }) => NextResponse.json(await status(user.id)));

/** Turns it off. Needs a current authenticator code or a recovery code. */
export const DELETE = authed(async ({ req, user }) => {
  const b = await body(req, Code);
  await disable(user, b.code);
  return NextResponse.json(await status(user.id));
});
