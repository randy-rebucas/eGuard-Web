import { z } from "zod";
import { clientIp, sessionResponse } from "@/lib/mobile-account";
import { body, open } from "@/lib/mobile-api";
import { finishSignup } from "@/lib/signup";

const Body = z.object({ signup: z.string().min(20).max(200), code: z.string().trim().min(6).max(12) });

/**
 * Create Account, step 2: the code from the email. Creates the family with this parent as its admin (email already
 * verified) and signs in. 5 tries per code, 15 minutes; `400 signup_expired` means fill in the form again.
 */
export const POST = open(async ({ req }) => {
  const b = await body(req, Body);
  const user = await finishSignup(b.signup, b.code, clientIp(req));
  return sessionResponse(req, user.id, 201);
});
