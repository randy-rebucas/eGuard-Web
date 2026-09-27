import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authed, body } from "@/lib/mobile-api";

const Body = z.object({ token: z.string().trim().min(10).max(4096), platform: z.enum(["IOS", "ANDROID"]) });

/**
 * Registers this phone's APNs/FCM token. A token belongs to one parent at a time, so signing in
 * as someone else on the same phone moves it. Delivery isn't wired up yet (see README).
 */
export const POST = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  await db.pushToken.upsert({
    where: { token: b.token },
    create: { token: b.token, platform: b.platform, userId: user.id },
    update: { platform: b.platform, userId: user.id },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
});

export const DELETE = authed(async ({ req, user }) => {
  const b = await body(req, Body.pick({ token: true }));
  await db.pushToken.deleteMany({ where: { token: b.token, userId: user.id } });
  return NextResponse.json({ ok: true });
});
