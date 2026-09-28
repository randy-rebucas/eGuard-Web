import "server-only";
import type { CheckStatus, Device, Prisma, ProtectionKey } from "@prisma/client";
import { db } from "./db";
import { PROTECTION_BY_KEY, configMatches, describeConfig, isConfigured } from "./protections";
import { evaluate, isPassing } from "./health";

export type ReportedProtection = { key: ProtectionKey; config: Record<string, unknown> };

export type DeviceReport = {
  protections: ReportedProtection[];
  battery?: number | null;
  osVersion?: string;
  appVersion?: string;
  /** true when the device sends every protection (full check) */
  full?: boolean;
};

/**
 * While a parent's change is in flight, a device reporting something other than the current policy is
 * expected (it's mid-change), so no tamper alert. Only for this long: requests can stay open indefinitely
 * (an offline device, a guided setup never finished), and must not silence tampering forever.
 */
export const CHANGE_GRACE_MS = 6 * 3600_000;

const deviceLabel =(d: { name: string; child: { name: string } }) => `${d.child.name}'s ${d.name}`;

function messageFor(status: CheckStatus, key: ProtectionKey, label: string, reported: unknown) {
  if (isPassing(status)) return null;
  const name = PROTECTION_BY_KEY[key].name;
  if (status === "NOT_CONFIGURED") return `Not configured on ${label}`;
  if (key === "LOCATION" && !isConfigured(reported)) return `Sharing turned off on ${label}`;
  if (status === "ACTION_REQUIRED") return `${name} turned off on ${label}`;
  return `${name} on ${label} doesn't match your setting (${describeConfig(reported)})`;
}

/** Called when the device sends a heartbeat/sync. Delivers pending APPLY requests. */
export async function deviceSync(deviceId: string, info: { battery?: number | null; osVersion?: string; appVersion?: string } = {}) {
  const now = new Date();
  const device = await db.device.update({
    where: { id: deviceId },
    data: {
      lastSeenAt: now,
      ...(info.battery !== undefined ? { battery: info.battery } : {}),
      ...(info.osVersion ? { osVersion: info.osVersion } : {}),
      ...(info.appVersion ? { appVersion: info.appVersion } : {}),
    },
    include: { child: { include: { policies: true } } },
  });
  const pending = await db.configRequest.findMany({
    where: { deviceId, status: "PENDING", mode: "APPLY" },
    orderBy: { createdAt: "asc" },
  });
  if (pending.length) {
    await db.configRequest.updateMany({ where: { id: { in: pending.map((p) => p.id) } }, data: { status: "DELIVERED", deliveredAt: now } });
  }
  await resolveAlerts(device.familyId, `OFFLINE:${deviceId}`);
  return {
    device,
    requests: pending.map((r) => ({ id: r.id, key: r.key, config: r.desired })),
    policy: device.child.policies.map((p) => ({ key: p.key, config: p.config })),
    checkRequested: !!device.checkRequestedAt,
  };
}

/**
 * The heart of "never report success unless verified":
 * compares what the device reports with requests and policy, then updates status,
 * history, alerts and any running configuration check.
 */
export async function processReport(deviceId: string, report: DeviceReport) {
  const now = new Date();
  const device = await db.device.update({
    where: { id: deviceId },
    data: {
      lastSeenAt: now,
      ...(report.battery !== undefined ? { battery: report.battery } : {}),
      ...(report.osVersion ? { osVersion: report.osVersion } : {}),
      ...(report.appVersion ? { appVersion: report.appVersion } : {}),
    },
    include: { child: true, protections: true },
  });
  const label = deviceLabel(device);
  await resolveAlerts(device.familyId, `OFFLINE:${deviceId}`);

  for (const rp of report.protections) {
    const def = PROTECTION_BY_KEY[rp.key];
    if (!def) continue;
    const reported = { ...rp.config, key: rp.key };

    // 1. Open requests for this protection on this device
    const open = await db.configRequest.findMany({
      where: { deviceId, key: rp.key, status: { in: ["PENDING", "DELIVERED", "AWAITING_PARENT"] } },
      orderBy: { createdAt: "desc" },
    });
    for (const req of open) {
      if (configMatches(req.desired, reported)) {
        await db.configRequest.update({ where: { id: req.id }, data: { status: "VERIFIED", verifiedAt: now } });
        await db.childPolicy.upsert({
          where: { childId_key: { childId: device.childId, key: rp.key } },
          create: { childId: device.childId, key: rp.key, config: req.desired as Prisma.InputJsonValue },
          update: { config: req.desired as Prisma.InputJsonValue },
        });
        await syncChildLimits(device.childId, req.desired);
        const from = describeConfig(req.previous), to = describeConfig(req.desired);
        await db.configChange.create({
          data: {
            familyId: device.familyId, childId: device.childId, key: rp.key,
            title: from === to ? `${def.name} verified` : `${def.name} updated`,
            actor: `${req.createdBy} · verified on ${device.name}`,
            fromValue: from === to ? null : from, toValue: to,
          },
        });
      } else if (req.status === "DELIVERED" && req.mode === "APPLY") {
        await db.configRequest.update({
          where: { id: req.id },
          data: { status: "FAILED", failureReason: `Device reported ${describeConfig(reported)}` },
        });
      }
    }

    // 2. Evaluate against (possibly updated) policy
    const policy = await db.childPolicy.findUnique({ where: { childId_key: { childId: device.childId, key: rp.key } } });
    const status = evaluate(def.caps[device.platform], policy?.config, reported);
    const prev = device.protections.find((p) => p.key === rp.key);
    const message = messageFor(status, rp.key, label, reported);
    await db.deviceProtection.upsert({
      where: { deviceId_key: { deviceId, key: rp.key } },
      create: { deviceId, key: rp.key, status, reported: reported as Prisma.InputJsonValue, message, lastVerifiedAt: now },
      update: { status, reported: reported as Prisma.InputJsonValue, message, lastVerifiedAt: now },
    });

    // 3. Alerts on transitions
    const rk = `${rp.key}:${deviceId}`;
    if (isPassing(status)) {
      await resolveAlerts(device.familyId, rk);
    } else if (prev && isPassing(prev.status) && !open.some((r) => now.getTime() - r.createdAt.getTime() < CHANGE_GRACE_MS)) {
      const prevCfg = prev.reported;
      const isLocation = rp.key === "LOCATION" && !isConfigured(reported);
      await db.alert.create({
        data: {
          familyId: device.familyId, childId: device.childId, deviceId,
          severity: status === "ACTION_REQUIRED" || isLocation ? "ACTION_REQUIRED" : "ATTENTION",
          category: isLocation ? "LOCATION" : "PROTECTION",
          icon: isLocation ? "map-pin-off" : "shield-alert",
          title: isLocation ? "Location sharing turned off" : "Protection setting changed",
          body: isLocation
            ? "Location sharing was switched off on the device."
            : `${def.name} was changed on the device and no longer matches your setting.`,
          subject: label,
          fromValue: isLocation ? null : describeConfig(prevCfg),
          toValue: isLocation ? null : describeConfig(reported),
          resolveKey: rk,
        },
      });
      await db.configChange.create({
        data: {
          familyId: device.familyId, childId: device.childId, key: rp.key,
          title: `${def.name} changed on device`, actor: `Changed on ${device.name}`,
          fromValue: describeConfig(prevCfg), toValue: describeConfig(reported),
        },
      });
    }
  }

  if (rpHasLocation(report)) {
    const sharing = !!report.protections.find((p) => p.key === "LOCATION")!.config.sharing;
    // Sharing off: forget where the device was, so no stale position is kept, shown or exported
    const cleared = sharing ? {} : { lat: null, lng: null, accuracyM: null, placeLabel: null, locatedAt: null };
    await db.deviceLocation.upsert({
      where: { deviceId },
      create: { deviceId, sharing },
      update: { sharing, ...cleared },
    });
  }

  // 4. Configuration check bookkeeping
  if (report.full && device.checkRequestedAt) {
    const fresh = await db.deviceProtection.findMany({ where: { deviceId } });
    const issues = fresh.filter((p) => !isPassing(p.status)).length;
    await db.checkRunResult.updateMany({
      where: { deviceId, reportedAt: null, run: { status: "RUNNING" } },
      data: { reachable: true, issues, reportedAt: now },
    });
    await db.device.update({ where: { id: deviceId }, data: { checkRequestedAt: null } });
  }
  return { ok: true };
}

/** Child.dailyLimitMinutes mirrors the Screen Time policy for quick display. */
export async function syncChildLimits(childId: string, cfg: unknown) {
  const c = cfg as { key?: string; dailyMinutes?: number; weekendMinutes?: number } | null;
  if (c?.key !== "SCREEN_TIME" || typeof c.dailyMinutes !== "number") return;
  await db.child.update({ where: { id: childId }, data: { dailyLimitMinutes: c.dailyMinutes, weekendLimitMinutes: c.weekendMinutes ?? c.dailyMinutes } });
}

const rpHasLocation =(r: DeviceReport) => r.protections.some((p) => p.key === "LOCATION");

export async function resolveAlerts(familyId: string, resolveKey: string) {
  await db.alert.updateMany({ where: { familyId, resolveKey, resolvedAt: null }, data: { resolvedAt: new Date() } });
}

/** Creates an alert for devices that have gone quiet, once. */
export async function ensureOfflineAlerts(familyId: string) {
  const cutoff = new Date(Date.now() - 24 * 3600_000);
  const devices = await db.device.findMany({
    where: { familyId, OR: [{ lastSeenAt: { lt: cutoff } }, { lastSeenAt: null }] },
    include: { child: true },
  });
  for (const d of devices) {
    const rk = `OFFLINE:${d.id}`;
    const exists = await db.alert.findFirst({ where: { familyId, resolveKey: rk, resolvedAt: null } });
    if (exists) continue;
    await db.alert.create({
      data: {
        familyId, childId: d.childId, deviceId: d.id, severity: "ATTENTION", category: "DEVICES", icon: "wifi-off",
        title: "Device hasn't synced in over a day",
        body: "Settings stay active offline, but eGuard can't verify them until the device reconnects.",
        subject: `${d.child.name}'s ${d.name}`, resolveKey: rk,
      },
    });
  }
}

/** Starts a configuration check across devices. Devices answer on their next sync. */
export async function startCheckRun(familyId: string, deviceIds?: string[]) {
  const devices = await db.device.findMany({ where: { familyId, ...(deviceIds ? { id: { in: deviceIds } } : {}) } });
  const now = new Date();
  const run = await db.checkRun.create({
    data: { familyId, results: { create: devices.map((d) => ({ deviceId: d.id })) } },
  });
  await db.device.updateMany({ where: { id: { in: devices.map((d) => d.id) } }, data: { checkRequestedAt: now } });
  return run;
}

export const CHECK_TIMEOUT_MS = 12_000;

export async function finalizeCheckRun(runId: string) {
  const run = await db.checkRun.findUnique({ where: { id: runId }, include: { results: true } });
  if (!run || run.status === "COMPLETED") return run;
  const done = run.results.every((r) => r.reportedAt);
  const timedOut = Date.now() - run.createdAt.getTime() > CHECK_TIMEOUT_MS;
  if (done || timedOut) {
    await db.checkRunResult.updateMany({ where: { runId, reportedAt: null }, data: { reachable: false } });
    await db.checkRun.update({ where: { id: runId }, data: { status: "COMPLETED", completedAt: new Date() } });
  }
  return db.checkRun.findUnique({ where: { id: runId }, include: { results: true } });
}

export type DeviceWithChild = Device & { child: { name: string } };
