import { NextResponse } from "next/server";
import { authed } from "@/lib/mobile-api";
import { feedbackPrompts } from "@/lib/feedback";

/**
 * What the app may ask the parent now (docs/mobile-api.md › Feedback). `nps.due`: show the survey (then POST
 * /feedback/nps with "seen"). Ask on the parent's home screen after it has loaded, never at launch or after an error.
 */
export const GET = authed(async ({ user }) => {
  const p = await feedbackPrompts(user);
  return NextResponse.json({ nps: { due: p.nps.due } });
});
