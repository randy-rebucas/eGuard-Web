"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/errors";
import { FEEDBACK_KINDS, FeedbackSchema, npsEvent, submitFeedback, type FeedbackKind } from "@/lib/feedback";
import type { FormState } from "./auth";

/** Settings › Support › Send feedback: the same as the apps' "Send feedback" */
export async function sendFeedback(_: FormState, form: FormData): Promise<FormState> {
  const kind = String(form.get("kind") ?? "FEEDBACK");
  const input = {
    kind: (FEEDBACK_KINDS as readonly string[]).includes(kind) && kind !== "NPS" ? (kind as FeedbackKind) : "FEEDBACK",
    comment: String(form.get("comment") ?? ""),
    contactOk: form.get("contactOk") === "on",
    trigger: "settings" as const,
  };
  const parsed = FeedbackSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { comment: input.comment, kind: input.kind } };
  try {
    const res = await submitFeedback(await requireUser(), parsed.data, "WEB");
    if (res.ticketId) revalidatePath("/settings/support");
    return { ok: res.message };
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message, fields: { comment: input.comment, kind: input.kind } };
    throw e;
  }
}

export type NpsResult = { ok?: string; error?: string };

/** The dashboard's survey card: a score, and optionally what would make it better */
export async function answerNps(score: number, comment: string, contactOk: boolean): Promise<NpsResult> {
  const parsed = FeedbackSchema.safeParse({ kind: "NPS", score, comment, contactOk, trigger: "nps_survey" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const res = await submitFeedback(await requireUser(), parsed.data, "WEB");
    return { ok: res.message };
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
}

/** "Not now" on the survey card: it's not shown again for a while (lib/feedback NPS_RULES) */
export async function dismissNps() {
  await npsEvent(await requireUser(), "dismissed");
}
