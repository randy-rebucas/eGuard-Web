import { NextResponse } from "next/server";
import { ParentSchema, addParent } from "@/lib/family-service";
import { authed, body } from "@/lib/mobile-api";

/** Family admin adds another parent with a temporary password. */
export const POST = authed(async ({ req, user }) => {
  const b = await body(req, ParentSchema);
  const m = await addParent(user, b);
  return NextResponse.json({ id: m.id, name: m.name, email: m.email, role: m.role }, { status: 201 });
});
