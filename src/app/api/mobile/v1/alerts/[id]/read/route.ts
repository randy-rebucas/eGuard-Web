import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { unreadCount } from "@/lib/queries";
import { authed } from "@/lib/mobile-api";

export const POST = authed<{ id: string }>(async ({ user, params }) => {
  if (!(await db.alert.findFirst({ where: { id: params.id, familyId: user.familyId } }))) throw notFound("Alert");
  await db.alertRead.upsert({ where: { alertId_userId: { alertId: params.id, userId: user.id } }, create: { alertId: params.id, userId: user.id }, update: {} });
  return NextResponse.json({ ok: true, unread: await unreadCount(user.familyId, user.id) });
});
