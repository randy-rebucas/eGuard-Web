import "server-only";
import type { ProtectionKey } from "@prisma/client";
import { db } from "./db";
import { deviceSync, processReport, type ReportedProtection } from "./engine";

/**
 * Dev-only stand-in for the Android/iOS apps. Devices flagged `simulated`
 * go through the exact same sync/report code paths the mobile API uses.
 * Enabled with DEVICE_SIMULATOR=true. Never enable in production.
 */
export const simulatorEnabled = () => process.env.DEVICE_SIMULATOR === "true" && process.env.NODE_ENV !== "production";

const RESPONSE_DELAY_MS = 1500;

function stripKey(cfg: unknown): Record<string, unknown> {
  const rest = { ...((cfg ?? {}) as Record<string, unknown>) };
  delete rest.key;
  return rest;
}

/** Keep simulated online devices looking online. */
export async function touchSimulated(familyId: string) {
  if (!simulatorEnabled()) return;
  await db.device.updateMany({
    where: { familyId, simulated: true, simulatedOnline: true, lastSeenAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    data: { lastSeenAt: new Date() },
  });
}

/** Advance every simulated device one step: pick up requests, apply, report. */
export async function simulateTick(familyId: string) {
  if (!simulatorEnabled()) return;
  const cutoff = new Date(Date.now() - RESPONSE_DELAY_MS);
  const devices = await db.device.findMany({
    where: { familyId, simulated: true, simulatedOnline: true },
    include: {
      protections: true,
      requests: { where: { status: { in: ["PENDING", "DELIVERED"] }, createdAt: { lt: cutoff } } },
    },
  });
  for (const d of devices) {
    const due = d.requests.filter((r) => r.mode === "APPLY" || r.status === "DELIVERED");
    const checkDue = d.checkRequestedAt && d.checkRequestedAt < cutoff;
    if (!due.length && !checkDue) continue;

    const sync = await deviceSync(d.id, {});
    // Apply what was requested (APPLY requests) or what the parent set up by hand (GUIDED, DELIVERED)
    const applied = new Map<ProtectionKey, Record<string, unknown>>();
    for (const r of sync.requests) applied.set(r.key, stripKey(r.config));
    for (const r of due.filter((x) => x.mode === "GUIDED")) applied.set(r.key, stripKey(r.desired));

    const protections: ReportedProtection[] = checkDue
      ? d.protections.map((p) => ({ key: p.key, config: applied.get(p.key) ?? stripKey(p.reported) }))
      : [...applied].map(([key, config]) => ({ key, config }));
    await processReport(d.id, { protections, full: !!checkDue, battery: d.battery });
  }
}
