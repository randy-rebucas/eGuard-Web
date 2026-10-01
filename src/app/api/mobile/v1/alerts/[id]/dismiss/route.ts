import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ServiceError, notFound } from "@/lib/errors";
import { authed } from "@/lib/mobile-api";
import { isDismissible } from "@/lib/health";

/** Alerts that clear on their own (they have a resolveKey) can't be dismissed; see isDismissible. */
export const POST = authed<{ id: string }>(async ({ user, params }) => {
  const a = await db.alert.findFirst({ where: { id: params.id, familyId: user.familyId } });
  if (!a) throw notFound("Alert");
  // Already resolved: dismissing again is a no-op, not an error
  if (!a.resolvedAt && !isDismissible(a)) throw new ServiceError(409, "This alert clears on its own once the issue is fixed.", "not_dismissible");
  await db.alert.update({ where: { id: a.id }, data: { resolvedAt: a.resolvedAt ?? new Date() } });
  return NextResponse.json({ ok: true });
});
