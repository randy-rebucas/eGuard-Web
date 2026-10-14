import "server-only";
import type { BrowserInstallation, CheckStatus, Child } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { enforce } from "./rate-limit";
import { createAlertUnless, resolveAlerts } from "./engine";
import { OFFLINE_AFTER_MS } from "./health";
import { browserLabel, browserOfflineKey as offlineKey } from "./browser-service";
import { ServiceError } from "./errors";

/**
 * Browser health (/api/browser/v1/health and /events). The extension checks its own setup and reports the
 * results; eGuard compares them with the child's current policy and tells parents when protection drifts,
 * the same "reported vs desired" model as processReport for phones. Alerts use resolveKey so each problem
 * is raised once and resolved when the browser reports it fixed.
 */

export const HEALTH_CHECK_IDS = ["policy_signature", "rules_installed", "private_windows", "site_access", "sync_fresh", "safe_browsing", "force_installed"] as const;
export const PROTECTION_STATES = ["PROTECTED", "NEEDS_ATTENTION", "ACTION_REQUIRED", "SYNC_PAUSED", "UNSUPPORTED"] as const;
const CHECK_STATUSES = ["PASS", "WARNING", "ACTION_REQUIRED", "UNSUPPORTED", "NOT_CONFIGURED"] as const satisfies readonly CheckStatus[];

export const HealthReport = z.object({
  state: z.enum(PROTECTION_STATES),
  policyVersion: z.number().int().positive().nullable(),
  // Unknown check ids are dropped rather than refused, so a newer extension can report checks this server doesn't know yet
  checks: z.array(z.object({ id: z.string().max(40), status: z.enum(CHECK_STATUSES) })).max(20),
  // Optional (older extensions send them only at pairing): keeps the version parents see current after updates
  extensionVersion: z.string().trim().min(1).max(20).optional(),
  browserVersion: z.string().trim().max(40).nullable().optional(),
});
export type HealthReport = z.infer<typeof HealthReport>;

/**
 * A policy change reaches the browser on its next sync (every 5 minutes). Until this long after the change,
 * an older applied version is the change in flight, not drift.
 */
export const DRIFT_GRACE_MS = 15 * 60_000;
const HEALTH_REPORTS_PER_HOUR = { max: 60, windowMs: 3600_000 };
const EVENT_REPORTS_PER_HOUR = { max: 30, windowMs: 3600_000 };

type Inst = BrowserInstallation & { child: Child };
const label = (inst: Inst) => `${inst.child.name}'s ${browserLabel(inst)}`;

export const driftKey = (id: string) => `BROWSER_DRIFT:${id}`;
export const privateKey = (id: string) => `BROWSER_PRIVATE:${id}`;
export const safeBrowsingKey = (id: string) => `BROWSER_SAFE_BROWSING:${id}`;
export const siteAccessKey = (id: string) => `BROWSER_SITE_ACCESS:${id}`;

/** Checks that count toward the score: UNSUPPORTED and NOT_CONFIGURED don't apply to this browser or family. */
export function scoreChecks(checks: { status: CheckStatus }[]) {
  const counted = checks.filter((c) => c.status !== "UNSUPPORTED" && c.status !== "NOT_CONFIGURED");
  return { score: counted.filter((c) => c.status === "PASS").length, total: counted.length };
}

/** Under a lock: two health reports at once (a retry, two windows) would otherwise both raise it. */
async function raiseOnce(inst: Inst, resolveKey: string, alert: { title: string; body: string; icon: string }) {
  await createAlertUnless(resolveKey, { familyId: inst.familyId, resolveKey, resolvedAt: null },
    { familyId: inst.familyId, childId: inst.childId, severity: "ATTENTION", category: "PROTECTION", subject: label(inst), resolveKey, ...alert });
}

/** Stores a health report and raises or resolves the alerts it implies. */
export async function recordHealth(inst: Inst, report: HealthReport, now = new Date()) {
  await enforce(`browserhealth:${inst.id}`, HEALTH_REPORTS_PER_HOUR, "Too many health reports. eGuard will accept the next one shortly.");
  const known = new Set<string>(HEALTH_CHECK_IDS);
  const checks = report.checks.filter((c, i, all) => known.has(c.id) && all.findIndex((x) => x.id === c.id) === i);
  const status = (id: (typeof HEALTH_CHECK_IDS)[number]) => checks.find((c) => c.id === id)?.status ?? null;
  const { score, total } = scoreChecks(checks);

  await db.$transaction([
    db.browserHealthCheck.create({ data: { installationId: inst.id, policyVersion: report.policyVersion, state: report.state, checks, score, total, createdAt: now } }),
    db.browserInstallation.update({
      where: { id: inst.id },
      data: {
        protectionState: report.state, appliedPolicyVersion: report.policyVersion, lastHealthAt: now, lastSeenAt: now,
        ...(report.extensionVersion !== undefined && { extensionVersion: report.extensionVersion }),
        ...(report.browserVersion !== undefined && { browserVersion: report.browserVersion }),
      },
    }),
  ]);

  // Drift: not enforcing the current policy, or its rules aren't in place
  const current = await db.browserPolicy.findUnique({ where: { childId: inst.childId }, select: { version: true, updatedAt: true } });
  const behind = !!current && (report.policyVersion ?? 0) < current.version;
  const inFlight = behind && now.getTime() - current.updatedAt.getTime() < DRIFT_GRACE_MS;
  const rules = status("rules_installed");
  const rulesBroken = rules === "ACTION_REQUIRED" || rules === "WARNING";
  if ((behind && !inFlight) || rulesBroken) {
    await raiseOnce(inst, driftKey(inst.id), {
      icon: "shield-alert",
      title: "Browser protection changed",
      body: rulesBroken
        ? `The website rules in ${browserLabel(inst)} don't match your settings, so sites may not be blocked. eGuard is trying to set them up again.`
        : `${browserLabel(inst)} is still using older browser settings (version ${report.policyVersion ?? "none"}, latest ${current!.version}).`,
    });
  } else if (!behind) {
    await resolveAlerts(inst.familyId, driftKey(inst.id));
  }

  const priv = status("private_windows");
  if (priv === "WARNING" || priv === "ACTION_REQUIRED") {
    await raiseOnce(inst, privateKey(inst.id), {
      icon: "eye-off",
      title: "Private windows aren't protected",
      body: `eGuard isn't allowed to run in ${inst.browser}'s private windows on ${inst.deviceLabel}, so sites open there without your settings. Turn on "Allow in private windows" for eGuard in ${inst.browser}'s extension settings.`,
    });
  } else if (priv === "PASS") {
    await resolveAlerts(inst.familyId, privateKey(inst.id));
  }

  // Site access withdrawn in the browser's settings: blocking goes on, SafeSearch doesn't. If eGuard's own address
  // went with it, this report never arrives and the offline alert says so a day later.
  const access = status("site_access");
  if (access === "ACTION_REQUIRED") {
    await raiseOnce(inst, siteAccessKey(inst.id), {
      icon: "shield-off",
      title: "SafeSearch is off in this browser",
      body: `eGuard's site access was turned off in ${inst.browser}'s extension settings on ${inst.deviceLabel}. Sites are still blocked, but SafeSearch is off and eGuard may stop getting your changes. Turn site access back on for eGuard in ${inst.browser}'s extension settings.`,
    });
  } else if (access !== null) {
    await resolveAlerts(inst.familyId, siteAccessKey(inst.id));
  }

  const sb = status("safe_browsing");
  if (sb === "ACTION_REQUIRED") {
    await raiseOnce(inst, safeBrowsingKey(inst.id), {
      icon: "shield-off",
      title: "Malware and phishing protection is off",
      body: `${inst.browser}'s own protection against dangerous sites is off on ${inst.deviceLabel}, and something else controls that setting, so eGuard can't turn it back on.`,
    });
  } else if (sb !== null) {
    await resolveAlerts(inst.familyId, safeBrowsingKey(inst.id));
  }

  return { score, total };
}

/**
 * Browsers silent for a day. Usually the browser is just closed (its settings stay in force), but a turned-off or
 * removed extension (not force-installed), or one waiting for a permission after an update, looks the same from
 * here, so the alert says protection may be off. A shorter wait would alert every night a laptop sleeps. Once per
 * silence. Run by the maintenance job.
 */
export async function raiseBrowserOfflineAlerts(now = Date.now()) {
  const quiet = await db.browserInstallation.findMany({
    where: { revokedAt: null, lastSeenAt: { lt: new Date(now - OFFLINE_AFTER_MS) } },
    include: { child: true },
  });
  let raised = 0;
  for (const inst of quiet) {
    const rk = offlineKey(inst.id);
    // Two overlapping maintenance runs must not both raise it
    const created = await createAlertUnless(rk, { familyId: inst.familyId, resolveKey: rk, resolvedAt: null }, {
      familyId: inst.familyId, childId: inst.childId, severity: "ATTENTION", category: "DEVICES", icon: "wifi-off",
      title: "eGuard may be off in this browser", subject: label(inst), resolveKey: rk,
      body: `${browserLabel(inst)} hasn't checked in for over a day. If it's just been closed, its settings are still on and this clears when it's opened. If eGuard was turned off or removed there, nothing is filtered: open the browser's extensions page and check that eGuard is on. After an update, the browser may also be waiting for someone to accept eGuard's new permissions.`,
    });
    if (created) raised++;
  }
  return raised;
}

// ---------- Daily counts ----------

/** A WebCategory or one of the non-category reasons. Keys only: the extension never sends a site. */
const EventKey = z.string().regex(/^[A-Z][A-Z_]{1,31}$/);
export const EventsReport = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  blocked: z.record(EventKey, z.number().int().min(0).max(100_000)).refine((r) => Object.keys(r).length <= 24, "Too many categories"),
});
export type EventsReport = z.infer<typeof EventsReport>;

/** How many days back a browser that was offline may still report. */
export const EVENTS_MAX_AGE_DAYS = 14;

/** "YYYY-MM-DD" for `now` in `timeZone`. */
export function dayIn(timeZone: string, now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * Stores one day's counts for this browser. Sending the same day again replaces its counts (a retry after a
 * lost response mustn't double them). Days in the future or older than two weeks are refused.
 */
export async function recordEvents(inst: Inst, report: EventsReport, now = new Date()) {
  await enforce(`browserevents:${inst.id}`, EVENT_REPORTS_PER_HOUR, "Too many reports. eGuard will accept the next one shortly.");
  const date = new Date(`${report.date}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== report.date) {
    throw new ServiceError(400, "That isn't a date.", "invalid_date");
  }
  const family = await db.family.findUniqueOrThrow({ where: { id: inst.familyId }, select: { timezone: true } });
  const today = new Date(`${dayIn(family.timezone, now)}T00:00:00Z`);
  const ageDays = (today.getTime() - date.getTime()) / 864e5;
  // One day of slack ahead: the browser's clock or time zone may be a little different
  if (ageDays < -1 || ageDays > EVENTS_MAX_AGE_DAYS) throw new ServiceError(400, "Counts can only be sent for the last two weeks.", "invalid_date");

  const rows = Object.entries(report.blocked).filter(([, n]) => n > 0);
  await db.$transaction(async (tx) => {
    // A retry arriving with the original (lost response) would otherwise insert the same rows twice and fail
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`browserevents:${inst.id}:${report.date}`}))`;
    await tx.browserEventDaily.deleteMany({ where: { installationId: inst.id, date } });
    await tx.browserEventDaily.createMany({ data: rows.map(([category, blockedCount]) => ({ installationId: inst.id, date, category, blockedCount })) });
  });
  return { date: report.date, categories: rows.length };
}
