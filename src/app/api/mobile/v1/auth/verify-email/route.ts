import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmailToken } from "@/lib/email-verification";
import { apiError, body, open } from "@/lib/mobile-api";

const Body = z.object({ token: z.string().min(1).max(200) });

/** For an app that opens the emailed link itself (universal / app link to /verify-email?token=…). */
export const POST = open(async ({ req }) => {
  const r = await verifyEmailToken((await body(req, Body)).token);
  if (r === "expired") return apiError(400, "This link has expired. Send yourself a new one from the app.", "link_expired");
  if (r === "invalid") return apiError(400, "This link has already been used or isn't valid.", "link_invalid");
  return NextResponse.json({ ok: true });
});
