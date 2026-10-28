"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { isConsoleHost } from "@/lib/console-host";
import { authenticateStaff, endStaffSession, logStaff, requireStaff, startStaffSession } from "@/lib/staff-auth";
import { LIMITS, clientIpFrom, hit } from "@/lib/rate-limit";
import { draftBroadcast, type AiDraftInput } from "@/lib/broadcast-ai";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import { isTicketStatus } from "@/lib/console-queries";
import {
  AUDIENCE_LABEL, BroadcastSchema, KIND_LABEL, audienceNoun, type BroadcastAudience, PLACEHOLDER_RE, cancelBroadcast as cancel, countAudience, deliverBroadcasts, parseConsoleTime, sendTestBroadcast,
  type BroadcastKind,
} from "@/lib/broadcasts";
import type { FormState } from "./auth";
import { automationByKey } from "@/lib/parent-care/definitions";

/**
 * The staff console's actions (docs/console.md). Server actions can be posted to any page of the app, so each one
 * first checks it was sent to the console host: the staff cookie only exists there anyway, but signing in mustn't
 * leave one on www.
 */
async function consoleRequest() {
  const h = await headers();
  if (!isConsoleHost(h.get("host"))) throw new ServiceError(404, "Not found.", "not_found");
  return h;
}

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  code: z.string().trim().min(1, "Enter the code from your authenticator app."),
});

export async function consoleLogin(_: FormState, form: FormData): Promise<FormState> {
  const h = await consoleRequest();
  const email = String(form.get("email") ?? "");
  const parsed = LoginSchema.safeParse({ email, password: form.get("password"), code: form.get("code") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { email } };
  try {
    const staff = await authenticateStaff(parsed.data.email, parsed.data.password, parsed.data.code, clientIpFrom(h));
    await startStaffSession(staff.id);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message, fields: { email } };
    throw e;
  }
  redirect("/");
}

export async function consoleLogout() {
  await consoleRequest();
  await endStaffSession();
  redirect("/login");
}

export async function setTicketStatus(form: FormData) {
  await consoleRequest();
  const staff = await requireStaff();
  const id = String(form.get("id") ?? ""), status = form.get("status");
  if (!id || !isTicketStatus(status)) throw new ServiceError(400, "Choose a status.", "invalid");
  const t = await db.supportTicket.findUnique({ where: { id }, select: { status: true } });
  if (!t) throw new ServiceError(404, "Ticket not found.", "not_found");
  // Only from the state just read, so two staff (or a double click) closing at once log one change, not two
  if (t.status !== status && (await db.supportTicket.updateMany({ where: { id, status: t.status }, data: { status } })).count) {
    await logStaff(staff.id, "ticket.status", `ticket:${id}`, `${t.status} → ${status}`);
  }
  refresh();
}

/* Email broadcasts (docs/console.md §8). Only a draft can be edited, sent or deleted. */

const broadcastFields = (form: FormData) => ({
  audience: String(form.get("audience") ?? "PARENTS"),
  kind: String(form.get("kind") ?? ""), subject: String(form.get("subject") ?? ""), body: String(form.get("body") ?? ""),
  plans: form.getAll("plans").map(String),
});

const audienceDetail = (b: { audience?: string; kind: string; plans: string[] }, n: number) => !b.audience || b.audience === "PARENTS"
  ? `${KIND_LABEL[b.kind as BroadcastKind] ?? b.kind}, ${b.plans.length ? b.plans.join(", ") : "every plan"}, ${n} ${audienceNoun("PARENTS", n)}`
  : `${AUDIENCE_LABEL[b.audience as BroadcastAudience] ?? b.audience}, ${n} ${audienceNoun(b.audience, n)}`;

/** New (no id: then on to its page) or an edit of a draft. */
export async function saveBroadcast(_: FormState, form: FormData): Promise<FormState> {
  await consoleRequest();
  const staff = await requireStaff();
  const fields = broadcastFields(form);
  const echo = { audience: fields.audience, kind: fields.kind, subject: fields.subject, body: fields.body, plans: fields.plans.join("\n") };
  const parsed = BroadcastSchema.safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: echo };
  const id = String(form.get("id") ?? "");
  if (!id) {
    const b = await db.broadcast.create({ data: { ...parsed.data, createdById: staff.id }, select: { id: true } });
    await logStaff(staff.id, "broadcast.create", `broadcast:${b.id}`, parsed.data.subject);
    redirect(`/broadcasts/${b.id}`);
  }
  // Only over the version this form showed, so a stale tab can't undo another edit
  const base = draftVersion(form);
  const { count } = await db.broadcast.updateMany({ where: { id, status: "DRAFT", ...(base ? { updatedAt: base } : {}) }, data: parsed.data });
  if (!count) {
    const now = await db.broadcast.findUnique({ where: { id }, select: { status: true } });
    return { error: now?.status === "DRAFT" ? CHANGED : "Only a draft can be edited. Move it back to draft first.", fields: echo };
  }
  await logStaff(staff.id, "broadcast.edit", `broadcast:${id}`, parsed.data.subject);
  refresh();
  return { ok: "Saved." };
}

/** The draft's `updatedAt` as the form showed it (hidden field `version`), or null */
function draftVersion(form: FormData) {
  const d = new Date(String(form.get("version") ?? ""));
  return Number.isNaN(d.getTime()) ? null : d;
}
const CHANGED = "This email was changed since you opened it. Reload the page to see the changes, then try again.";

async function draft(id: string) {
  const b = await db.broadcast.findUnique({ where: { id }, select: { id: true, status: true, audience: true, kind: true, subject: true, body: true, plans: true, updatedAt: true } });
  if (!b) throw new ServiceError(404, "Email not found.", "not_found");
  return b;
}

/** One copy to the signed-in staff member, to check before it goes to everyone. */
export async function testBroadcast(_: FormState, form: FormData): Promise<FormState> {
  await consoleRequest();
  const staff = await requireStaff();
  const b = await draft(String(form.get("id") ?? ""));
  try {
    await sendTestBroadcast(b, staff);
  } catch (e) {
    console.error("[broadcast] test failed", b.id, e);
    return { error: "The test email couldn't be sent. Check the mail settings and try again." };
  }
  await logStaff(staff.id, "broadcast.test", `broadcast:${b.id}`, staff.email);
  return { ok: `Sent a test to ${staff.email}.` };
}

/**
 * Sends a draft now, or schedules it (`when`: a time in Philippine time). Either way the maintenance job does the
 * sending; "now" also starts the first batch straight after this response.
 */
export async function sendBroadcast(_: FormState, form: FormData): Promise<FormState> {
  await consoleRequest();
  const staff = await requireStaff();
  const b = await draft(String(form.get("id") ?? ""));
  if (b.status !== "DRAFT") return { error: "This email isn't a draft any more." };
  // The confirmation was for the draft as shown: an edit since (audience, kind, words) needs a fresh look
  if (draftVersion(form)?.getTime() !== b.updatedAt.getTime()) return { error: CHANGED };
  const now = form.get("mode") === "now";
  const at = now ? new Date() : parseConsoleTime(String(form.get("when") ?? ""));
  if (!at) return { error: "Choose the date and time to send it." };
  if (PLACEHOLDER_RE.test(`${b.subject}\n${b.body}`)) return { error: "Fill in the [TODO: …] parts and save the draft first." };
  if (!now && at.getTime() < Date.now() + 60_000) return { error: "Choose a time in the future, or send it now." };
  if (!now && at.getTime() > Date.now() + 365 * 864e5) return { error: "Choose a time within the next year." };
  if (form.get("confirm") !== "on") return { error: "Tick the box to confirm who it goes to." };
  const n = await countAudience(b);
  if (!n) return { error: "Nobody is in this audience yet." };
  const { count } = await db.broadcast.updateMany({ where: { id: b.id, status: "DRAFT", updatedAt: b.updatedAt }, data: { status: "SCHEDULED", scheduledAt: at } });
  if (!count) return { error: "This email isn't a draft any more." };
  await logStaff(staff.id, now ? "broadcast.send" : "broadcast.schedule", `broadcast:${b.id}`,
    `${audienceDetail(b, n)}${now ? "" : `, at ${at.toISOString()}`}`);
  if (now) after(() => deliverBroadcasts().catch((e) => console.error("[broadcast] first batch failed", b.id, e)));
  refresh();
  return { ok: now ? "Sending. It goes out in batches over the next few minutes." : "Scheduled." };
}

/** A scheduled email back to draft, to edit it or change the time. */
export async function unscheduleBroadcast(form: FormData) {
  await consoleRequest();
  const staff = await requireStaff();
  const id = String(form.get("id") ?? "");
  const { count } = await db.broadcast.updateMany({ where: { id, status: "SCHEDULED" }, data: { status: "DRAFT", scheduledAt: null } });
  if (count) await logStaff(staff.id, "broadcast.unschedule", `broadcast:${id}`);
  refresh();
}

/** Stops a scheduled or sending email: anyone not sent to yet doesn't get it. */
export async function cancelBroadcast(form: FormData) {
  await consoleRequest();
  const staff = await requireStaff();
  const id = String(form.get("id") ?? "");
  const was = await cancel(id);
  if (was) await logStaff(staff.id, "broadcast.cancel", `broadcast:${id}`, `${was} → CANCELLED`);
  refresh();
}

/** Only a draft: once anything was sent, its record (and its unsubscribe links) stay. */
export async function deleteBroadcast(form: FormData) {
  await consoleRequest();
  const staff = await requireStaff();
  const id = String(form.get("id") ?? "");
  const { count } = await db.broadcast.deleteMany({ where: { id, status: "DRAFT" } });
  if (count) await logStaff(staff.id, "broadcast.delete", `broadcast:${id}`);
  redirect("/broadcasts");
}

export type AiDraftResult = { subject: string; body: string; placeholders: boolean; provider: string } | { error: string };

/**
 * "Write with AI": a subject and message drafted from what staff describe, to put in the form. Nothing is saved or
 * sent here. Each request is logged (with the start of the brief) and rate limited, since each one is paid for.
 */
export async function draftBroadcastWithAi(input: AiDraftInput): Promise<AiDraftResult> {
  await consoleRequest();
  const staff = await requireStaff();
  if ((await hit(`ai:staff:${staff.id}`, LIMITS.aiDraftStaff)).limited) return { error: "That's a lot of drafts this hour. Wait a while, or write this one yourself." };
  try {
    const draft = await draftBroadcast(input);
    await logStaff(staff.id, "broadcast.ai_draft", undefined, `${draft.provider}: ${String(input.brief ?? "").slice(0, 200)}`);
    return draft;
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0].message };
    throw e;
  }
}

/* Parent care (docs/features/parent-care.md › Admin). Pausing and bulk retries need the confirmation box. */

/** Pauses or resumes an automation. Pausing cancels its pending jobs: nothing queued goes out while it's paused. */
export async function setCareAutomation(_: FormState, form: FormData): Promise<FormState> {
  await consoleRequest();
  const staff = await requireStaff();
  const key = String(form.get("key") ?? "");
  const enable = form.get("enabled") === "true";
  if (!automationByKey(key)) return { error: "Unknown automation." };
  if (form.get("confirm") !== "on") return { error: enable ? "Tick the box to confirm resuming it." : "Tick the box to confirm pausing it." };
  const { count } = await db.parentCareAutomation.updateMany({ where: { key, enabled: !enable }, data: { enabled: enable, updatedBy: staff.name } });
  if (!count) return { ok: enable ? "It's already running." : "It's already paused." };
  const cancelled = enable ? 0 : (await db.parentCareJob.updateMany({ where: { automationKey: key, status: "PENDING" }, data: { status: "CANCELLED", lastError: "automation_paused", processedAt: new Date() } })).count;
  await logStaff(staff.id, enable ? "care.automation.resume" : "care.automation.pause", `care:${key}`, enable ? undefined : `${cancelled} pending jobs cancelled`);
  refresh();
  return { ok: enable ? "Resumed. Messages are planned again within a few hours." : `Paused. ${cancelled} pending ${cancelled === 1 ? "message was" : "messages were"} cancelled.` };
}

/**
 * Tries failed jobs again: one (`id`), or every job given up in the last 7 days (`all`, optionally one automation's).
 * Safe: a job whose message may already have reached the provider is never re-sent (lib/parent-care/runner), and
 * eligibility is checked again, so an opted-out parent gets nothing.
 */
export async function retryCareJobs(_: FormState, form: FormData): Promise<FormState> {
  await consoleRequest();
  const staff = await requireStaff();
  const id = String(form.get("id") ?? "");
  const automation = String(form.get("automation") ?? "");
  if (!id && form.get("confirm") !== "on") return { error: "Tick the box to confirm retrying them all." };
  const where = id ? { id, status: "DEAD" } : { status: "DEAD", processedAt: { gte: new Date(Date.now() - 7 * 864e5) }, ...(automation ? { automationKey: automation } : {}) };
  const { count } = await db.parentCareJob.updateMany({ where, data: { status: "PENDING", attempts: 0, runAt: new Date(), lockedAt: null, lastError: "retried_by_staff" } });
  if (!count) return { error: id ? "That job isn't failed any more." : "No failed jobs from the last 7 days to retry." };
  await logStaff(staff.id, id ? "care.job.retry" : "care.job.retry_all", id ? `care-job:${id}` : `care:${automation || "all"}`, `${count} jobs`);
  refresh();
  return { ok: `${count} ${count === 1 ? "job" : "jobs"} queued again. The next maintenance run (within 10 minutes) delivers ${count === 1 ? "it" : "them"}.` };
}
