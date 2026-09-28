import type { CheckStatus, DeviceProtection, Platform, ProtectionKey } from "@prisma/client";
import { PROTECTIONS, configMatches, isConfigured, type Capability } from "./protections";

export const OFFLINE_AFTER_MS = 24 * 3600_000;

type DeviceLike = {
  id: string;
  name: string;
  platform: Platform;
  lastSeenAt: Date | null;
  protections: Pick<DeviceProtection, "key" | "status" | "message" | "lastVerifiedAt">[];
  child?: { name: string };
};

const RANK: Record<CheckStatus, number> = {
  UNSUPPORTED: 0,
  PASS: 1,
  NOT_CONFIGURED: 2,
  WARNING: 3,
  ACTION_REQUIRED: 4,
};

export const isPassing = (s: CheckStatus) => s === "PASS" || s === "UNSUPPORTED";

export function worst(statuses: CheckStatus[]): CheckStatus {
  if (!statuses.length) return "NOT_CONFIGURED";
  return statuses.reduce((a, b) => (RANK[b] > RANK[a] ? b : a));
}

export type HealthCheck = {
  key: ProtectionKey;
  name: string;
  icon: string;
  status: CheckStatus;
  detail: string;
  /** device that needs fixing (first non-passing) */
  fixDeviceId?: string;
  fixChildId?: string;
};

export function isOffline(d: { lastSeenAt: Date | null }, now = Date.now()) {
  return !d.lastSeenAt || now - d.lastSeenAt.getTime() > OFFLINE_AFTER_MS;
}

const phrase: Record<CheckStatus, string> = {
  PASS: "Verified",
  WARNING: "Needs review",
  ACTION_REQUIRED: "Turned off",
  UNSUPPORTED: "Unsupported",
  NOT_CONFIGURED: "Not configured",
};

/**
 * Configuration Health: one check per protection key.
 * The worst device status wins; UNSUPPORTED doesn't count against the score.
 * An offline device counts with its last known state, so the score doesn't collapse when a tablet sits
 * in a drawer. It isn't a verification though: `offline` says how many devices it applies to, and callers
 * must not call the family "verified" or "protected" while it's above zero.
 */
export function computeHealth(
  devices: (DeviceLike & { childId?: string })[],
  opts: { ownerLabel?: (d: DeviceLike) => string; now?: number } = {},
) {
  const label = opts.ownerLabel ?? ((d: DeviceLike) => (d.child ? `${d.child.name}'s ${d.name}` : d.name));
  const now = opts.now ?? Date.now();
  const checks: HealthCheck[] = PROTECTIONS.map((p) => {
    const rows = devices.map((d) => ({ d, row: d.protections.find((x) => x.key === p.key) }));
    const statuses = rows.map(({ row }) => row?.status ?? "NOT_CONFIGURED");
    const status = devices.length ? worst(statuses) : "NOT_CONFIGURED";
    const failing = rows.filter(({ row }) => !isPassing(row?.status ?? "NOT_CONFIGURED"));
    const supported = rows.filter(({ row }) => row?.status !== "UNSUPPORTED");
    let detail: string;
    if (!devices.length) detail = "No devices yet";
    else if (failing.length) {
      const f = failing[0];
      detail = f.row?.message ?? `${phrase[f.row?.status ?? "NOT_CONFIGURED"]} on ${label(f.d)}`;
      if (failing.length > 1) detail += ` and ${failing.length - 1} more`;
    } else if (status === "UNSUPPORTED") detail = "Not supported on these devices. Not counted.";
    else {
      const offline = supported.filter(({ d }) => isOffline(d, now));
      const online = supported.length - offline.length;
      detail = offline.length
        ? `Verified on ${online} of ${supported.length} device${supported.length === 1 ? "" : "s"}; ${offline.length} offline, last known state`
        : `Verified on ${supported.length} of ${supported.length} device${supported.length === 1 ? "" : "s"}`;
      if (supported.length < rows.length) detail += ". Unsupported on iOS";
    }
    const fix = failing[0];
    return {
      key: p.key, name: p.checkName, icon: p.icon, status, detail,
      fixDeviceId: fix?.d.id, fixChildId: fix?.d.childId,
    };
  });
  const score = checks.filter((c) => isPassing(c.status)).length;
  const offline = devices.filter((d) => isOffline(d, now)).length;
  /** Every check passes on devices that are all online right now: the only state to call "verified" */
  const verified = devices.length > 0 && score === checks.length && offline === 0;
  return { checks, score, total: checks.length, offline, verified };
}

export type DeviceState = { key: "healthy" | "issues" | "offline"; issues: number };

export function deviceState(d: DeviceLike, now = Date.now()): DeviceState {
  const issues = d.protections.filter((p) => !isPassing(p.status)).length;
  if (isOffline(d, now)) return { key: "offline", issues };
  return issues ? { key: "issues", issues } : { key: "healthy", issues: 0 };
}

/** Status of one protection on one device, from what it reported vs the child's policy. */
export function evaluate(cap: Capability, policy: unknown, reported: unknown): CheckStatus {
  if (cap === "UNSUPPORTED") return "UNSUPPORTED";
  if (!isConfigured(policy)) return isConfigured(reported) ? "PASS" : "NOT_CONFIGURED";
  if (configMatches(policy, reported)) return "PASS";
  const key = (policy as { key: ProtectionKey }).key;
  if ((key === "UNINSTALL_PROTECTION" || key === "APP_APPROVAL") && !isConfigured(reported)) return "ACTION_REQUIRED";
  return "WARNING";
}

