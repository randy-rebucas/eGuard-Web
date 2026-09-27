import { NextResponse } from "next/server";
import { unlinkIdentity } from "@/lib/family-service";
import { authed } from "@/lib/mobile-api";

/** Unlinks a sign-in. 409 if it's the parent's only way to sign in (no password set yet). */
export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  await unlinkIdentity(user, params.id);
  return NextResponse.json({ ok: true });
});
