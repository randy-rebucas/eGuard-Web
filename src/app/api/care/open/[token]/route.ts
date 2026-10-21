import { NextResponse } from "next/server";
import { openByToken } from "@/lib/parent-care/service";
import { LIMITS, clientIpFrom, hit, ipKey } from "@/lib/rate-limit";

/**
 * A parent-care email's button: records the click once, then opens the page in eGuard (always an app path, so the
 * link can't be turned into a redirect elsewhere). Signed out, that page asks them to sign in first and returns.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/care/open/[token]">) {
  const { token } = await ctx.params;
  if ((await hit(ipKey("token", clientIpFrom(req.headers)), LIMITS.tokenIp)).limited) return NextResponse.redirect(new URL("/plan", req.url));
  let link: string | null = null;
  try {
    link = await openByToken(token);
  } catch (e) {
    // Tracking must never stop the parent from getting where they meant to go
    console.error("[parent-care] click tracking failed", e);
  }
  return NextResponse.redirect(new URL(link ?? "/plan", req.url), 303);
}
