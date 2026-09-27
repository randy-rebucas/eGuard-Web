import { z } from "zod";
import { db } from "@/lib/db";
import { clearLoginFailures, loginRateLimited, noteLoginFailure, verifyPassword } from "@/lib/auth";
import { clientIp, sessionResponse } from "@/lib/mobile-account";
import { apiError, body, open } from "@/lib/mobile-api";

const Body = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address."), password: z.string().min(1, "Enter your password.") });

export const POST = open(async ({ req }) => {
  const b = await body(req, Body);
  const key = `${b.email}|${clientIp(req)}`;
  if (loginRateLimited(key)) return apiError(429, "Too many attempts. Wait 10 minutes and try again.", "rate_limited");
  const user = await db.user.findUnique({ where: { email: b.email } });
  if (!user || !(await verifyPassword(b.password, user.passwordHash))) {
    noteLoginFailure(key);
    return apiError(401, "That email and password don't match an eGuard account.", "invalid_credentials");
  }
  clearLoginFailures(key);
  return sessionResponse(req, user.id);
});
