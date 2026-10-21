import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, body } from "@/lib/mobile-api";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { MESSAGE_ACTIONS, markMessage } from "@/lib/parent-care/service";

const Body = z.object({ action: z.enum(MESSAGE_ACTIONS) });

/** `open` (seen), `click` (tapped: also counts as opened) or `dismiss` (hidden from the list). Each is recorded once. */
export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  await enforce(`care:${user.id}`, LIMITS.careUser);
  const { action } = await body(req, Body);
  return NextResponse.json(await markMessage(user, params.id, action));
});
