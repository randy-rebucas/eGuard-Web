import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authed, body } from "@/lib/mobile-api";

const select = { notifyPush: true, notifyEmail: true, notifyApproval: true, weeklySummary: true } as const;

/** Settings › Notifications (alert preferences). */
export const GET = authed(async ({ user }) => NextResponse.json(await db.user.findUniqueOrThrow({ where: { id: user.id }, select })));

const Body = z.object({
  notifyPush: z.boolean(), notifyEmail: z.boolean(), notifyApproval: z.boolean(), weeklySummary: z.boolean(),
}).partial();

export const PATCH = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  return NextResponse.json(await db.user.update({ where: { id: user.id }, data: b, select }));
});
