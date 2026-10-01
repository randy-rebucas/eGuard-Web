import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma, ProtectionKey, RequestStatus, Role } from "@prisma/client";
import { db } from "./db";
import { PROTECTIONS, PROTECTION_BY_KEY, describeConfig, defaultConfig, type ProtectionConfig } from "./protections";
import { computeHealth, isOffline, worst } from "./health";
import { syncChildLimits } from "./engine";
import { ServiceError, notFound } from "./errors";

/**
 * The configuration workflow, shared by the web server actions and the mobile API.
 * Nothing here marks a setting successful: only processReport() in engine.ts verifies.
 */

export type Actor = { id: string; name: string; familyId: string; role: Role };

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour) times.");
export const ConfigSchema = z.discriminatedUnion("key", [
  z.object({ key: z.literal("SCREEN_TIME"), dailyMinutes: z.number().int().min(15).max(1440), weekendMinutes: z.number().int().min(15).max(1440) }),
  z.object({ key: z.literal("BEDTIME"), enabled: z.boolean(), start: time, end: time, days: z.enum(["EVERY_DAY", "SCHOOL_NIGHTS"]) })
    .refine((b) => !b.enabled || b.start !== b.end, { message: "Bedtime needs different start and end times.", path: ["end"] }),
  z.object({ key: z.literal("APP_RESTRICTIONS"), maxAgeRating: z.number().int().min(4).max(18) }),
  z.object({ key: z.literal("APP_APPROVAL"), enabled: z.boolean() }),
  z.object({ key: z.literal("CONTENT"), maxAgeRating: z.number().int().min(4).max(18) }),
  z.object({ key: z.literal("WEB"), mode: z.enum(["OFF", "FILTER", "ALLOWLIST"]), blockedSites: z.number().int().min(0) }),
  z.object({ key: z.literal("DOWNLOADS"), requireApproval: z.boolean() }),
  z.object({ key: z.literal("LOCATION"), sharing: z.boolean() }),
  z.object({ key: z.literal("NOTIFICATIONS"), quietDuringBedtime: z.boolean() }),
  z.object({ key: z.literal("UNINSTALL_PROTECTION"), enabled: z.boolean() }),
]);

/**
 * What a device may report for a protection (docs/child-app-spec.md: "exactly the fields in ProtectionConfig").
 * Same fields and types as ConfigSchema, but bounds a device can legitimately read back (0 minutes when no limit
 * is set, any age rating the OS uses). Reports are rendered on parents' pages, so a malformed one must not be stored.
 */
const minutes = z.number().int().min(0).max(1440);
const rating = z.number().int().min(0).max(21);
export const ReportedConfigSchema = z.discriminatedUnion("key", [
  z.strictObject({ key: z.literal("SCREEN_TIME"), dailyMinutes: minutes, weekendMinutes: minutes }),
  z.strictObject({ key: z.literal("BEDTIME"), enabled: z.boolean(), start: time, end: time, days: z.enum(["EVERY_DAY", "SCHOOL_NIGHTS"]) }),
  z.strictObject({ key: z.literal("APP_RESTRICTIONS"), maxAgeRating: rating }),
  z.strictObject({ key: z.literal("APP_APPROVAL"), enabled: z.boolean() }),
  z.strictObject({ key: z.literal("CONTENT"), maxAgeRating: rating }),
  z.strictObject({ key: z.literal("WEB"), mode: z.enum(["OFF", "FILTER", "ALLOWLIST"]), blockedSites: z.number().int().min(0).max(1_000_000) }),
  z.strictObject({ key: z.literal("DOWNLOADS"), requireApproval: z.boolean() }),
  z.strictObject({ key: z.literal("LOCATION"), sharing: z.boolean() }),
  z.strictObject({ key: z.literal("NOTIFICATIONS"), quietDuringBedtime: z.boolean() }),
  z.strictObject({ key: z.literal("UNINSTALL_PROTECTION"), enabled: z.boolean() }),
]);

const OPEN: RequestStatus[] = ["PENDING", "DELIVERED", "AWAITING_PARENT"];

export async function childFor(familyId: string, childId: string) {
  const child = await db.child.findFirst({ where: { id: childId, familyId } });
  if (!child) throw notFound("Child");
  return child;
}

export async function writePolicies(childId: string, configs: ProtectionConfig[]) {
  for (const cfg of configs) {
    await db.childPolicy.upsert({
      where: { childId_key: { childId, key: cfg.key } },
      create: { childId, key: cfg.key, config: cfg as Prisma.InputJsonValue },
      update: { config: cfg as Prisma.InputJsonValue },
    });
    await syncChildLimits(childId, cfg);
  }
}

/**
 * Sends new configuration to each device that supports it, as one batch.
 * APPLY devices get it on next sync; GUIDED/VERIFY_ONLY wait for the parent.
 *
 * `strict` (the single-setting flow): fail if no device supports the protection.
 * Otherwise (onboarding), protections with no device to verify them, including a child with no
 * devices yet, are saved as the child's policy directly and sent to devices when they pair.
 */
export async function requestConfigs(actor: Actor, childId: string, configs: ProtectionConfig[], via: string, opts: { strict?: boolean } = {}) {
  const child = await childFor(actor.familyId, childId);
  const keys = [...new Set(configs.map((c) => c.key))];
  if (keys.length !== configs.length) throw new ServiceError(400, "Each protection can only appear once.", "invalid");
  const devices = await db.device.findMany({ where: { childId: child.id }, include: { protections: { where: { key: { in: keys } } } } });
  const batchId = randomUUID();

  const rows: Prisma.ConfigRequestCreateManyInput[] = [];
  const direct: ProtectionConfig[] = [];
  for (const cfg of configs) {
    const def = PROTECTION_BY_KEY[cfg.key];
    const targets = devices.filter((d) => def.caps[d.platform] !== "UNSUPPORTED");
    if (!targets.length) {
      if (opts.strict) throw new ServiceError(409, `${def.name} isn't supported on ${child.name}'s devices.`, "unsupported");
      direct.push(cfg);
      continue;
    }
    for (const d of targets) {
      const cap = def.caps[d.platform];
      const guided = cap === "GUIDED" || cap === "VERIFY_ONLY";
      rows.push({
        batchId, childId: child.id, deviceId: d.id, key: cfg.key,
        mode: guided ? "GUIDED" : "APPLY",
        status: guided ? "AWAITING_PARENT" : "PENDING",
        desired: cfg as Prisma.InputJsonValue,
        previous: (d.protections.find((p) => p.key === cfg.key)?.reported ?? undefined) as Prisma.InputJsonValue | undefined,
        createdBy: `${actor.name} on ${via}`,
      });
    }
  }

  await db.configRequest.updateMany({ where: { childId: child.id, key: { in: keys }, status: { in: OPEN } }, data: { status: "CANCELLED" } });
  if (rows.length) await db.configRequest.createMany({ data: rows });
  if (direct.length) await writePolicies(child.id, direct);
  const detail = configs.length === 1
    ? `${PROTECTION_BY_KEY[configs[0].key].name} for ${child.name}: ${describeConfig(configs[0])}`
    : `${configs.length} protections for ${child.name}`;
  await db.auditLog.create({ data: { familyId: actor.familyId, actor: actor.name, action: "config.requested", detail } });
  return {
    batchId: rows.length ? batchId : null,
    requested: [...new Set(rows.map((r) => r.key as ProtectionKey))],
    saved: direct.map((c) => c.key),
  };
}

/** Guided setup: parent says the steps are done; ask the devices to report. */
export async function confirmGuided(familyId: string, batchId: string) {
  const reqs = await db.configRequest.findMany({ where: { batchId, status: "AWAITING_PARENT", child: { familyId } } });
  if (!reqs.length) return { confirmed: 0 };
  const now = new Date();
  await db.configRequest.updateMany({ where: { id: { in: reqs.map((r) => r.id) } }, data: { status: "DELIVERED", deliveredAt: now } });
  await db.device.updateMany({ where: { id: { in: reqs.map((r) => r.deviceId) } }, data: { checkRequestedAt: now } });
  return { confirmed: reqs.length };
}

export async function cancelBatch(familyId: string, batchId: string) {
  const r = await db.configRequest.updateMany({ where: { batchId, child: { familyId }, status: { in: OPEN } }, data: { status: "CANCELLED" } });
  return { cancelled: r.count };
}

const STATUS_RANK: Record<RequestStatus, number> = { VERIFIED: 0, CANCELLED: 1, DELIVERED: 2, PENDING: 3, AWAITING_PARENT: 4, FAILED: 5 };

/** Progress of a batch, per protection and per device (Setup Progress, "Waiting for device"). */
export async function batchStatus(familyId: string, batchId: string) {
  const reqs = await db.configRequest.findMany({
    where: { batchId, child: { familyId } },
    include: { device: true },
    orderBy: { createdAt: "asc" },
  });
  if (!reqs.length) throw notFound("Batch");
  const childId = reqs[0].childId;
  const devices = await db.device.findMany({ where: { childId }, include: { protections: true } });
  const health = computeHealth(devices);
  const byKey = new Map<ProtectionKey, typeof reqs>();
  for (const r of reqs) byKey.set(r.key, [...(byKey.get(r.key) ?? []), r]);

  const items = PROTECTIONS.filter((p) => byKey.has(p.key)).map((p) => {
    const rs = byKey.get(p.key)!;
    const status = rs.map((r) => r.status).reduce((a, b) => (STATUS_RANK[b] > STATUS_RANK[a] ? b : a));
    return {
      key: p.key, name: p.name, icon: p.icon, status,
      to: describeConfig(rs[0].desired),
      devices: rs.map((r) => ({
        requestId: r.id, deviceId: r.deviceId, deviceName: r.device.name, platform: r.device.platform,
        mode: r.mode, status: r.status, failureReason: r.failureReason, offline: isOffline(r.device),
        from: describeConfig(r.previous),
        guide: r.mode === "GUIDED" ? PROTECTION_BY_KEY[r.key].guide?.[r.device.platform] ?? null : null,
      })),
    };
  });
  const count = (s: RequestStatus) => items.filter((i) => i.status === s).length;
  const open = reqs.some((r) => OPEN.includes(r.status));
  return {
    batchId, childId,
    done: !open,
    summary: {
      total: items.length, verified: count("VERIFIED"), failed: count("FAILED"),
      awaitingParent: count("AWAITING_PARENT"), inProgress: count("PENDING") + count("DELIVERED"), cancelled: count("CANCELLED"),
    },
    items,
    health: { score: health.score, total: health.total },
  };
}

/** Every protection for one child: desired policy, and what each device reports. */
export async function childProtections(familyId: string, childId: string) {
  const child = await childFor(familyId, childId);
  const age = new Date().getFullYear() - child.birthYear;
  const [policies, devices, open] = await Promise.all([
    db.childPolicy.findMany({ where: { childId } }),
    db.device.findMany({ where: { childId }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], include: { protections: true } }),
    db.configRequest.findMany({ where: { childId, status: { in: OPEN } }, orderBy: { createdAt: "desc" } }),
  ]);
  return PROTECTIONS.map((def) => {
    const policy = (policies.find((p) => p.key === def.key)?.config as ProtectionConfig | undefined) ?? defaultConfig(def.key, age);
    const devs = devices.map((d) => {
      const p = d.protections.find((x) => x.key === def.key);
      const cap = def.caps[d.platform];
      return {
        deviceId: d.id, deviceName: d.name, platform: d.platform, capability: cap,
        status: p?.status ?? "NOT_CONFIGURED",
        reported: p?.reported ?? null,
        reportedLabel: p ? (p.status === "NOT_CONFIGURED" ? "Not configured" : describeConfig(p.reported)) : "Unknown",
        message: p?.message ?? null,
        lastVerifiedAt: p?.lastVerifiedAt ?? null,
        guide: cap === "GUIDED" || cap === "VERIFY_ONLY" ? def.guide?.[d.platform] ?? null : null,
      };
    });
    return {
      key: def.key, name: def.name, checkName: def.checkName, icon: def.icon,
      policy, policyLabel: describeConfig(policy),
      status: devs.length ? worst(devs.map((d) => d.status)) : "NOT_CONFIGURED",
      openBatchId: open.find((r) => r.key === def.key)?.batchId ?? null,
      devices: devs,
    };
  });
}
