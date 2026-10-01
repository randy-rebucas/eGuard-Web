import { z } from "zod";
import { acceptInvite } from "@/lib/invitations";
import { clientIp, sessionResponse } from "@/lib/mobile-account";
import { body, open } from "@/lib/mobile-api";
import { LIMITS, enforce, ipKey } from "@/lib/rate-limit";

const Body = z.object({ token: z.string().min(1).max(200), password: z.string().max(200) });

/** Accepts an invitation with the parent's own password: joins the family and returns a session, like sign-in. */
export const POST = open(async ({ req }) => {
  await enforce(ipKey("token", clientIp(req)), LIMITS.tokenIp);
  const b = await body(req, Body);
  const user = await acceptInvite(b.token, b.password);
  return sessionResponse(req, user.id);
});
