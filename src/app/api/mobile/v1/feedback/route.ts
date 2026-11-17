import { NextResponse } from "next/server";
import { authed, body } from "@/lib/mobile-api";
import { FeedbackSchema, submitFeedback } from "@/lib/feedback";

/** The app's platform, from X-eGuard-Client ("ios" / "android") */
const appPlatform = (req: Request) => ((req.headers.get("x-eguard-client") ?? "").toLowerCase() === "ios" ? "IOS" : "ANDROID") as "IOS" | "ANDROID";

/**
 * A survey answer, or "Send feedback" (docs/mobile-api.md › Feedback). `followUp: "TICKET"` means a support ticket was
 * opened for the parent (it appears in Contact Support); show `message`.
 */
export const POST = authed(async ({ req, user }) => {
  const input = await body(req, FeedbackSchema);
  const res = await submitFeedback(user, input, appPlatform(req));
  return NextResponse.json(res, { status: 201 });
});
