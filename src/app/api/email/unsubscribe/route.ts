import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/broadcasts";
import { LIMITS, clientIpFrom, hit, ipKey } from "@/lib/rate-limit";

/**
 * RFC 8058 one-click unsubscribe: the List-Unsubscribe header of a product update points here, and mail apps POST
 * to it from their own "Unsubscribe" button. Only POST: a GET (a link scanner opening it) must change nothing, so
 * the link in the email body goes to the /unsubscribe page and its button instead.
 */
export async function POST(req: Request) {
  if ((await hit(ipKey("token", clientIpFrom(req.headers)), LIMITS.tokenIp)).limited) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const result = await unsubscribeByToken(new URL(req.url).searchParams.get("t") ?? "");
  // "list": a mailing-list subscriber, now deleted (or already gone, from an earlier press)
  return result === "invalid" ? NextResponse.json({ error: "This link doesn't work." }, { status: 404 }) : NextResponse.json({ ok: true });
}
