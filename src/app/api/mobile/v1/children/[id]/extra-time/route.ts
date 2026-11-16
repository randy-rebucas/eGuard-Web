import { NextResponse } from "next/server";
import { z } from "zod";
import { childFor } from "@/lib/config-service";
import { EXTRA_TIME_MINUTES, endExtraTime, extraTimeFor, grantExtraTime } from "@/lib/family-service";
import { authed, body, clientLabel } from "@/lib/mobile-api";

/**
 * Extra time: `until` (ISO, null when none is running) and the child's open request for more time (`request`, null
 * when there's none). While extra time runs, the child's devices don't pause apps for limits or bedtime.
 */
export const GET = authed<{ id: string }>(async ({ user, params }) => {
  const child = await childFor(user.familyId, params.id);
  const t = await extraTimeFor(user, child.id);
  return NextResponse.json({
    until: t.until?.toISOString() ?? null,
    request: t.request ? { body: t.request.body, askedAt: t.request.askedAt.toISOString() } : null,
    choices: EXTRA_TIME_MINUTES,
  });
});

const Body = z.object({
  minutes: z.number().int().refine((m) => (EXTRA_TIME_MINUTES as readonly number[]).includes(m), `Choose ${EXTRA_TIME_MINUTES.join(", ")} minutes.`),
  // Optional: the same id on a retry (the answer was lost) never grants twice. A UUID is the usual choice
  requestId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/, "use 8–64 letters, digits, - or _.").optional(),
});

/** Gives `minutes` more (added to extra time still running, up to 4 hours ahead) and answers an open request. */
export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, Body);
  const child = await childFor(user.familyId, params.id);
  const r = await grantExtraTime(user, child.id, b.minutes, clientLabel(req), b.requestId);
  // `addedMinutes` is less than `minutes` when extra time would run more than 4 hours ahead. `replayed`: this
  // requestId was already granted and nothing more was added (still 200, with the first grant's addedMinutes)
  return NextResponse.json({ until: r.extraTimeUntil.toISOString(), addedMinutes: r.addedMinutes, replayed: r.replayed });
});

/** Ends running extra time, and answers an open request with "not now". */
export const DELETE = authed<{ id: string }>(async ({ req, user, params }) => {
  const child = await childFor(user.familyId, params.id);
  await endExtraTime(user, child.id, clientLabel(req));
  return NextResponse.json({ until: null });
});
