import type { CheckStatus, DeviceProtection, Platform, ProtectionKey } from "@prisma/client";
import { PROTECTIONS, configMatches, isConfigured, type Capability } from "./protections";

export const OFFLINE_AFTER_MS = 24 * 3600_000;

/**
 * Whether a parent may dismiss an alert. One with a resolveKey clears itself once the problem is fixed; the rest
 * (INFO, and notices like "Device removed") have nothing that would ever resolve them, so the parent can.
 */
export const isDismissible = (a: { severity: string; resolveKey: string | null; resolvedAt: Date | null }) =>
  !a.resolvedAt && (a.severity === "INFO" || !a.resolveKey);

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

type Health = ReturnType<typeof computeHealth>;

/**
 * The Family Protection label, shared by the web dashboard and the mobile API. `devices`: phones and tablets paired.
 * `offline`: devices counted by their last known state. "Fully protected" needs every one of them online.
 */
export function healthLabel(score: number, total: number, offline: number, devices: number) {
  // Nothing paired: every check is "not configured", which isn't the same as needing action (web shows "–")
  if (!devices) return "No devices yet";
  if (score === total) return offline ? "Last known: all set" : "Fully protected";
  if (score >= total - 2) return "Good protection";
  if (score >= total / 2) return "Needs attention";
  return "Action required";
}

/** The label with the tone and icon the web pill draws it in. */
export function healthBadge(h: Pick<Health, "score" | "total" | "offline">, devices: number) {
  const label = healthLabel(h.score, h.total, h.offline, devices);
  const [tone, icon] = !devices ? ["muted", "circle-dashed"]
    : h.score >= h.total - 1 ? ["ok", "circle-check"]
    : label === "Good protection" ? ["accent", "shield"]
    : label === "Needs attention" ? ["warn", "triangle-alert"]
    : ["crit", "octagon-alert"];
  return { label, tone, icon };
}

/**
 * What the dashboard's hero says about the family. `devices`: phones and tablets paired.
 * Never "looks good" while a device is offline, a child has no device, or a protection is turned off.
 */
export function familySummary(health: Health, children: { id: string; name: string; devices: unknown[] }[], devices: number) {
  // With nothing paired every check is NOT_CONFIGURED: nothing to fix, only something to pair
  const issues = devices ? health.checks.filter((c) => !isPassing(c.status)).length : 0;
  const unpaired = children.filter((c) => !c.devices.length).map(({ id, name }) => ({ id, name }));
  const unpairedText = unpaired.length === 1 ? `${unpaired[0].name} has no paired device yet.` : `${unpaired.length} children have no paired device yet.`;
  const off = health.offline;
  let lede: [string, string];
  if (!devices) lede = ["Your family is almost set.", "Pair a device to start protecting them."];
  else if (issues) {
    const critical = health.checks.some((c) => c.status === "ACTION_REQUIRED");
    const good = !critical && health.score >= health.total - 2 && !off && !unpaired.length;
    lede = ["Your family's digital safety", critical ? "needs your attention." : good ? "looks good today." : "needs a little attention."];
  } else if (unpaired.length) lede = [`Every paired device is ${health.verified ? "verified" : "set, as last reported"}.`, unpairedText];
  else if (health.verified) lede = ["Every protection is verified.", "Your family is set."];
  else lede = ["Every protection matched when devices last synced.", `${off} ${off === 1 ? "device is" : "devices are"} offline, so we can't verify ${off === 1 ? "it" : "them"} now.`];
  return { lede, issues, unpaired };
}

/** Browser states (the extension's own report) that need the parent; null is "waiting for its first health check". */
const BROWSER_PROBLEMS = new Set(["NEEDS_ATTENTION", "ACTION_REQUIRED", "SYNC_PAUSED", "UNSUPPORTED"]);

/** A browser extension needs the parent when it was disconnected for security, went quiet for a day, or reports a problem. */
export function browserNeedsAttention(b: { revokedAt: Date | null; lastSeenAt: Date | null; protectionState: string | null }, now = Date.now()) {
  return !!b.revokedAt || isOffline(b, now) || (!!b.protectionState && BROWSER_PROBLEMS.has(b.protectionState));
}

/** `firstCheck`: nothing reported yet, so every protection counts as an issue; show "Waiting for first check" instead. */
export type DeviceState = { key: "healthy" | "issues" | "offline"; issues: number; firstCheck: boolean };

/**
 * A protection the device hasn't reported counts as not passing, as in computeHealth: otherwise a device that was
 * just paired (or never sends some keys) reads "Healthy" while its child's score says nothing is verified.
 */
export function deviceState(d: DeviceLike, now = Date.now()): DeviceState {
  const issues = PROTECTIONS.filter((p) => !isPassing(d.protections.find((x) => x.key === p.key)?.status ?? "NOT_CONFIGURED")).length;
  const firstCheck = !d.protections.length;
  if (isOffline(d, now)) return { key: "offline", issues, firstCheck };
  return issues ? { key: "issues", issues, firstCheck } : { key: "healthy", issues: 0, firstCheck };
}

/**
 * Status of one protection on one device, from what it reported vs the child's policy. A protection the parent
 * turned off passes: the device does what was asked, so it mustn't read as something to fix. Only a child with no
 * policy for it at all is NOT_CONFIGURED (unless the device has it on anyway).
 */
export function evaluate(cap: Capability, policy: unknown, reported: unknown): CheckStatus {
  if (cap === "UNSUPPORTED") return "UNSUPPORTED";
  if (policy == null) return isConfigured(reported) ? "PASS" : "NOT_CONFIGURED";
  if (!isConfigured(policy)) return "PASS";
  if (configMatches(policy, reported)) return "PASS";
  const key = (policy as { key: ProtectionKey }).key;
  if ((key === "UNINSTALL_PROTECTION" || key === "APP_APPROVAL") && !isConfigured(reported)) return "ACTION_REQUIRED";
  return "WARNING";
}

