import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, body } from "@/lib/mobile-api";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { careActivity, completeActivity, dismissActivity, restoreActivity, startActivity } from "@/lib/parent-care/service";

export const GET = authed<{ key: string }>(async ({ user, params }) => NextResponse.json(await careActivity(user, params.key)));

const Body = z.object({ action: z.enum(["start", "complete", "dismiss", "restore"]) });

/**
 * `start` schedules one follow-up about 24 hours later (cancelled by `complete` or `dismiss`); `complete` works
 * without starting first. Repeating an action is a no-op. 409 `already_completed` for starting a one-time activity
 * that's done.
 */
export const POST = authed<{ key: string }>(async ({ req, user, params }) => {
  await enforce(`care:${user.id}`, LIMITS.careUser);
  const { action } = await body(req, Body);
  const run = { start: startActivity, complete: completeActivity, dismiss: dismissActivity, restore: restoreActivity }[action];
  return NextResponse.json(await run(user, params.key));
});
