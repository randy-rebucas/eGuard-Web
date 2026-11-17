import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, body } from "@/lib/mobile-api";
import { npsEvent } from "@/lib/feedback";

const Body = z.object({ event: z.enum(["seen", "dismissed"]) });

/** The app showed the survey ("seen"), or the parent chose "Not now" ("dismissed"): it waits before asking again */
export const POST = authed(async ({ req, user }) => {
  const { event } = await body(req, Body);
  await npsEvent(user, event);
  return NextResponse.json({ ok: true });
});
