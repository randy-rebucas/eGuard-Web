import { NextResponse } from "next/server";
import { z } from "zod";
import { childFor } from "@/lib/config-service";
import { dayTime } from "@/lib/format";
import { getFamily, historyPage } from "@/lib/queries";
import { authed, query } from "@/lib/mobile-api";

const Query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30), before: z.iso.datetime({ offset: true, error: "before must be an ISO 8601 time, e.g. a nextBefore value." }).optional() });

/** Configuration history: verified changes and changes made on the device. Page with `?before=<createdAt>`. */
export const GET = authed<{ id: string }>(async ({ req, user, params }) => {
  const q = query(req, Query);
  const child = await childFor(user.familyId, params.id);
  const family = await getFamily(user.familyId);
  const { rows, nextBefore } = await historyPage(child.id, q.limit, q.before ? new Date(q.before) : undefined);
  return NextResponse.json({
    changes: rows.map((c) => ({ id: c.id, key: c.key, title: c.title, actor: c.actor, fromValue: c.fromValue, toValue: c.toValue, createdAt: c.createdAt, timeLabel: dayTime(c.createdAt, family.timezone) })),
    nextBefore,
  });
});
