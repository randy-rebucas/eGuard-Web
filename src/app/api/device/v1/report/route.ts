import { NextResponse } from "next/server";
import { z } from "zod";
import { processReport } from "@/lib/engine";
import { ReportedConfigSchema } from "@/lib/config-service";
import { authDevice, badRequest, readJson, unauthorized } from "@/lib/device-auth";

const KEYS = ["SCREEN_TIME", "BEDTIME", "APP_RESTRICTIONS", "APP_APPROVAL", "CONTENT", "WEB", "DOWNLOADS", "LOCATION", "NOTIFICATIONS", "UNINSTALL_PROTECTION"] as const;

const Body = z.object({
  protections: z.array(z.object({ key: z.enum(KEYS), config: z.record(z.string(), z.unknown()) })).max(20),
  full: z.boolean().optional(),
  battery: z.number().int().min(0).max(100).nullable().optional(),
  osVersion: z.string().max(40).optional(),
  appVersion: z.string().max(20).optional(),
});

/**
 * The device reports the configuration it actually has. eGuard verifies against requests and policy.
 * A protection whose config doesn't match ReportedConfigSchema is skipped (and named in `ignored`) rather than
 * stored: parents' pages render reported configs, and the rest of the report still counts.
 */
export async function POST(req: Request) {
  const device = await authDevice(req);
  if (!device) return unauthorized();
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const protections: typeof parsed.data.protections = [];
  const ignored: { key: string; error: string }[] = [];
  for (const p of parsed.data.protections) {
    const config = ReportedConfigSchema.safeParse({ ...p.config, key: p.key });
    if (config.success) protections.push({ key: p.key, config: config.data });
    else ignored.push({ key: p.key, error: `${config.error.issues[0].path.join(".") || "config"}: ${config.error.issues[0].message}` });
  }
  if (ignored.length) console.warn("[device] report entries ignored", device.id, device.appVersion, ignored);
  await processReport(device.id, { ...parsed.data, protections });
  return NextResponse.json({ ok: true, ...(ignored.length ? { ignored } : {}) });
}
