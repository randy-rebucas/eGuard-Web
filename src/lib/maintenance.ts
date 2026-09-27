import "server-only";
import type { Alert } from "@prisma/client";
import { db } from "./db";
import { ensureOfflineAlerts } from "./engine";
import { familiesWithPurchases, refreshPurchases } from "./billing";
import { appUrl } from "./email-verification";
import { escapeHtml, sendMail } from "./mail";

/**
 * Background upkeep, run every few minutes by /api/cron/maintenance. Before this existed, offline
 * devices, lapsed subscriptions and old data were only handled when a parent happened to open the app.
 */

/** Audit entries are kept longer than activity: they're the security record. */
const AUDIT_RETENTION_DAYS = 365;

/** Alerts worth an email: anything needing action, and protection changes / devices going quiet (tampering). */
const worthEmail = (a: Alert) =>
  a.severity === "ACTION_REQUIRED" || a.severity === "CRITICAL"
  || (a.severity === "ATTENTION" && (a.category === "PROTECTION" || a.category === "DEVICES" || a.category === "LOCATION"));

export async function raiseOfflineAlerts() {
  const families = await db.device.findMany({ distinct: ["familyId"], select: { familyId: true } });
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
 * usage, location visits, change history, finished requests and checks, and alerts that are no longer
 * open. Plus expired sessions, links, pairing codes and rate-limit counters.
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
    alerts: await db.$executeRawUnsafe(`DELETE FROM "Alert" t USING "Family" f WHERE t."familyId" = f.id AND (t."resolvedAt" IS NOT NULL OR t.severity = 'INFO') AND ${cutoff('t."createdAt"')}`),
    auditLog: await db.auditLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - AUDIT_RETENTION_DAYS * 864e5) } } }).then((r) => r.count),
    sessions: await db.session.deleteMany({ where: { expiresAt: { lt: now } } }).then((r) => r.count),
    links: (await db.emailVerification.deleteMany({ where: { expiresAt: { lt: now } } })).count + (await db.passwordReset.deleteMany({ where: { expiresAt: { lt: now } } })).count,
    pairingCodes: await db.pairingCode.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 864e5) } } }).then((r) => r.count),
    rateLimits: await db.rateLimit.deleteMany({ where: { resetAt: { lt: now } } }).then((r) => r.count),
  };
  return counts;
}

function alertEmail(a: Alert, name: string) {
  const link = `${appUrl()}/notifications`;
  const lines = [a.body, a.fromValue && a.toValue ? `Was: ${a.fromValue}\nNow: ${a.toValue}` : null].filter(Boolean).join("\n\n");
  return {
    subject: `eGuard: ${a.title} (${a.subject})`,
    text: `Hi ${name},\n\n${a.title}: ${a.subject}\n\n${lines}\n\nOpen eGuard: ${link}\n\nYou get these emails because "Email alerts" is on in Settings › Notifications.\n\n— eGuard`,
    html: `<p>Hi ${escapeHtml(name)},</p><p><b>${escapeHtml(a.title)}</b>: ${escapeHtml(a.subject)}</p><p>${escapeHtml(a.body)}</p>`
      + (a.fromValue && a.toValue ? `<p style="color:#555">Was: ${escapeHtml(a.fromValue)}<br>Now: ${escapeHtml(a.toValue)}</p>` : "")
      + `<p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600">Open eGuard</a></p>`
      + `<p style="color:#555;font-size:13px">You get these emails because "Email alerts" is on in Settings › Notifications.</p>`,
  };
}

/**
 * Emails each new important alert, once, to the family's parents who have email alerts on and a verified
 * address. Alerts that resolved before we got to them aren't sent. (Push needs FCM/APNs, not wired yet.)
 */
export async function emailNewAlerts() {
  const alerts = await db.alert.findMany({ where: { notifiedAt: null }, orderBy: { createdAt: "asc" }, take: 500 });
  let sent = 0;
  for (const a of alerts) {
    // Claim it first so two overlapping runs never send the same alert twice
    const claimed = await db.alert.updateMany({ where: { id: a.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
    if (!claimed.count || a.resolvedAt || !worthEmail(a)) continue;
    const parents = await db.user.findMany({ where: { familyId: a.familyId, notifyEmail: true, emailVerifiedAt: { not: null } } });
    for (const p of parents) {
      try {
        await sendMail({ to: p.email, ...alertEmail(a, p.name.split(/\s+/)[0]) });
        sent++;
      } catch (e) {
        console.error("[maintenance] alert email failed", a.id, e);
      }
    }
  }
  return { alerts: alerts.length, sent };
}

export async function runMaintenance() {
  const offlineFamilies = await raiseOfflineAlerts();
  const purchases = await refreshAllPurchases();
  const emails = await emailNewAlerts();
  const purged = await purgeExpiredData();
  return { offlineFamilies, purchases, emails, purged };
}
