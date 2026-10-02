import { z } from "zod";
import { clientIp, signInResponse } from "@/lib/mobile-account";
import { body, open } from "@/lib/mobile-api";
import { resetPassword } from "@/lib/password-reset";

const Body = z.object({ token: z.string().min(1).max(200), password: z.string().max(200) });

/**
 * Uses the emailed link's token to set a new password (for an app that opens /reset-password links
 * itself). Signs out every other session and returns a fresh one.
 */
export const POST = open(async ({ req }) => {
  const b = await body(req, Body);
  const user = await resetPassword(b.token, b.password, clientIp(req));
  return signInResponse(req, user.id);
});
