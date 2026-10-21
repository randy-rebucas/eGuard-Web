import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, query } from "@/lib/mobile-api";
import { careMessages } from "@/lib/parent-care/service";

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.iso.datetime({ offset: true, error: "before must be an ISO 8601 time, e.g. a nextBefore value." }).optional(),
  channel: z.enum(["PUSH", "EMAIL", "IN_APP"]).optional(),
});

/**
 * Tips, plans and reminders eGuard sent this parent, newest first (any channel unless `channel` is given), with
 * `unread`: in-app ones not opened yet. Separate from safety alerts (/alerts). A push's data carries `messageId`.
 */
export const GET = authed(async ({ req, user }) => {
  const q = query(req, Query);
  return NextResponse.json(await careMessages(user, { limit: q.limit, before: q.before ? new Date(q.before) : undefined, channel: q.channel }));
});
