import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ServiceError, notFound } from "@/lib/errors";
import { authed } from "@/lib/mobile-api";

/** Only informational alerts can be dismissed; the rest resolve when the problem is fixed. */
export const POST = authed<{ id: string }>(async ({ user, params }) => {
  const a = await db.alert.findFirst({ where: { id: params.id, familyId: user.familyId } });
  if (!a) throw notFound("Alert");
  if (a.severity !== "INFO") throw new ServiceError(409, "This alert clears on its own once the issue is fixed.", "not_dismissible");
  await db.alert.update({ where: { id: a.id }, data: { resolvedAt: a.resolvedAt ?? new Date() } });
  return NextResponse.json({ ok: true });
});
