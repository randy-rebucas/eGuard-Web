import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, query } from "@/lib/mobile-api";
import { careReport } from "@/lib/parent-care/service";

const Query = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM.").optional() });

/**
 * A month's progress report (default: last month in the parent's time zone): activities completed and started,
 * protection changes the family made, weekly plans, and one next step. Only counts of what really happened.
 */
export const GET = authed(async ({ req, user }) => {
  const q = query(req, Query);
  return NextResponse.json(await careReport(user, q.month));
});
