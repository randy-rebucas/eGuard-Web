"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { isConsoleHost } from "@/lib/console-host";
import { logStaff, requireStaff } from "@/lib/staff-auth";
import { LIMITS, hit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import { approveAndPost, saveDraft } from "@/lib/store-reviews/post";
import { readReview, syncStore } from "@/lib/store-reviews/sync";
import { STORE_LABEL, isStore } from "@/lib/store-reviews/types";
import type { FormState } from "./auth";

/**
 * Console › Store reviews (docs/console.md › Store reviews). Like every console action, each first checks it was sent
 * to the console host, then for a staff session. Nothing reaches a store without "Approve & post".
 */
async function consoleRequest() {
  const h = await headers();
  if (!isConsoleHost(h.get("host"))) throw new ServiceError(404, "Not found.", "not_found");
}

const id = (form: FormData) => String(form.get("id") ?? "");
const text = (form: FormData) => String(form.get("text") ?? "");
const message = (e: unknown) => (e instanceof ServiceError ? e.message : null);

/** Saves the reply as a draft, or (intent=post, confirm ticked) approves it and posts it to the store */
export async function replyToReview(_: FormState, form: FormData): Promise<FormState> {
  await consoleRequest();
  const staff = await requireStaff();
  const reviewId = id(form);
  const post = form.get("intent") === "post";
  const echo = { text: text(form) };
  if (post && form.get("confirm") !== "on") return { error: "Tick the box to confirm it goes public on the store.", fields: echo };
  try {
    if (post) {
      await approveAndPost(reviewId, text(form), staff.id);
      refresh();
      return { ok: "Posted. It can take a few minutes to show on the store." };
    }
    await saveDraft(reviewId, text(form), staff.id);
    await logStaff(staff.id, "review.reply.save", `review:${reviewId}`);
    refresh();
    return { ok: "Draft saved." };
  } catch (e) {
    const m = message(e);
    if (!m) throw e;
    refresh();
    return { error: m, fields: echo };
  }
}

/** A fresh AI reading and draft, optionally following staff's instruction ("shorter", "in Filipino") */
export async function regenerateReviewReply(_: FormState, form: FormData): Promise<FormState> {
  await consoleRequest();
  const staff = await requireStaff();
  if ((await hit(`ai:staff:${staff.id}`, LIMITS.aiDraftStaff)).limited) return { error: "That's a lot of drafts this hour. Wait a while, or write this one yourself." };
  const reviewId = id(form);
  const instruction = String(form.get("instruction") ?? "").trim().slice(0, 500);
  try {
    const done = await readReview(reviewId, { instruction, draft: "always", staffId: staff.id });
    if (!done) return { error: "The reviewer changed their review while the AI was reading it. Try again." };
    await logStaff(staff.id, "review.ai_draft", `review:${reviewId}`, instruction.slice(0, 200) || undefined);
  } catch (e) {
    const m = message(e);
    if (!m) throw e;
    return { error: m };
  }
  refresh();
  return { ok: "New draft ready." };
}

/** Ignore a review (spam, nothing to answer), or bring it back */
export async function setReviewIgnored(form: FormData) {
  await consoleRequest();
  const staff = await requireStaff();
  const reviewId = id(form);
  const ignore = form.get("ignore") === "true";
  const r = await db.storeReview.findUnique({ where: { id: reviewId }, select: { status: true, storeReplyText: true } });
  if (!r || r.status === "POSTING") return;
  const back = r.storeReplyText ? "REPLIED" : "NEW";
  const { count } = await db.storeReview.updateMany({
    where: { id: reviewId, status: ignore ? { notIn: ["IGNORED", "POSTING"] } : "IGNORED" },
    data: { status: ignore ? "IGNORED" : back, ...(ignore ? {} : { classifiedAt: null }) },
  });
  if (count) await logStaff(staff.id, ignore ? "review.ignore" : "review.unignore", `review:${reviewId}`);
  refresh();
}

/** Links a review to a support ticket (a reviewer who also wrote in), or unlinks it */
export async function linkReviewTicket(_: FormState, form: FormData): Promise<FormState> {
  await consoleRequest();
  const staff = await requireStaff();
  const reviewId = id(form);
  const ticketId = String(form.get("ticketId") ?? "").trim();
  if (ticketId && !(await db.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true } }))) return { error: "No ticket has that id." };
  await db.storeReview.update({ where: { id: reviewId }, data: { ticketId: ticketId || null } });
  await logStaff(staff.id, "review.ticket", `review:${reviewId}`, ticketId || "unlinked");
  refresh();
  return { ok: ticketId ? "Linked." : "Unlinked." };
}

/** Reads a store's reviews now, whatever the interval */
export async function syncReviewsNow(_: FormState, form: FormData): Promise<FormState> {
  await consoleRequest();
  const staff = await requireStaff();
  const store = form.get("store");
  if (!isStore(store)) return { error: "Choose a store." };
  if ((await hit(`reviews:sync:${store}`, { max: 6, windowMs: 60 * 60_000 })).limited) return { error: "Synced several times this hour already. Try again later." };
  try {
    const res = await syncStore(store, new Date(), { force: true });
    await logStaff(staff.id, "review.sync", undefined, STORE_LABEL[store]);
    refresh();
    if ("skipped" in res) return { error: res.skipped === "not_configured" ? `${STORE_LABEL[store]} isn't set up on this server.` : "A sync is running already." };
    return { ok: `${STORE_LABEL[store]}: ${res.fetched} read, ${res.new} new, ${res.edited} edited.` };
  } catch (e) {
    refresh();
    return { error: message(e) ?? `${STORE_LABEL[store]} couldn't be read. Try again later.` };
  }
}

/* Console › Feedback (docs/features/feedback.md) */

const STAFF_FOLLOW_UPS = ["NEEDED", "CONTACTED", "RESOLVED", "NONE"] as const;

/** Marks what staff did about a parent's feedback. A ticket that was opened stays linked whatever the state. */
export async function setFeedbackFollowUp(form: FormData) {
  await consoleRequest();
  const staff = await requireStaff();
  const feedbackId = id(form);
  const to = String(form.get("followUp") ?? "");
  if (!(STAFF_FOLLOW_UPS as readonly string[]).includes(to)) return;
  const f = await db.feedback.findUnique({ where: { id: feedbackId }, select: { followUp: true } });
  if (!f || f.followUp === to) return;
  // From the state just read, so a double click logs one change
  if ((await db.feedback.updateMany({ where: { id: feedbackId, followUp: f.followUp }, data: { followUp: to } })).count) {
    await logStaff(staff.id, "feedback.follow_up", `feedback:${feedbackId}`, `${f.followUp} → ${to}`);
  }
  refresh();
}
