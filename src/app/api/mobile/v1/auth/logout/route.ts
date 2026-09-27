import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authed } from "@/lib/mobile-api";

/** Ends this session only. Also forgets the push token the app sends, so this phone stops getting alerts. */
export const POST = authed(async ({ req, user }) => {
  const pushToken = new URL(req.url).searchParams.get("pushToken");
  if (pushToken) await db.pushToken.deleteMany({ where: { token: pushToken, userId: user.id } });
  await db.session.delete({ where: { id: user.sessionId } });
  return NextResponse.json({ ok: true });
});
