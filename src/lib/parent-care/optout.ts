import "server-only";
import { db } from "../db";
import { recordEvent } from "./events";
import { localDay } from "./schedule";

/**
 * A parent-care email's "Stop these emails" link (and mail apps' one-click unsubscribe, through
 * api/email/unsubscribe): turns parent-care email off, withdraws its consent and records an opt-out against the
 * channel, effective for the very next job. Alerts and other emails aren't affected. Null for a token that isn't
 * a parent-care message's.
 */
export async function optOutByToken(token: string, now = new Date()): Promise<"care" | null> {
  if (!token || token.length > 64) return null;
  const m = await db.parentCareMessage.findUnique({ where: { token }, select: { userId: true, automationKey: true, user: { select: { familyId: true } } } });
  if (!m) return null;
  await db.parentCarePreference.updateMany({ where: { userId: m.userId }, data: { email: false, emailConsentAt: null } });
  await db.parentCareSuppression.upsert({
    where: { userId_scope_reason: { userId: m.userId, scope: "CHANNEL:EMAIL", reason: "OPT_OUT" } },
    create: { userId: m.userId, scope: "CHANNEL:EMAIL", reason: "OPT_OUT" }, update: {},
  });
  await recordEvent({
    userId: m.userId, familyId: m.user.familyId, type: "NOTIFICATION_OPTED_OUT", eventId: `optout:email:${m.userId}:${localDay(now, "UTC")}`, at: now,
    meta: { channel: "EMAIL", via: "email_link", automation: m.automationKey },
  });
  return "care";
}
