import { hashPassword } from "@/lib/auth";
import { sendVerificationEmailLater } from "@/lib/email-verification";
import { RegisterSchema, createFamily } from "@/lib/family-service";
import { clientIp, defaultFamilyName, sessionResponse } from "@/lib/mobile-account";
import { body, open } from "@/lib/mobile-api";
import { LIMITS, enforce, ipKey } from "@/lib/rate-limit";

const Body = RegisterSchema.extend({ familyName: RegisterSchema.shape.familyName.optional() });

/** Create Account: makes a family with this parent as its admin, signs them in, and emails a verification link. */
export const POST = open(async ({ req }) => {
  await enforce(ipKey("signup", clientIp(req)), LIMITS.signupIp);
  const b = await body(req, Body);
  const user = await createFamily({
    name: b.name, email: b.email, familyName: b.familyName ?? defaultFamilyName(b.name), passwordHash: await hashPassword(b.password),
  });
  await sendVerificationEmailLater(user.id);
  return sessionResponse(req, user.id, 201);
});
