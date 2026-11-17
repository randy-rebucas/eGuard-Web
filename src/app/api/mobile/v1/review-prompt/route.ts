import { NextResponse } from "next/server";
import { authed } from "@/lib/mobile-api";
import { ratePrompt, recordRatePrompt, type AppPlatform } from "@/lib/review-prompts";

/** The app's platform, from X-eGuard-Client ("ios" / "android") */
const appPlatform = (req: Request): AppPlatform => ((req.headers.get("x-eguard-client") ?? "").toLowerCase() === "ios" ? "IOS" : "ANDROID");

/**
 * May the app ask the store for its review prompt now (docs/mobile-api.md › Store rating)? Check only right after
 * something went well (a change confirmed, a request answered), never at launch, after an error, or after a question.
 */
export const GET = authed(async ({ req, user }) => {
  const d = await ratePrompt(user, appPlatform(req));
  return NextResponse.json({ eligible: d.eligible, reason: d.reason });
});

/** The app asked the store for its prompt (whether the card showed is the store's to know) */
export const POST = authed(async ({ req, user }) => {
  await recordRatePrompt(user, appPlatform(req));
  return NextResponse.json({ ok: true });
});
