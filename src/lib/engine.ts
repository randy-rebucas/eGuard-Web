import "server-only";
import type { CheckStatus, Device, Prisma, ProtectionKey } from "@prisma/client";
import { db } from "./db";
import { PROTECTION_BY_KEY, configMatches, describeConfig, isConfigured } from "./protections";
import { evaluate, isPassing } from "./health";
import { ServiceError } from "./errors";
import { LIMITS, enforce } from "./rate-limit";

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

/**
 * Called when the device sends a heartbeat/sync. Delivers open APPLY requests: new ones, and delivered ones the device
 * hasn't reported on yet, since a sync response lost on the way (timeout, app killed) would otherwise strand them.
 * Applying the same config again is harmless; the first report on that protection verifies or fails the request.
 */
export async function deviceSync(deviceId: string, info: { battery?: number | null; osVersion?: string; appVersion?: string } = {}) {
  const now = new Date();
  const [device, open] = await Promise.all([
    db.device.update({
      where: { id: deviceId },
      data: {
        lastSeenAt: now,
        ...(info.battery !== undefined ? { battery: info.battery } : {}),
        ...(info.osVersion ? { osVersion: info.osVersion } : {}),
        ...(info.appVersion ? { appVersion: info.appVersion } : {}),
      },
      include: { child: { include: { policies: true } } },
    }),
    db.configRequest.findMany({
      where: { deviceId, status: { in: ["PENDING", "DELIVERED"] }, mode: "APPLY" },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const fresh = open.filter((r) => r.status === "PENDING");
  await Promise.all([
    // Only the first delivery is recorded: deliveredAt says when the device first had the chance to apply it
    fresh.length && db.configRequest.updateMany({ where: { id: { in: fresh.map((p) => p.id) }, status: "PENDING" }, data: { status: "DELIVERED", deliveredAt: now } }),
    resolveAlerts(device.familyId, `OFFLINE:${deviceId}`),
  ]);
  return {
    device,
    requests: open.map((r) => ({ id: r.id, key: r.key, config: r.desired })),
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
  // Read once for the whole report instead of per protection: a full report covers every protection
  const keys = report.protections.map((p) => p.key);
  const [openRequests, policyRows] = await Promise.all([
    db.configRequest.findMany({
      where: { deviceId, key: { in: keys }, status: { in: ["PENDING", "DELIVERED", "AWAITING_PARENT"] } },
      orderBy: { createdAt: "desc" },
    }),
    db.childPolicy.findMany({ where: { childId: device.childId, key: { in: keys } }, select: { key: true, config: true } }),
    resolveAlerts(device.familyId, `OFFLINE:${deviceId}`),
  ]);
  const policies = new Map<ProtectionKey, Prisma.JsonValue>(policyRows.map((p) => [p.key, p.config]));
  const statuses = new Map<ProtectionKey, CheckStatus>(device.protections.map((p) => [p.key, p.status]));
  const passing = new Set<string>();
  // Requests verified or failed by an earlier entry (a report may repeat a key)
  const settled = new Set<string>();

  for (const rp of report.protections) {
    const def = PROTECTION_BY_KEY[rp.key];
    if (!def) continue;
    const reported = { ...rp.config, key: rp.key };

    // 1. Open requests for this protection on this device
    const open = openRequests.filter((r) => r.key === rp.key && !settled.has(r.id));
    for (const req of open) {
      if (configMatches(req.desired, reported)) {
        settled.add(req.id);
        await db.configRequest.update({ where: { id: req.id }, data: { status: "VERIFIED", verifiedAt: now } });
        await db.childPolicy.upsert({
          where: { childId_key: { childId: device.childId, key: rp.key } },
          create: { childId: device.childId, key: rp.key, config: req.desired as Prisma.InputJsonValue },
          update: { config: req.desired as Prisma.InputJsonValue },
        });
        policies.set(rp.key, req.desired);
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
        settled.add(req.id);
        await db.configRequest.update({
          where: { id: req.id },
          data: { status: "FAILED", failureReason: `Device reported ${describeConfig(reported)}` },
        });
      }
    }

    // 2. Evaluate against (possibly updated) policy
    const status = evaluate(def.caps[device.platform], policies.get(rp.key), reported);
    const prev = device.protections.find((p) => p.key === rp.key);
    const message = messageFor(status, rp.key, label, reported);
    await db.deviceProtection.upsert({
      where: { deviceId_key: { deviceId, key: rp.key } },
      create: { deviceId, key: rp.key, status, reported: reported as Prisma.InputJsonValue, message, lastVerifiedAt: now },
      update: { status, reported: reported as Prisma.InputJsonValue, message, lastVerifiedAt: now },
    });
    statuses.set(rp.key, status);

    // 3. Alerts on transitions (passing ones are resolved together after the loop)
    const rk = `${rp.key}:${deviceId}`;
    if (isPassing(status)) {
      passing.add(rk);
      continue;
    }
    // A repeated key: the later entry wins, as when each was resolved on its own
    passing.delete(rk);
    if (prev && isPassing(prev.status) && !open.some((r) => now.getTime() - r.createdAt.getTime() < CHANGE_GRACE_MS)) {
      const prevCfg = prev.reported;
      const isLocation = rp.key === "LOCATION" && !isConfigured(reported);
      // Two reports arriving together both see the earlier passing state: raise it (and record it) once
      const raised = await createAlertUnless(rk, { familyId: device.familyId, resolveKey: rk, resolvedAt: null }, {
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
      });
      if (raised) await db.configChange.create({
        data: {
          familyId: device.familyId, childId: device.childId, key: rp.key,
          title: `${def.name} changed on device`, actor: `Changed on ${device.name}`,
          fromValue: describeConfig(prevCfg), toValue: describeConfig(reported),
        },
      });
    }
  }

  if (passing.size) {
    await db.alert.updateMany({ where: { familyId: device.familyId, resolveKey: { in: [...passing] }, resolvedAt: null }, data: { resolvedAt: now } });
  }

  if (rpHasLocation(report)) {
    // The last LOCATION entry, like the status above when a report repeats a key
    const sharing = !!report.protections.findLast((p) => p.key === "LOCATION")!.config.sharing;
    // Sharing off: forget where the device was, so no stale position is kept, shown or exported
    const cleared = sharing ? {} : { lat: null, lng: null, accuracyM: null, placeLabel: null, placeId: null, locatedAt: null };
    await db.deviceLocation.upsert({
      where: { deviceId },
      create: { deviceId, sharing },
      update: { sharing, ...cleared },
    });
  }

  // 4. Configuration check bookkeeping
  if (report.full && device.checkRequestedAt) {
    // What the device had before this report, with what it just reported on top
    const issues = [...statuses.values()].filter((s) => !isPassing(s)).length;
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

/**
 * Creates an alert unless one matching `exists` is already there. Check and create run under one lock per
 * `lockKey`, so requests arriving together (a child tapping "Ask" three times, an extension retrying) raise one
 * alert, not one each, and parents aren't emailed three times. Returns whether it created one.
 */
export async function createAlertUnless(lockKey: string, exists: Prisma.AlertWhereInput, data: Prisma.AlertUncheckedCreateInput) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`alert:${lockKey}`}))`;
    if (await tx.alert.findFirst({ where: exists, select: { id: true } })) return false;
    await tx.alert.create({ data });
    return true;
  });
}

export async function resolveAlerts(familyId: string, resolveKey: string) {
  await db.alert.updateMany({ where: { familyId, resolveKey, resolvedAt: null }, data: { resolvedAt: new Date() } });
}

/** Devices that haven't synced for a day (or ever) get an offline alert. */
export const offlineDeviceWhere = (now = Date.now()): Prisma.DeviceWhereInput => ({
  OR: [{ lastSeenAt: { lt: new Date(now - 24 * 3600_000) } }, { lastSeenAt: null }],
});

/** Creates an alert for devices that have gone quiet, once. */
export async function ensureOfflineAlerts(familyId: string) {
  const devices = await db.device.findMany({
    where: { familyId, ...offlineDeviceWhere() },
    include: { child: { select: { name: true } } },
  });
  if (!devices.length) return;
  // The usual case (all already raised) stays one cheap read; only a missing alert takes the lock
  const raised = await db.alert.findMany({
    where: { familyId, resolvedAt: null, resolveKey: { in: devices.map((d) => `OFFLINE:${d.id}`) } },
    select: { resolveKey: true },
  });
  const done = new Set(raised.map((a) => a.resolveKey));
  for (const d of devices) {
    const rk = `OFFLINE:${d.id}`;
    if (done.has(rk)) continue;
    const open = { familyId, resolveKey: rk, resolvedAt: null };
    // Runs on every page load and in the maintenance job, so two can overlap
    await createAlertUnless(rk, open, {
      familyId, childId: d.childId, deviceId: d.id, severity: "ATTENTION", category: "DEVICES", icon: "wifi-off",
      title: "Device hasn't synced in over a day",
      body: "Settings stay active offline, but eGuard can't verify them until the device reconnects.",
      subject: `${d.child.name}'s ${d.name}`, resolveKey: rk,
    });
  }
}

/** Starts a configuration check across devices, for the parent `userId`. Devices answer on their next sync. */
export async function startCheckRun(familyId: string, userId: string, deviceIds?: string[]) {
  const devices = await db.device.findMany({ where: { familyId, ...(deviceIds ? { id: { in: deviceIds } } : {}) } });
  // An empty run completes at once and would report "0 devices, 10 protections need review"
  if (!devices.length) throw new ServiceError(409, "Pair a child's device before running a check.", "no_devices");
  await enforce(`check:${userId}`, LIMITS.checkUser, "You've run several checks. Wait a few minutes; devices keep reporting on their own.");
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
