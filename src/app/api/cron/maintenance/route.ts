import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runMaintenance } from "@/lib/maintenance";

/**
 * Background upkeep: offline-device alerts, alert emails, subscription re-checks and data retention.
 * Call every 5–15 minutes with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this header
 * itself when CRON_SECRET is set; elsewhere use any scheduler, e.g. `curl -H ...` from cron).
 * Without CRON_SECRET it only runs in development.
 */
export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const started = Date.now();
  const result = await runMaintenance();
  return NextResponse.json({ ok: true, ms: Date.now() - started, ...result });
}

export const GET = run;
export const POST = run;
