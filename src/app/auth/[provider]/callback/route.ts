import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { ServiceError } from "@/lib/errors";
import { FLOW_COOKIE, decodeFlow, finish, isWebProvider, stateMatches, type Flow } from "@/lib/oauth-web";
import { failurePath } from "@/lib/oauth-paths";
import { LIMITS, clientIpFrom, enforce, ipKey } from "@/lib/rate-limit";
import type { Identity } from "@/lib/social-auth";
import { linkIdentity, signInWithIdentity } from "@/lib/social-signin";
import { completeWebSignIn } from "@/lib/web-signin";

/** What the provider says when the parent pressed Cancel on its consent page (Google, then LinkedIn's two). */
const CANCELLED = ["access_denied", "user_cancelled_login", "user_cancelled_authorize"];

/** Codes lib/oauth-errors has a message for; anything else is shown as "failed". */
const SHOWN = ["provider_unavailable", "provider_not_configured", "invalid_token", "email_required", "guardian_required", "rate_limited"];

/**
 * The provider sends the browser back here. Checks it's the sign-in this browser started, gets the parent's
 * identity, then signs in (or creates the family, or links it to the signed-in parent's account).
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/auth/[provider]/callback">) {
  const { provider } = await ctx.params;
  if (!isWebProvider(provider)) return new NextResponse(null, { status: 404 });
  const jar = await cookies();
  const flow = decodeFlow(jar.get(FLOW_COOKIE)?.value);
  // One use: a reload, or the back button, can't run the same sign-in again
  jar.set(FLOW_COOKIE, "", { path: "/auth", maxAge: 0 });

  const q = req.nextUrl.searchParams;
  const intent = flow?.intent ?? "login";
  const back = (code: string): never => redirect(failurePath(intent, code, provider, flow?.next ?? null));

  // No cookie, another provider's, or a state we didn't make: started in another browser, expired, or forged
  if (!flow || flow.provider !== provider || !stateMatches(flow.state, q.get("state"))) back("expired");
  const f = flow as Flow;
  const err = q.get("error");
  if (err) back(CANCELLED.includes(err) ? "cancelled" : "failed");
  const code = q.get("code");
  if (!code) back("failed");

  // Linking needs the parent who confirmed it still signed in here: not signed out in another tab meanwhile, and
  // not a different session swapped in after someone confirmed with their own password
  const user = f.intent === "link" ? await getUser() : null;
  if (f.intent === "link" && (!user || !f.userId || user.id !== f.userId)) back("expired");

  // redirect() works by throwing, so it's only called outside this try
  let userId: string | null = null;
  try {
    await enforce(ipKey("social", clientIpFrom(req.headers)), LIMITS.socialIp);
    const id: Identity = await finish(f, code!);
    if (user) await linkIdentity(user, id);
    else userId = (await signInWithIdentity(id, { guardian: f.guardian })).userId;
  } catch (e) {
    back(failureCode(e, !!user, provider));
  }

  if (!userId) redirect(`/settings/security?linked=${provider}`);
  return completeWebSignIn(userId, f.next);
}

function failureCode(e: unknown, linking: boolean, provider: string) {
  if (!(e instanceof ServiceError)) {
    console.error(`[auth] ${provider} sign-in failed`, e);
    return "failed";
  }
  if (e.code === "conflict") return linking ? "linked_elsewhere" : "mailbox_taken";
  return e.code && SHOWN.includes(e.code) ? e.code : "failed";
}
