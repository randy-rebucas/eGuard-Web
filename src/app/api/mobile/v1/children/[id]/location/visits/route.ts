import { NextResponse } from "next/server";
import { z } from "zod";
import { childFor } from "@/lib/config-service";
import { visitsPage } from "@/lib/location";
import { dayTime } from "@/lib/format";
import { getFamily } from "@/lib/queries";
import { authed, query } from "@/lib/mobile-api";
import { dayGroup } from "@/lib/mobile-views";
import { requireLocationSharing } from "@/lib/plan-access";

const Query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), before: z.iso.datetime({ offset: true, error: "before must be an ISO 8601 time, e.g. a nextBefore value." }).optional() });

/**
 * Location › "View All": every visit kept (up to the family's retention period), newest first.
 * Empty with `enabled: false` unless the family keeps location history. 403 `plan_required` on Free.
 */
export const GET = authed<{ id: string }>(async ({ req, user, params }) => {
  const q = query(req, Query);
  const child = await childFor(user.familyId, params.id);
  await requireLocationSharing(user.familyId);
  const family = await getFamily(user.familyId);
  const { visits, nextBefore } = family.keepLocationHistory
    ? await visitsPage(child.id, { before: q.before ? new Date(q.before) : undefined, limit: q.limit })
    : { visits: [], nextBefore: null };
  return NextResponse.json({
    enabled: family.keepLocationHistory,
    retentionDays: family.retentionDays,
    visits: visits.map((v) => ({
      id: v.id, deviceName: v.device.name, lat: v.lat, lng: v.lng, placeLabel: v.placeLabel,
      arrivedAt: v.arrivedAt, lastSeenAt: v.lastSeenAt, timeLabel: dayTime(v.arrivedAt, family.timezone), day: dayGroup(v.arrivedAt, family.timezone),
    })),
    nextBefore,
  });
});
