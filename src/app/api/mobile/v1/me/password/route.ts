import { NextResponse } from "next/server";
import { z } from "zod";
import { changePassword } from "@/lib/family-service";
import { authed, body } from "@/lib/mobile-api";

const Body = z.object({ current: z.string().min(1, "Enter your current password."), next: z.string() });

/** Changes the password and signs out every other session (web and phones); this one stays signed in. */
export const POST = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  await changePassword(user, b.current, b.next);
  return NextResponse.json({ ok: true, message: "Password changed. Other sessions were signed out." });
});
