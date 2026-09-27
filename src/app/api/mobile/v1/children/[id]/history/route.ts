import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { childFor } from "@/lib/config-service";
import { dayTime } from "@/lib/format";
import { getFamily } from "@/lib/queries";
import { authed, query } from "@/lib/mobile-api";

const Query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30), before: z.string().datetime().optional() });

/** Configuration history: verified changes and changes made on the device. Page with `?before=<createdAt>`. */
export const GET = authed<{ id: string }>(async ({ req, user, params }) => {
  const q = query(req, Query);
  const child = await childFor(user.familyId, params.id);
  const family = await getFamily(user.familyId);
  const rows = await db.configChange.findMany({
    where: { childId: child.id, ...(q.before ? { createdAt: { lt: new Date(q.before) } } : {}) },
    orderBy: { createdAt: "desc" }, take: q.limit + 1,
  });
  const page = rows.slice(0, q.limit);
  return NextResponse.json({
    changes: page.map((c) => ({ id: c.id, key: c.key, title: c.title, actor: c.actor, fromValue: c.fromValue, toValue: c.toValue, createdAt: c.createdAt, timeLabel: dayTime(c.createdAt, family.timezone) })),
    nextBefore: rows.length > q.limit ? page[page.length - 1].createdAt : null,
  });
});
