import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getFamily, unreadCount } from "@/lib/queries";
import { authed, query } from "@/lib/mobile-api";
import { ALERT_FILTERS, alertJson, refreshFamily } from "@/lib/mobile-views";

const Query = z.object({
  filter: z.enum(Object.keys(ALERT_FILTERS) as [string, ...string[]]).default("ALL"),
  childId: z.string().optional(),
  includeResolved: z.enum(["true", "false"]).default("false"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
});

/** Alerts, newest first. Each has `day` ({ key, label: "Today" | "Yesterday" | … }) for section headers. */
export const GET = authed(async ({ req, user }) => {
  const q = query(req, Query);
  await refreshFamily(user.familyId);
  const cats = ALERT_FILTERS[q.filter];
  const [family, rows, unread] = await Promise.all([
    getFamily(user.familyId),
    db.alert.findMany({
      where: {
        familyId: user.familyId,
        ...(cats ? { category: { in: cats } } : {}),
        ...(q.childId ? { childId: q.childId } : {}),
        ...(q.includeResolved === "true" ? {} : { resolvedAt: null }),
        ...(q.before ? { createdAt: { lt: new Date(q.before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: q.limit + 1,
      include: { reads: { where: { userId: user.id } } },
    }),
    unreadCount(user.familyId, user.id),
  ]);
  const page = rows.slice(0, q.limit);
  return NextResponse.json({
    alerts: page.map((a) => alertJson({ ...a, read: a.reads.length > 0 }, family.timezone)),
    unread,
    nextBefore: rows.length > q.limit ? page[page.length - 1].createdAt : null,
  });
});
