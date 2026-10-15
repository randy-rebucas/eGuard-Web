import { NextResponse, type NextRequest } from "next/server";
import { confirmPassword, getUser } from "@/lib/auth";
import { appUrl } from "@/lib/email-verification";
import { ServiceError } from "@/lib/errors";
import { FLOW_COOKIE, FLOW_MINUTES, begin, encodeFlow, isWebProvider, type Intent } from "@/lib/oauth-web";
import { failurePath } from "@/lib/oauth-paths";
import { safeNext } from "@/lib/return-to";

/**
 * "Continue with Google / LinkedIn" buttons post here (sign in, create account, Settings › Security). Remembers the
 * sign-in in a short-lived signed cookie, then sends the browser to the provider. A POST from our own pages only,
 * so another site can't start one (and tick "I'm a parent or guardian" for the visitor).
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/auth/[provider]">) {
  const { provider } = await ctx.params;
  if (!isWebProvider(provider)) return new NextResponse(null, { status: 404 });
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  const form = await req.formData().catch(() => null);
  const asked = String(form?.get("intent") ?? "");
  const intent: Intent = asked === "register" || asked === "link" ? asked : "login";
  const next = safeNext(form?.get("next"));
  const to = (path: string) => NextResponse.redirect(new URL(path, appUrl()), 303);

  const user = intent === "link" ? await getUser() : null;
  if (intent === "link" && !user) return to("/login?next=%2Fsettings%2Fsecurity");
  let started: ReturnType<typeof begin>;
  try {
    // A linked sign-in outlasts a password change and signing out everywhere, so a borrowed session alone
    // mustn't be able to add one. Accounts without a password have nothing to confirm with (they get the email).
    if (user?.hasPassword) await confirmPassword(user.id, String(form?.get("password") ?? ""));
    started = begin(provider, { intent, next, guardian: form?.get("guardian") === "on", userId: user?.id ?? null });
  } catch (e) {
    if (e instanceof ServiceError) return to(failurePath(intent, e.code ?? "failed", provider, next));
    throw e;
  }
  const res = NextResponse.redirect(started.url, 303);
  // Lax: the provider sends the browser back with a top-level GET, which carries it
  res.cookies.set(FLOW_COOKIE, encodeFlow(started.flow), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/auth", maxAge: FLOW_MINUTES * 60,
  });
  return res;
}

/** Browsers send Origin with every POST; one from another site (or a sandboxed "null") is refused. */
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  return origin === new URL(appUrl()).origin || origin === req.nextUrl.origin;
}
