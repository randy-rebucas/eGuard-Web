import { NextResponse, after } from "next/server";
import { sendVerificationEmailQuietly } from "@/lib/email-verification";
import { ParentSchema, addParent } from "@/lib/family-service";
import { authed, body } from "@/lib/mobile-api";

/** Family admin adds another parent with a temporary password. They get an email to verify their address. */
export const POST = authed(async ({ req, user }) => {
  const b = await body(req, ParentSchema);
  const m = await addParent(user, b);
  after(() => sendVerificationEmailQuietly(m.id));
  return NextResponse.json({ id: m.id, name: m.name, email: m.email, role: m.role }, { status: 201 });
});
