"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma, ProtectionKey } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PROTECTION_BY_KEY, defaultConfig, describeConfig, type ProtectionConfig } from "@/lib/protections";
import { startCheckRun } from "@/lib/engine";

const platformName = (p: "ANDROID" | "IOS") => (p === "IOS" ? "iOS" : "Android");

const KEYS = Object.keys(PROTECTION_BY_KEY) as [ProtectionKey, ...ProtectionKey[]];

export type FlowDevice = {
  id: string; name: string; platform: "ANDROID" | "IOS"; platformLabel: string;
  capability: string; currentLabel: string; status: string; lastVerified: string | null; guide: string[] | null;
};
export type FlowContext = {
  child: { id: string; name: string; hue: number; age: number };
  key: ProtectionKey;
  policy: ProtectionConfig;
  policyLabel: string;
  devices: FlowDevice[];
  openBatch: string | null;
};

async function childFor(userFamily: string, childId: string) {
  const child = await db.child.findFirst({ where: { id: childId, familyId: userFamily } });
  if (!child) throw new Error("Child not found.");
  return child;
}

export async function getFlowChildren() {
  const u = await requireUser();
  const kids = await db.child.findMany({ where: { familyId: u.familyId }, orderBy: { createdAt: "asc" }, include: { devices: true } });
  return kids.map((k) => ({ id: k.id, name: k.name, hue: k.hue, devices: k.devices.map((d) => ({ name: d.name, platform: d.platform })) }));
}

export async function getFlowContext(childId: string, key: ProtectionKey): Promise<FlowContext> {
  const u = await requireUser();
  const child = await childFor(u.familyId, childId);
  const def = PROTECTION_BY_KEY[key];
  const age = new Date().getFullYear() - child.birthYear;
  const [policyRow, devices, open] = await Promise.all([
    db.childPolicy.findUnique({ where: { childId_key: { childId, key } } }),
    db.device.findMany({ where: { childId }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], include: { protections: { where: { key } } } }),
    db.configRequest.findFirst({ where: { childId, key, status: { in: ["PENDING", "DELIVERED", "AWAITING_PARENT"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const policy = (policyRow?.config as ProtectionConfig | undefined) ?? defaultConfig(key, age);
  return {
    child: { id: child.id, name: child.name, hue: child.hue, age },
    key,
    policy,
    policyLabel: describeConfig(policyRow?.config),
    openBatch: open?.batchId ?? null,
    devices: devices.map((d) => {
      const p = d.protections[0];
      const cap = def.caps[d.platform];
      return {
        id: d.id, name: d.name, platform: d.platform, platformLabel: platformName(d.platform), capability: cap,
        currentLabel: p ? (p.status === "NOT_CONFIGURED" ? "Not configured" : describeConfig(p.reported)) : "Unknown",
        status: p?.status ?? "NOT_CONFIGURED",
        lastVerified: p?.lastVerifiedAt?.toISOString() ?? null,
        guide: cap === "GUIDED" || cap === "VERIFY_ONLY" ? def.guide?.[d.platform] ?? null : null,
      };
    }),
  };
}

const time = z.string().regex(/^\d{2}:\d{2}$/);
const ConfigSchema = z.discriminatedUnion("key", [
  z.object({ key: z.literal("SCREEN_TIME"), dailyMinutes: z.number().int().min(15).max(1440), weekendMinutes: z.number().int().min(15).max(1440) }),
  z.object({ key: z.literal("BEDTIME"), enabled: z.boolean(), start: time, end: time, days: z.enum(["EVERY_DAY", "SCHOOL_NIGHTS"]) }),
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
 * Step 4: send the new configuration to each supported device.
 * APPLY devices get it on next sync; GUIDED/VERIFY_ONLY wait for the parent.
 * Nothing is marked successful here — only processReport() can verify.
 */
export async function submitConfig(childId: string, desiredInput: unknown) {
  const u = await requireUser();
  const child = await childFor(u.familyId, childId);
  const desired = ConfigSchema.parse(desiredInput);
  if (!KEYS.includes(desired.key)) throw new Error("Unknown protection.");
  const def = PROTECTION_BY_KEY[desired.key];
  const devices = await db.device.findMany({ where: { childId: child.id }, include: { protections: { where: { key: desired.key } } } });
  const batchId = randomUUID();

  await db.configRequest.updateMany({
    where: { childId: child.id, key: desired.key, status: { in: ["PENDING", "DELIVERED", "AWAITING_PARENT"] } },
    data: { status: "CANCELLED" },
  });
  const targets = devices.filter((d) => def.caps[d.platform] !== "UNSUPPORTED");
  if (!targets.length) throw new Error(`${def.name} isn't supported on ${child.name}'s devices.`);

  await db.configRequest.createMany({
    data: targets.map((d) => {
      const cap = def.caps[d.platform];
      const guided = cap === "GUIDED" || cap === "VERIFY_ONLY";
      return {
        batchId, childId: child.id, deviceId: d.id, key: desired.key,
        mode: guided ? ("GUIDED" as const) : ("APPLY" as const),
        status: guided ? ("AWAITING_PARENT" as const) : ("PENDING" as const),
        desired: desired as Prisma.InputJsonValue,
        previous: (d.protections[0]?.reported ?? undefined) as Prisma.InputJsonValue | undefined,
        createdBy: `${u.name} on web`,
      };
    }),
  });
  await db.auditLog.create({ data: { familyId: u.familyId, actor: u.name, action: "config.requested", detail: `${def.name} for ${child.name}: ${describeConfig(desired)}` } });
  return { batchId };
}

/** Guided setup: parent says the steps are done; ask the device to report. */
export async function confirmGuided(batchId: string) {
  const u = await requireUser();
  const reqs = await db.configRequest.findMany({ where: { batchId, status: "AWAITING_PARENT", child: { familyId: u.familyId } } });
  if (!reqs.length) return { ok: true };
  const now = new Date();
  await db.configRequest.updateMany({ where: { id: { in: reqs.map((r) => r.id) } }, data: { status: "DELIVERED", deliveredAt: now } });
  await db.device.updateMany({ where: { id: { in: reqs.map((r) => r.deviceId) } }, data: { checkRequestedAt: now } });
  return { ok: true };
}

export async function cancelBatch(batchId: string) {
  const u = await requireUser();
  await db.configRequest.updateMany({
    where: { batchId, child: { familyId: u.familyId }, status: { in: ["PENDING", "DELIVERED", "AWAITING_PARENT"] } },
    data: { status: "CANCELLED" },
  });
  return { ok: true };
}

export async function startCheck(deviceId?: string) {
  const u = await requireUser();
  if (deviceId) {
    const d = await db.device.findFirst({ where: { id: deviceId, familyId: u.familyId } });
    if (!d) throw new Error("Device not found.");
  }
  const run = await startCheckRun(u.familyId, deviceId ? [deviceId] : undefined);
  await db.auditLog.create({ data: { familyId: u.familyId, actor: u.name, action: "check.started", detail: deviceId ?? "all devices" } });
  return { runId: run.id };
}
