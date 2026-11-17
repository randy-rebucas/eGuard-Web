import { NextResponse } from "next/server";
import { z } from "zod";
import { invitation } from "@/lib/invitations";
import { clientIp } from "@/lib/mobile-account";
import { apiError, body, open, query } from "@/lib/mobile-api";
import { LIMITS, enforce, ipKey } from "@/lib/rate-limit";

const Token = z.object({ token: z.string().min(1).max(200) });

/**
 * For an app that opens /accept-invite links itself: which family the invitation is for, before accepting. POST keeps
 * the token out of access logs; GET (token in the query) stays for apps released before it.
 */
export const POST = open(async ({ req }) => {
  await enforce(ipKey("token", clientIp(req)), LIMITS.tokenIp);
  return describe((await body(req, Token)).token);
});

export const GET = open(async ({ req }) => {
  await enforce(ipKey("token", clientIp(req)), LIMITS.tokenIp);
  return describe(query(req, Token).token);
});

async function describe(token: string) {
  const i = await invitation(token);
  if (!i) return apiError(400, "This invitation has already been used or isn't valid.", "link_invalid");
  if (i.expired) return apiError(400, "This invitation has expired. Ask the family admin to send a new one.", "link_expired");
  return NextResponse.json({ name: i.name, email: i.email, familyName: i.familyName, invitedBy: i.invitedBy });
}
