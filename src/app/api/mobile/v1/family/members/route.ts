import { NextResponse } from "next/server";
import { z } from "zod";
import { InviteSchema } from "@/lib/family-service";
import { INVITE_DAYS, inviteParent } from "@/lib/invitations";
import { authed, body } from "@/lib/mobile-api";

/** `password` came from older apps, which set a temporary one; it's ignored (the person now chooses their own). */
const Body = InviteSchema.extend({ password: z.unknown().optional() });

/**
 * Family admin invites another parent by email. They join only once they open the emailed link and accept:
 * until then they're listed with `pending: true` and can't sign in.
 */
export const POST = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  const { user: m, sent } = await inviteParent(user, { name: b.name, email: b.email });
  return NextResponse.json({ id: m.id, name: m.name, email: m.email, role: m.role, pending: true, emailSent: sent, expiresInDays: INVITE_DAYS }, { status: 201 });
});
