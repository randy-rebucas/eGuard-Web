import "server-only";
import { db } from "./db";
import { computeHealth } from "./health";
import { appUrl } from "./email-verification";
import { dayKey, localTime } from "./queries";
import { addDays, reportData } from "./reports";
import { fmtMinutes } from "./protections";
import { dayLabel } from "./format";
import { escapeHtml, sendMail } from "./mail";

/**
 * The weekly summary ("Weekly summary" in Settings › Notifications): every Sunday at 6 PM in the family's time
 * zone, last week (Sunday to Saturday) in numbers. One run per family, claimed once, so two parents and two
 * overlapping maintenance runs never send it twice.
 */

/** Sunday 6 PM, as the setting promises */
export const DIGEST_HOUR = 18;
/** Missed by more than this (the job was down), that week's summary is skipped rather than sent late */
export const DIGEST_WINDOW_MS = 24 * 3600_000;

/** The latest Sunday 6 PM at or before `now` in `tz`, and the week (Sunday to Saturday) it summarises. */
export function digestWeek(now: Date, tz: string) {
  const today = dayKey(now, tz);
  let sunday = addDays(today, -new Date(`${today}T12:00:00Z`).getUTCDay());
  let dueAt = localTime(sunday, DIGEST_HOUR, tz);
  if (dueAt > now) {
    sunday = addDays(sunday, -7);
    dueAt = localTime(sunday, DIGEST_HOUR, tz);
  }
  return { dueAt, from: addDays(sunday, -7), to: addDays(sunday, -1) };
}

/** The week to send now, or null: not Sunday evening yet, already sent, or the window was missed. */
export function digestDue(f: { timezone: string; digestSentAt: Date | null }, now = new Date()) {
  const w = digestWeek(now, f.timezone);
  if (now.getTime() - w.dueAt.getTime() >= DIGEST_WINDOW_MS) return null;
  if (f.digestSentAt && f.digestSentAt >= w.dueAt) return null;
  return w;
}

export type DigestContent = {
  family: string;
  from: string;
  to: string;
  health: { score: number; total: number; offline: number };
  /** Average per day, this week and the week before (null when there's nothing to compare) */
  avg: number;
  prevAvg: number | null;
  children: { name: string; minutes: number }[];
  topApps: { app: string; minutes: number }[];
  changes: number;
  /** Open alerts that need a parent, and children's requests still waiting */
  attention: number;
  requests: number;
};

export async function digestContent(family: { id: string; name: string; timezone: string }, from: string, to: string): Promise<DigestContent> {
  const [report, devices, open, changes] = await Promise.all([
    reportData(family.id, family.timezone, from, to, { maxChanges: 0 }),
    db.device.findMany({ where: { familyId: family.id }, include: { protections: true } }),
    db.alert.findMany({ where: { familyId: family.id, resolvedAt: null, severity: { not: "INFO" } }, select: { resolveKey: true } }),
    db.configChange.count({ where: { familyId: family.id, createdAt: { gte: localTime(from, 0, family.timezone), lt: localTime(addDays(to, 1), 0, family.timezone) } } }),
  ]);
  const health = computeHealth(devices);
  const perChild = new Map<string, number>();
  for (const r of report.screen) perChild.set(r.childId, (perChild.get(r.childId) ?? 0) + (r._sum.minutes ?? 0));
  const requests = open.filter((a) => a.resolveKey && /^(APPREQ|WEBREQ):/.test(a.resolveKey)).length;
  return {
    family: family.name, from, to,
    health: { score: health.score, total: health.total, offline: health.offline },
    avg: report.avg, prevAvg: report.prevTotal ? report.prevAvg : null,
    children: report.children.map((c) => ({ name: c.name, minutes: perChild.get(c.id) ?? 0 })),
    topApps: report.apps.slice(0, 3).map((a) => ({ app: a.app, minutes: a._sum.minutes ?? 0 })),
    changes,
    attention: open.length - requests,
    requests,
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const weekRange = (from: string, to: string) => `${dayLabel(from).date} – ${dayLabel(to).date}`;

function trend(avg: number, prev: number | null) {
  if (prev == null) return "";
  const d = avg - prev;
  if (Math.abs(d) < 5) return ", about the same as the week before";
  return `, ${fmtMinutes(Math.abs(d))} ${d > 0 ? "more" : "less"} than the week before`;
}

/** The email for one parent. Pure, so it can be tested without a database. */
export function digestEmail(c: DigestContent, name: string, link: string) {
  const range = weekRange(c.from, c.to);
  const healthLine = `Configuration Health: ${c.health.score} of ${c.health.total} checks passing`
    + (c.health.offline ? ` (${plural(c.health.offline, "device")} offline, counted by last known state)` : "");
  const screenLine = `Screen time: ${fmtMinutes(c.avg)} a day on average${trend(c.avg, c.prevAvg)}`;
  const childLines = c.children.map((k) => `${k.name}: ${fmtMinutes(k.minutes)} this week`);
  const appsLine = c.topApps.length ? `Most used: ${c.topApps.map((a) => `${a.app} (${fmtMinutes(a.minutes)})`).join(", ")}` : null;
  const changesLine = `Settings changed: ${c.changes}`;
  const needs = [c.attention ? plural(c.attention, "alert") : null, c.requests ? plural(c.requests, "request") + " from your children" : null].filter(Boolean);
  const needsLine = needs.length ? `Waiting for you: ${needs.join(" and ")}` : null;
  const lines = [healthLine, screenLine, ...childLines, appsLine, changesLine, needsLine].filter((l): l is string => !!l);
  const why = `You get this because "Weekly summary" is on in Settings › Notifications.`;
  return {
    subject: `Your eGuard week: ${range}`,
    text: `Hi ${name},\n\nHere's ${c.family}'s week (${range}).\n\n${lines.map((l) => `- ${l}`).join("\n")}\n\nOpen the full report: ${link}\n\n${why}\n\n— eGuard`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>Here's ${escapeHtml(c.family)}'s week (${escapeHtml(range)}).</p>`
      + `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
      + `<p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600">Open the full report</a></p>`
      + `<p style="color:#555;font-size:13px">${escapeHtml(why)}</p>`,
  };
}

/**
 * Sends each family's summary once it's due. Only families with a paired device (nothing to report otherwise)
 * and a parent who wants it with a verified address are visited.
 */
export async function sendWeeklyDigests(now = new Date()) {
  const families = await db.family.findMany({
    where: {
      devices: { some: {} },
      users: { some: { weeklySummary: true, emailVerifiedAt: { not: null } } },
      // Sent in the last 6 days: can't be due again yet
      OR: [{ digestSentAt: null }, { digestSentAt: { lt: new Date(now.getTime() - 6 * 864e5) } }],
    },
    select: { id: true, name: true, timezone: true, digestSentAt: true },
  });
  let sent = 0, due = 0;
  for (const f of families) {
    const week = digestDue(f, now);
    if (!week) continue;
    // Claim it first so two overlapping runs never send the same week twice
    const claimed = await db.family.updateMany({ where: { id: f.id, digestSentAt: f.digestSentAt }, data: { digestSentAt: now } });
    if (!claimed.count) continue;
    due++;
    const content = await digestContent(f, week.from, week.to);
    const link = `${appUrl()}/reports?period=custom&from=${week.from}&to=${week.to}`;
    const parents = await db.user.findMany({ where: { familyId: f.id, weeklySummary: true, emailVerifiedAt: { not: null } }, select: { email: true, name: true } });
    for (const p of parents) {
      try {
        await sendMail({ to: p.email, ...digestEmail(content, p.name.split(/\s+/)[0], link) });
        sent++;
      } catch (e) {
        console.error("[digest] email failed", f.id, e);
      }
    }
  }
  return { families: due, sent };
}
