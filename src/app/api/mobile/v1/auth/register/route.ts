import { after } from "next/server";
import { hashPassword } from "@/lib/auth";
import { sendVerificationEmailQuietly } from "@/lib/email-verification";
import { RegisterSchema, createFamily } from "@/lib/family-service";
import { defaultFamilyName, sessionResponse } from "@/lib/mobile-account";
import { body, open } from "@/lib/mobile-api";

const Body = RegisterSchema.extend({ familyName: RegisterSchema.shape.familyName.optional() });

/** Create Account: makes a family with this parent as its admin, signs them in, and emails a verification link. */
export const POST = open(async ({ req }) => {
  const b = await body(req, Body);
  const user = await createFamily({
    name: b.name, email: b.email, familyName: b.familyName ?? defaultFamilyName(b.name), passwordHash: await hashPassword(b.password),
  });
  after(() => sendVerificationEmailQuietly(user.id));
  return sessionResponse(req, user.id, 201);
});
