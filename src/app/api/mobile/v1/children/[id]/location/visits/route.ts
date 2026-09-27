import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { childFor } from "@/lib/config-service";
import { dayTime } from "@/lib/format";
import { getFamily } from "@/lib/queries";
import { authed, query } from "@/lib/mobile-api";
import { dayGroup } from "@/lib/mobile-views";

const Query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), before: z.string().datetime().optional() });

/**
 * Location › "View All": every visit kept (up to the family's retention period), newest first.
 * Empty with `enabled: false` unless the family keeps location history.
 */
export const GET = authed<{ id: string }>(async ({ req, user, params }) => {
  const q = query(req, Query);
  const child = await childFor(user.familyId, params.id);
  const family = await getFamily(user.familyId);
  const rows = family.keepLocationHistory
    ? await db.locationVisit.findMany({
        where: { childId: child.id, ...(q.before ? { arrivedAt: { lt: new Date(q.before) } } : {}) },
        orderBy: { arrivedAt: "desc" }, take: q.limit + 1, include: { device: { select: { name: true } } },
      })
    : [];
  const page = rows.slice(0, q.limit);
  return NextResponse.json({
    enabled: family.keepLocationHistory,
    retentionDays: family.retentionDays,
    visits: page.map((v) => ({
      id: v.id, deviceName: v.device.name, lat: v.lat, lng: v.lng, placeLabel: v.placeLabel,
      arrivedAt: v.arrivedAt, lastSeenAt: v.lastSeenAt, timeLabel: dayTime(v.arrivedAt, family.timezone), day: dayGroup(v.arrivedAt, family.timezone),
    })),
    nextBefore: rows.length > q.limit ? page[page.length - 1].arrivedAt : null,
  });
});
