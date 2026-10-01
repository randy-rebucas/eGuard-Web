import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getFamily, unreadCount } from "@/lib/queries";
import { pageByTime } from "@/lib/paging";
import { authed, query } from "@/lib/mobile-api";
import { ALERT_FILTERS, alertJson, refreshFamily } from "@/lib/mobile-views";

const Query = z.object({
  filter: z.enum(Object.keys(ALERT_FILTERS) as [string, ...string[]]).default("ALL"),
  childId: z.string().optional(),
  includeResolved: z.enum(["true", "false"]).default("false"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.iso.datetime({ offset: true, error: "before must be an ISO 8601 time, e.g. a nextBefore value." }).optional(),
});

/** Alerts, newest first. Each has `day` ({ key, label: "Today" | "Yesterday" | … }) for section headers. */
export const GET = authed(async ({ req, user }) => {
  const q = query(req, Query);
  await refreshFamily(user.familyId);
  const cats = ALERT_FILTERS[q.filter];
  const [family, page, unread] = await Promise.all([
    getFamily(user.familyId),
    pageByTime(q.limit, (createdAt, take) => db.alert.findMany({
      where: {
        familyId: user.familyId,
        ...(cats ? { category: { in: cats } } : {}),
        ...(q.childId ? { childId: q.childId } : {}),
        ...(q.includeResolved === "true" ? {} : { resolvedAt: null }),
        createdAt,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      include: { reads: { where: { userId: user.id } } },
    }), (a) => a.createdAt, q.before ? new Date(q.before) : undefined),
    unreadCount(user.familyId, user.id),
  ]);
  return NextResponse.json({
    alerts: page.rows.map((a) => alertJson({ ...a, read: a.reads.length > 0 }, family.timezone)),
    unread,
    nextBefore: page.nextBefore,
  });
});
