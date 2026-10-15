import { NextResponse } from "next/server";
import { RegisterSchema } from "@/lib/family-service";
import { clientIp, defaultFamilyName } from "@/lib/mobile-account";
import { body, open } from "@/lib/mobile-api";
import { startSignup } from "@/lib/signup";

const Body = RegisterSchema.extend({ familyName: RegisterSchema.shape.familyName.optional() });

/**
 * Create Account, step 1 (lib/signup): emails a 6-digit code and returns the `signup` ticket that goes with it. No
 * account yet: /auth/register/verify creates it and signs in. The same answer whether or not the email already has an
 * account (that inbox gets "You already have an eGuard account" instead, and no code works).
 */
export const POST = open(async ({ req }) => {
  const b = await body(req, Body);
  const { ticket, expiresAt, email } = await startSignup(
    { name: b.name, email: b.email, familyName: b.familyName ?? defaultFamilyName(b.name), password: b.password }, clientIp(req),
  );
  return NextResponse.json({ verificationRequired: true, signup: ticket, email, expiresAt }, { status: 202 });
});
