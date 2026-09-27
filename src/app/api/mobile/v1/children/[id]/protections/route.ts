import { NextResponse } from "next/server";
import { childProtections } from "@/lib/config-service";
import { authed } from "@/lib/mobile-api";

/** Protection & Controls for one child: each protection's policy and what every device reports. */
export const GET = authed<{ id: string }>(async ({ user, params }) =>
  NextResponse.json({ protections: await childProtections(user.familyId, params.id) }));
