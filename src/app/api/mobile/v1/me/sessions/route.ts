import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authed } from "@/lib/mobile-api";

/** Where this parent is signed in (Privacy & security). */
export const GET = authed(async ({ user }) => {
  const sessions = await db.session.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } });
  return NextResponse.json({
    sessions: sessions.map((s) => ({ id: s.id, userAgent: s.userAgent, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, current: s.id === user.sessionId })),
  });
});

/** Signs out everywhere else. */
export const DELETE = authed(async ({ user }) => {
  const r = await db.session.deleteMany({ where: { userId: user.id, id: { not: user.sessionId } } });
  return NextResponse.json({ signedOut: r.count });
});
