import { z } from "zod";
import { authenticate } from "@/lib/auth";
import { clientIp, sessionResponse } from "@/lib/mobile-account";
import { body, open } from "@/lib/mobile-api";

const Body = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address."), password: z.string().min(1, "Enter your password.") });

export const POST = open(async ({ req }) => {
  const b = await body(req, Body);
  const user = await authenticate(b.email, b.password, clientIp(req));
  return sessionResponse(req, user.id);
});
