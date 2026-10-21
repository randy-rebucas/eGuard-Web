import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, body } from "@/lib/mobile-api";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { CLIENT_EVENT_TYPES, recordEvents } from "@/lib/parent-care/events";
import { markMessage, notePlanOpened } from "@/lib/parent-care/service";

const Event = z.object({
  /** The app's own id for the event (a UUID), so resending a queue after being offline records each once */
  eventId: z.string().regex(/^[\w-]{8,64}$/, "eventId must be 8–64 letters, digits, - or _."),
  type: z.enum(CLIENT_EVENT_TYPES),
  occurredAt: z.iso.datetime({ offset: true }).optional(),
  /** NOTIFICATION_OPENED / NOTIFICATION_CLICKED: which message (from a push's data or /care/messages) */
  messageId: z.string().max(64).optional(),
  /** REPORT_VIEWED: YYYY-MM */
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
const Body = z.object({ events: z.array(Event).min(1).max(50) });

/**
 * Events the app reports itself: a push opened or tapped, the Safety plan or a report viewed. Always about the
 * signed-in parent; a message id that isn't theirs is skipped. Times more than a week old or in the future are
 * clamped to now. Answers how many were new (`recorded`) and which were skipped.
 */
export const POST = authed(async ({ req, user }) => {
  await enforce(`care:${user.id}`, LIMITS.careUser);
  const { events } = await body(req, Body);
  const now = Date.now();
  let recorded = 0;
  const skipped: string[] = [];
  for (const e of events) {
    const t = e.occurredAt ? Date.parse(e.occurredAt) : now;
    const at = new Date(t > now + 5 * 60_000 || t < now - 7 * 864e5 ? now : t);
    if (e.type === "NOTIFICATION_OPENED" || e.type === "NOTIFICATION_CLICKED") {
      if (!e.messageId) { skipped.push(e.eventId); continue; }
      try {
        await markMessage(user, e.messageId, e.type === "NOTIFICATION_OPENED" ? "open" : "click", at);
        recorded++;
      } catch {
        skipped.push(e.eventId);
      }
    } else if (e.type === "PLAN_OPENED") {
      await notePlanOpened(user, at);
      recorded++;
    } else {
      recorded += await recordEvents([{
        userId: user.id, familyId: user.familyId, type: e.type, eventId: `client:${user.id}:${e.eventId}`, at, meta: { month: e.month ?? null, via: "app" },
      }]);
    }
  }
  return NextResponse.json({ recorded, skipped });
});
