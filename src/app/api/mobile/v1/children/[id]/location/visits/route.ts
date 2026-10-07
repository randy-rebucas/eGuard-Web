import { NextResponse } from "next/server";
import { z } from "zod";
import { childFor } from "@/lib/config-service";
import { isDayKey, visitsForDay, visitsPage } from "@/lib/location";
import { getFamily } from "@/lib/queries";
import { authed, query } from "@/lib/mobile-api";
import { visitJson } from "@/lib/mobile-views";
import { requireLocationSharing } from "@/lib/plan-access";

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.iso.datetime({ offset: true, error: "before must be an ISO 8601 time, e.g. a nextBefore value." }).optional(),
  day: z.string().refine(isDayKey, "day must be a date, YYYY-MM-DD.").optional(),
});

/**
 * Location › "View All": every visit kept (up to the family's retention period), newest first.
 * With `day` (YYYY-MM-DD in the family's time zone): that day's route instead, oldest first, all at once
 * (`limit` and `before` are ignored and `nextBefore` is null). A visit spanning midnight is in both days.
 * Empty with `enabled: false` unless the family keeps location history. 403 `plan_required` on Free.
 */
export const GET = authed<{ id: string }>(async ({ req, user, params }) => {
  const q = query(req, Query);
  const child = await childFor(user.familyId, params.id);
  await requireLocationSharing(user.familyId);
  const family = await getFamily(user.familyId);
  const { visits, nextBefore } = !family.keepLocationHistory ? { visits: [], nextBefore: null }
    : q.day ? { visits: await visitsForDay(child.id, q.day, family.timezone), nextBefore: null }
    : await visitsPage(child.id, { before: q.before ? new Date(q.before) : undefined, limit: q.limit });
  return NextResponse.json({
    enabled: family.keepLocationHistory,
    retentionDays: family.retentionDays,
    visits: visits.map((v) => visitJson(v, family.timezone)),
    nextBefore,
  });
});
