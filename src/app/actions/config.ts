"use server";

import { z } from "zod";
import type { ProtectionKey } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PROTECTION_BY_KEY, defaultConfig, describeConfig, type ProtectionConfig } from "@/lib/protections";
import { startCheckRun } from "@/lib/engine";
import { notFound, toResult, type Result } from "@/lib/errors";
import {
  ConfigSchema, cancelBatch as cancelConfigBatch, childFor, confirmGuided as confirmGuidedBatch, requestConfigs,
} from "@/lib/config-service";

const platformName = (p: "ANDROID" | "IOS") => (p === "IOS" ? "iOS" : "Android");

/** Server actions take whatever the client sends: an object id would be read by Prisma as a filter. */
const Id = z.string().min(1).max(64);

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

export async function getFlowChildren() {
  const u = await requireUser();
  const kids = await db.child.findMany({ where: { familyId: u.familyId }, orderBy: { createdAt: "asc" }, include: { devices: true } });
  return kids.map((k) => ({ id: k.id, name: k.name, hue: k.hue, devices: k.devices.map((d) => ({ name: d.name, platform: d.platform })) }));
}

export async function getFlowContext(childId: string, key: ProtectionKey): Promise<Result<FlowContext>> {
  const u = await requireUser();
  return toResult(() => flowContext(u.familyId, childId, key));
}

async function flowContext(familyId: string, childId: string, key: ProtectionKey): Promise<FlowContext> {
  // Server actions take whatever the client sends; an unknown key would crash on def.caps below
  if (typeof key !== "string" || !Object.hasOwn(PROTECTION_BY_KEY, key)) throw notFound("Protection");
  if (!Id.safeParse(childId).success) throw notFound("Child");
  const child = await childFor(familyId, childId);
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

/**
 * Step 4: send the new configuration to each supported device.
 * APPLY devices get it on next sync; GUIDED/VERIFY_ONLY wait for the parent.
 * Nothing is marked successful here — only processReport() can verify.
 */
export async function submitConfig(childId: string, desiredInput: unknown): Promise<Result<{ batchId: string }>> {
  const u = await requireUser();
  return toResult(async () => {
    const desired = ConfigSchema.parse(desiredInput);
    const { batchId } = await requestConfigs(u, Id.parse(childId), [desired], "web", { strict: true });
    return { batchId: batchId! };
  });
}

/** Guided setup: parent says the steps are done; ask the device to report. */
export async function confirmGuided(batchId: string): Promise<Result> {
  const u = await requireUser();
  return toResult(async () => { await confirmGuidedBatch(u.familyId, Id.parse(batchId)); return {}; });
}

export async function cancelBatch(batchId: string): Promise<Result> {
  const u = await requireUser();
  return toResult(async () => { await cancelConfigBatch(u.familyId, Id.parse(batchId)); return {}; });
}

export async function startCheck(deviceId?: string): Promise<Result<{ runId: string }>> {
  const u = await requireUser();
  return toResult(async () => {
    if (deviceId != null) {
      if (!Id.safeParse(deviceId).success) throw notFound("Device");
      const d = await db.device.findFirst({ where: { id: deviceId, familyId: u.familyId } });
      if (!d) throw notFound("Device");
    }
    const run = await startCheckRun(u.familyId, deviceId ? [deviceId] : undefined);
    await db.auditLog.create({ data: { familyId: u.familyId, actor: u.name, action: "check.started", detail: deviceId ?? "all devices" } });
    return { runId: run.id };
  });
}
