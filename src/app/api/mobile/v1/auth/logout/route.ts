import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authed } from "@/lib/mobile-api";
import { readText } from "@/lib/request-body";

/**
 * The push token to forget: `{ "pushToken": "…" }` in the body (kept out of access logs), or `?pushToken=` from older
 * apps. Signing out never fails over the body: anything unreadable is treated as no token.
 */
async function pushTokenOf(req: Request) {
  let fromBody: unknown;
  try {
    const text = await readText(req);
    if (text) fromBody = (JSON.parse(text) as { pushToken?: unknown } | null)?.pushToken;
  } catch { /* no body token */ }
  const token = typeof fromBody === "string" && fromBody ? fromBody : new URL(req.url).searchParams.get("pushToken");
  return token && token.length <= 4096 ? token : null;
}

/** Ends this session only. Also forgets the push token the app sends, so this phone stops getting alerts. */
export const POST = authed(async ({ req, user }) => {
  const pushToken = await pushTokenOf(req);
  if (pushToken) await db.pushToken.deleteMany({ where: { token: pushToken, userId: user.id } });
  // deleteMany: signing out twice at once (or after "sign out everywhere") is still a success
  await db.session.deleteMany({ where: { id: user.sessionId } });
  return NextResponse.json({ ok: true });
});
