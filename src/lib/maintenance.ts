import "server-only";
import type { Alert } from "@prisma/client";
import { db } from "./db";
import { ensureOfflineAlerts, offlineDeviceWhere } from "./engine";
import { raiseBrowserOfflineAlerts } from "./browser-health";
import { familiesWithPurchases, refreshPurchases } from "./billing";
import { sendPassReminders } from "./web-billing";
import { refreshPendingBatches } from "./organizations";
import { ORG_EVENT_RETENTION_DAYS, sendCodeExpiryReminders, sendOrgDigests } from "./org-notifications";
import { appUrl } from "./email-verification";
import { escapeHtml, sendMail } from "./mail";
import { familyEntitlements } from "./plan-access";
import { alertPush, pushAvailable, pushToUsers } from "./push";

/**
 * Background upkeep, run every few minutes by /api/cron/maintenance. Before this existed, offline
 * devices, lapsed subscriptions and old data were only handled when a parent happened to open the app.
 */

/** Audit entries are kept longer than activity: they're the security record. */
const AUDIT_RETENTION_DAYS = 365;

/** A child asking for something (an app, a blocked website): emailed only to parents with "App approval requests" on. */
export const isChildRequest = (a: Pick<Alert, "resolveKey">) => !!a.resolveKey && /^(APPREQ|WEBREQ):/.test(a.resolveKey);

/** Alerts worth an email: anything needing action, protection changes / devices going quiet (tampering), and children's requests. */
export const worthEmail = (a: Pick<Alert, "severity" | "category" | "resolveKey">) =>
  a.severity === "ACTION_REQUIRED" || a.severity === "CRITICAL" || isChildRequest(a)
  || (a.severity === "ATTENTION" && (a.category === "PROTECTION" || a.category === "DEVICES" || a.category === "LOCATION"));

/** Only families with a quiet device can need an alert, so the rest aren't visited. */
export async function raiseOfflineAlerts() {
  const families = await db.device.findMany({ where: offlineDeviceWhere(), distinct: ["familyId"], select: { familyId: true } });
  for (const f of families) await ensureOfflineAlerts(f.familyId);
  return families.length;
}

export async function refreshAllPurchases() {
  const ids = await familiesWithPurchases();
  let failed = 0;
  for (const id of ids) {
    try { await refreshPurchases(id); } catch (e) { failed++; console.error("[maintenance] purchase refresh failed", id, e); }
  }
  return { families: ids.length, failed };
}

/**
 * Deletes activity older than each family's retention period (Settings › Privacy): screen time, app
 * usage, location visits, change history, finished requests and checks, browser health reports, daily
 * block counts and site requests, and alerts that are no longer open. Plus expired sessions, links, pairing codes and rate-limit counters.
 */
export async function purgeExpiredData(now = new Date()) {
  const cutoff = (col: string) => `${col} < now() - make_interval(days => f."retentionDays")`;
  const counts = {
    screenTime: await db.$executeRawUnsafe(`DELETE FROM "ScreenTimeDaily" t USING "Child" c JOIN "Family" f ON f.id = c."familyId" WHERE t."childId" = c.id AND ${cutoff('t."date"')}`),
    appUsage: await db.$executeRawUnsafe(`DELETE FROM "AppUsageDaily" t USING "Child" c JOIN "Family" f ON f.id = c."familyId" WHERE t."childId" = c.id AND ${cutoff('t."date"')}`),
    visits: await db.$executeRawUnsafe(`DELETE FROM "LocationVisit" t USING "Child" c JOIN "Family" f ON f.id = c."familyId" WHERE t."childId" = c.id AND ${cutoff('t."arrivedAt"')}`),
    changes: await db.$executeRawUnsafe(`DELETE FROM "ConfigChange" t USING "Family" f WHERE t."familyId" = f.id AND ${cutoff('t."createdAt"')}`),
    requests: await db.$executeRawUnsafe(`DELETE FROM "ConfigRequest" t USING "Child" c JOIN "Family" f ON f.id = c."familyId" WHERE t."childId" = c.id AND t.status IN ('VERIFIED','FAILED','CANCELLED') AND ${cutoff('t."createdAt"')}`),
    checks: await db.$executeRawUnsafe(`DELETE FROM "CheckRun" t USING "Family" f WHERE t."familyId" = f.id AND t.status = 'COMPLETED' AND ${cutoff('t."createdAt"')}`),
    browserHealth: await db.$executeRawUnsafe(`DELETE FROM "BrowserHealthCheck" t USING "BrowserInstallation" b JOIN "Family" f ON f.id = b."familyId" WHERE t."installationId" = b.id AND ${cutoff('t."createdAt"')}`),
    browserEvents: await db.$executeRawUnsafe(`DELETE FROM "BrowserEventDaily" t USING "BrowserInstallation" b JOIN "Family" f ON f.id = b."familyId" WHERE t."installationId" = b.id AND ${cutoff('t."date"')}`),
    // A site the child asked for and their reason: activity like the rest (one still unanswered by then is stale too)
    accessRequests: await db.$executeRawUnsafe(`DELETE FROM "BrowserAccessRequest" t USING "Family" f WHERE t."familyId" = f.id AND ${cutoff('t."createdAt"')}`),
    alerts: await db.$executeRawUnsafe(`DELETE FROM "Alert" t USING "Family" f WHERE t."familyId" = f.id AND (t."resolvedAt" IS NOT NULL OR t.severity = 'INFO') AND ${cutoff('t."createdAt"')}`),
    orgEvents: await db.orgEvent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - ORG_EVENT_RETENTION_DAYS * 864e5) } } }).then((r) => r.count),
    auditLog: await db.auditLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - AUDIT_RETENTION_DAYS * 864e5) } } }).then((r) => r.count),
    sessions: await db.session.deleteMany({ where: { expiresAt: { lt: now } } }).then((r) => r.count),
    signInChallenges: await db.loginChallenge.deleteMany({ where: { expiresAt: { lt: now } } }).then((r) => r.count),
    links: (await db.emailVerification.deleteMany({ where: { expiresAt: { lt: now } } })).count + (await db.passwordReset.deleteMany({ where: { expiresAt: { lt: now } } })).count,
    pairingCodes: await db.pairingCode.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 864e5) } } }).then((r) => r.count),
    rateLimits: await db.rateLimit.deleteMany({ where: { resetAt: { lt: now } } }).then((r) => r.count),
  };
  return counts;
}

function alertEmail(a: Alert, name: string) {
  const link = `${appUrl()}/notifications`;
  const lines = [a.body, a.fromValue && a.toValue ? `Was: ${a.fromValue}\nNow: ${a.toValue}` : null].filter(Boolean).join("\n\n");
  const why = isChildRequest(a) ? `"Email alerts" and "App approval requests" are on` : `"Email alerts" is on`;
  return {
    subject: `eGuard: ${a.title} (${a.subject})`,
    text: `Hi ${name},\n\n${a.title}: ${a.subject}\n\n${lines}\n\nOpen eGuard: ${link}\n\nYou get these emails because ${why} in Settings › Notifications.\n\n— eGuard`,
    html: `<p>Hi ${escapeHtml(name)},</p><p><b>${escapeHtml(a.title)}</b>: ${escapeHtml(a.subject)}</p><p>${escapeHtml(a.body)}</p>`
      + (a.fromValue && a.toValue ? `<p style="color:#555">Was: ${escapeHtml(a.fromValue)}<br>Now: ${escapeHtml(a.toValue)}</p>` : "")
      + `<p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600">Open eGuard</a></p>`
      + `<p style="color:#555;font-size:13px">You get these emails because ${escapeHtml(why)} in Settings › Notifications.</p>`,
  };
}

/**
 * Sends each new important alert, once: by email to the family's parents with "Email alerts" on and a verified
 * address, and by push (when FCM is set up) to those with "Push notifications" on, on plans with real-time alerts.
 * A child's request also needs "App approval requests". Alerts that resolved before we got to them aren't sent.
 */
export async function notifyNewAlerts() {
  const alerts = await db.alert.findMany({ where: { notifiedAt: null }, orderBy: { createdAt: "asc" }, take: 500 });
  const push = pushAvailable();
  let sent = 0, pushed = 0;
  for (const a of alerts) {
    // Claim it first so two overlapping runs never send the same alert twice
    const claimed = await db.alert.updateMany({ where: { id: a.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
    if (!claimed.count || a.resolvedAt || !worthEmail(a)) continue;
    const parents = await db.user.findMany({
      where: { familyId: a.familyId, ...(isChildRequest(a) ? { notifyApproval: true } : {}) },
      select: { id: true, email: true, name: true, notifyEmail: true, notifyPush: true, emailVerifiedAt: true },
    });
    for (const p of parents.filter((p) => p.notifyEmail && p.emailVerifiedAt)) {
      try {
        await sendMail({ to: p.email, ...alertEmail(a, p.name.split(/\s+/)[0]) });
        sent++;
      } catch (e) {
        console.error("[maintenance] alert email failed", a.id, e);
      }
    }
    const pushTo = parents.filter((p) => p.notifyPush).map((p) => p.id);
    if (push && pushTo.length && (await familyEntitlements(a.familyId)).realtimeAlerts) {
      try {
        pushed += await pushToUsers(pushTo, alertPush(a));
      } catch (e) {
        console.error("[maintenance] alert push failed", a.id, e);
      }
    }
  }
  return { alerts: alerts.length, sent, pushed };
}

/**
 * Every step runs even if an earlier one fails: one bad family or a mail outage mustn't stop alert emails
 * and data retention for everyone. Failed steps are logged and named in `failed`.
 */
export async function runMaintenance() {
  const failed: string[] = [];
  const step = async <T,>(name: string, fn: () => Promise<T>): Promise<T | null> => {
    try { return await fn(); } catch (e) { failed.push(name); console.error(`[maintenance] ${name} failed`, e); return null; }
  };
  const offlineFamilies = await step("offline alerts", raiseOfflineAlerts);
  const offlineBrowsers = await step("browser offline alerts", raiseBrowserOfflineAlerts);
  const purchases = await step("purchase refresh", refreshAllPurchases);
  const passReminders = await step("pass reminders", () => sendPassReminders());
  const codeBatches = await step("code batch refresh", () => refreshPendingBatches());
  const codeReminders = await step("code expiry reminders", () => sendCodeExpiryReminders());
  const orgDigests = await step("organization digests", () => sendOrgDigests());
  const emails = await step("alert emails and push", notifyNewAlerts);
  const purged = await step("data retention", () => purgeExpiredData());
  return { offlineFamilies, offlineBrowsers, purchases, passReminders, codeBatches, codeReminders, orgDigests, emails, purged, failed };
}
