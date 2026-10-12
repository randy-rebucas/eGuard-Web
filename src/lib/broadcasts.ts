import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { newToken } from "./auth";
import { appUrl } from "./email-verification";
import { escapeHtml, sendMail } from "./mail";
import { PLANS } from "./plans";

/**
 * Emails the eGuard team sends to many parents at once (console › Email, docs/console.md §8). Staff write one,
 * send themselves a test, then send it now or schedule it. Either way the maintenance job does the sending: when a
 * broadcast is due it takes the recipient list once (a BroadcastDelivery per parent), then works through it a batch
 * per run, so a large send never outlasts a request, nobody gets it twice, and a run that stops resumes.
 */

export const BROADCAST_KINDS = ["UPDATE", "SERVICE"] as const;
export type BroadcastKind = (typeof BROADCAST_KINDS)[number];
export const KIND_LABEL: Record<BroadcastKind, string> = { UPDATE: "Product update", SERVICE: "Service notice" };
export const isBroadcastKind = (v: unknown): v is BroadcastKind => BROADCAST_KINDS.includes(v as BroadcastKind);

export const BROADCAST_STATUSES = ["DRAFT", "SCHEDULED", "SENDING", "SENT", "CANCELLED"] as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];
export const isBroadcastStatus = (v: unknown): v is BroadcastStatus => BROADCAST_STATUSES.includes(v as BroadcastStatus);

/** The plans an audience can be narrowed to, as Family.plan stores them */
export const PLAN_NAMES = PLANS.map((p) => p.name);

/** Emails sent per call of deliverBroadcasts: the maintenance job runs every 10 minutes, so about 600 an hour */
export const BATCH_SIZE = 100;
/** Stops starting new emails after this long, leaving room for the job's other steps (maxDuration 300 s) */
const DEADLINE_MS = 90_000;
/** Between two emails in production, to stay under Resend's rate limit (2 a second by default) */
const SEND_GAP_MS = 550;
/** A delivery claimed but never finished this long ago (the run died mid-send) is given up as failed */
const STUCK_MS = 15 * 60_000;

/** "[TODO: the launch date]": a gap the AI writer (lib/broadcast-ai) left for staff. An email with one isn't sent. */
export const PLACEHOLDER_RE = /\[TODO[^\]]*\]/i;

export const BroadcastSchema = z.object({
  kind: z.enum(BROADCAST_KINDS, "Choose the kind of email."),
  subject: z.string().trim().min(1, "Enter a subject.").max(150, "Keep the subject under 150 characters."),
  body: z.string().trim().min(1, "Write the message.").max(20_000, "Keep the message under 20,000 characters."),
  plans: z.array(z.string().refine((p) => PLAN_NAMES.includes(p), "Choose plans from the list.")),
});
export type BroadcastInput = z.infer<typeof BroadcastSchema>;

/**
 * Who a broadcast goes to: parents with a verified address (nobody else gets any email from eGuard), on the chosen
 * plans; product updates only to those who haven't turned them off.
 */
export const audienceWhere = (b: { kind: string; plans: string[] }) => ({
  emailVerifiedAt: { not: null },
  ...(b.kind === "SERVICE" ? {} : { productUpdates: true }),
  ...(b.plans.length ? { family: { plan: { in: b.plans } } } : {}),
}) satisfies Prisma.UserWhereInput;

export const countAudience = (b: { kind: string; plans: string[] }) => db.user.count({ where: audienceWhere(b) });

/**
 * A time typed in the console's datetime-local field ("2026-10-12T14:30"), which is Philippine time like the rest
 * of the console (UTC+8 all year: no daylight saving). Null when it isn't one.
 */
export function parseConsoleTime(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The other way: a Date as the datetime-local field's value, in Philippine time */
export const consoleTimeValue = (d: Date) => new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 16);

export const unsubscribePage = (token: string) => `${appUrl()}/unsubscribe?t=${encodeURIComponent(token)}`;
/** RFC 8058 one-click: mail apps POST here from their own "Unsubscribe" button */
export const unsubscribeEndpoint = (token: string) => `${appUrl()}/api/email/unsubscribe?t=${encodeURIComponent(token)}`;

const URL_RE = /https?:\/\/[^\s<]*[^\s<.,;:!?)'"]/g;

/** Escaped, with links made clickable. Escaping first keeps a link's `&` as `&amp;`, which is right in href too. */
const linkify = (s: string) =>
  escapeHtml(s).replace(URL_RE, (u) => `<a href="${u}" style="color:#1a73e8">${u}</a>`);

/**
 * The email for one parent. Pure, so it can be tested without a database. `token` is their delivery's unsubscribe
 * token (product updates only); without one (a test send) the footer still shows where the link goes.
 */
export function broadcastEmail(b: { kind: string; subject: string; body: string }, name: string, token: string | null) {
  const paragraphs = b.body.trim().split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const hi = name ? `Hi ${name},` : "Hi,";
  const update = b.kind !== "SERVICE";
  const page = token ? unsubscribePage(token) : `${appUrl()}/settings/notifications`;
  const why = update
    ? `You get product updates from eGuard because they're on in Settings › Notifications.`
    : `This is a service notice about your eGuard account, so it goes to every parent whatever their email settings.`;
  const text = `${hi}\n\n${paragraphs.join("\n\n")}\n\n— The eGuard team\n\n${why}`
    + (update ? ` Unsubscribe: ${page}` : "");
  const html = `<p>${escapeHtml(hi)}</p>`
    + paragraphs.map((p) => `<p>${linkify(p).replace(/\n/g, "<br>")}</p>`).join("")
    + `<p>— The eGuard team</p>`
    + `<p style="color:#555;font-size:13px">${escapeHtml(why)}`
    + (update ? ` <a href="${escapeHtml(page)}" style="color:#555">Unsubscribe</a>` : "") + `</p>`;
  const headers = update && token
    ? { "List-Unsubscribe": `<${unsubscribeEndpoint(token)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : undefined;
  return { subject: b.subject, text, html, ...(headers ? { headers } : {}) };
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** Sends one copy to a staff member, marked as a test. Its unsubscribe link goes to Settings, not a real token. */
export async function sendTestBroadcast(b: { kind: string; subject: string; body: string }, staff: { email: string; name: string }) {
  const mail = broadcastEmail(b, firstName(staff.name), null);
  await sendMail({ to: staff.email, ...mail, subject: `[Test] ${mail.subject}` });
}

/**
 * Starts every scheduled broadcast that's due: claims it (so two overlapping runs start it once) and takes its
 * recipient list, in one transaction, so a broadcast is never SENDING without its list.
 */
export async function startDueBroadcasts(now = new Date()) {
  const due = await db.broadcast.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: now } }, select: { id: true, kind: true, plans: true } });
  let started = 0;
  for (const b of due) {
    const ok = await db.$transaction(async (tx) => {
      const claimed = await tx.broadcast.updateMany({ where: { id: b.id, status: "SCHEDULED" }, data: { status: "SENDING", startedAt: now } });
      if (!claimed.count) return false;
      const users = await tx.user.findMany({ where: audienceWhere(b), select: { id: true, email: true } });
      await tx.broadcastDelivery.createMany({
        data: users.map((u) => ({ broadcastId: b.id, userId: u.id, email: u.email, token: newToken(24) })),
        skipDuplicates: true,
      });
      await tx.broadcast.update({ where: { id: b.id }, data: { recipients: users.length } });
      return true;
    }, { timeout: 60_000 });
    if (ok) started++;
  }
  return started;
}

/** Why a parent on the list doesn't get it after all, checked again at their turn: things change while it sends */
export function skipReason(kind: string, email: string, user: { email: string; emailVerifiedAt: Date | null; productUpdates: boolean } | null) {
  if (!user) return "Account deleted";
  if (user.email !== email) return "Email address changed";
  if (!user.emailVerifiedAt) return "Email not verified";
  if (kind !== "SERVICE" && !user.productUpdates) return "Unsubscribed";
  return null;
}

/** Marks a sending broadcast SENT once nobody on its list is left to send to. */
async function finishIfDone(broadcastId: string, now: Date) {
  await db.broadcastDelivery.updateMany({
    where: { broadcastId, status: "SENDING", updatedAt: { lt: new Date(now.getTime() - STUCK_MS) } },
    data: { status: "FAILED", error: "Interrupted while sending" },
  });
  const left = await db.broadcastDelivery.count({ where: { broadcastId, status: { in: ["PENDING", "SENDING"] } } });
  if (!left) await db.broadcast.updateMany({ where: { id: broadcastId, status: "SENDING" }, data: { status: "SENT", finishedAt: now } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The maintenance step (and "Send now", right after the click): starts due broadcasts, then sends up to `limit`
 * emails from those sending, oldest first. Each email is claimed before it's sent, and only while its broadcast is
 * still SENDING, so a cancel stops the rest at once. A failed email is recorded and not retried.
 */
export async function deliverBroadcasts({ now = new Date(), limit = BATCH_SIZE, deadlineMs = DEADLINE_MS } = {}) {
  const started = await startDueBroadcasts(now);
  const gap = process.env.NODE_ENV === "production" ? SEND_GAP_MS : 0;
  const stopAt = Date.now() + deadlineMs;
  let sent = 0, failed = 0, skipped = 0, budget = limit;
  const sending = await db.broadcast.findMany({ where: { status: "SENDING" }, orderBy: { startedAt: "asc" }, select: { id: true, kind: true, subject: true, body: true } });
  for (const b of sending) {
    if (budget > 0 && Date.now() < stopAt) {
      const batch = await db.broadcastDelivery.findMany({
        where: { broadcastId: b.id, status: "PENDING" }, orderBy: { id: "asc" }, take: budget,
        select: { id: true, email: true, token: true, user: { select: { name: true, email: true, emailVerifiedAt: true, productUpdates: true } } },
      });
      for (const d of batch) {
        if (budget <= 0 || Date.now() >= stopAt) break;
        const claimed = await db.broadcastDelivery.updateMany({ where: { id: d.id, status: "PENDING", broadcast: { status: "SENDING" } }, data: { status: "SENDING" } });
        if (!claimed.count) continue;
        const reason = skipReason(b.kind, d.email, d.user);
        if (reason) {
          await db.broadcastDelivery.update({ where: { id: d.id }, data: { status: "SKIPPED", error: reason } });
          skipped++;
          continue;
        }
        budget--;
        try {
          await sendMail({ to: d.email, ...broadcastEmail(b, firstName(d.user!.name), d.token) });
          await db.broadcastDelivery.update({ where: { id: d.id }, data: { status: "SENT", sentAt: new Date() } });
          sent++;
        } catch (e) {
          await db.broadcastDelivery.update({ where: { id: d.id }, data: { status: "FAILED", error: (e instanceof Error ? e.message : String(e)).slice(0, 300) } });
          failed++;
          console.error("[broadcast] email failed", b.id, d.id, e);
        }
        if (gap) await sleep(gap);
      }
    }
    await finishIfDone(b.id, now);
  }
  return { started, sent, failed, skipped };
}

/** Stops a broadcast that hasn't finished. Anyone not sent to yet is skipped. Returns the status it was in, or null. */
export async function cancelBroadcast(id: string) {
  const b = await db.broadcast.findUnique({ where: { id }, select: { status: true } });
  if (!b || !["DRAFT", "SCHEDULED", "SENDING"].includes(b.status)) return null;
  const { count } = await db.broadcast.updateMany({ where: { id, status: b.status }, data: { status: "CANCELLED", finishedAt: new Date() } });
  if (!count) return null;
  await db.broadcastDelivery.updateMany({ where: { broadcastId: id, status: "PENDING" }, data: { status: "SKIPPED", error: "Cancelled" } });
  return b.status;
}

/** Each broadcast's deliveries by status: { SENT: 120, FAILED: 2, … } */
export async function deliveryCounts(ids: string[]) {
  const rows = ids.length
    ? await db.broadcastDelivery.groupBy({ by: ["broadcastId", "status"], where: { broadcastId: { in: ids } }, _count: { _all: true } })
    : [];
  const out = new Map<string, Record<string, number>>();
  for (const r of rows) out.set(r.broadcastId, { ...out.get(r.broadcastId), [r.status]: r._count._all });
  return out;
}

/**
 * The unsubscribe link: turns product updates off for that delivery's parent. The token can do nothing else, and
 * keeps working (it's idempotent) until its broadcast is deleted.
 */
export async function unsubscribeByToken(token: string): Promise<"done" | "invalid"> {
  if (!token || token.length > 100) return "invalid";
  const d = await db.broadcastDelivery.findUnique({ where: { token }, select: { userId: true, broadcast: { select: { kind: true } } } });
  if (!d?.userId || d.broadcast.kind === "SERVICE") return "invalid";
  await db.user.updateMany({ where: { id: d.userId }, data: { productUpdates: false } });
  return "done";
}
