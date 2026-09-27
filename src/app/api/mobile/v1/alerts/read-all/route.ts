import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authed } from "@/lib/mobile-api";

export const POST = authed(async ({ user }) => {
  const alerts = await db.alert.findMany({ where: { familyId: user.familyId, reads: { none: { userId: user.id } } }, select: { id: true } });
  await db.alertRead.createMany({ data: alerts.map((a) => ({ alertId: a.id, userId: user.id })), skipDuplicates: true });
  return NextResponse.json({ marked: alerts.length, unread: 0 });
});
