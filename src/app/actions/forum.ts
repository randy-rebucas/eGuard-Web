"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { ServiceError, toResult } from "@/lib/errors";
import { ZodError } from "zod";
import {
  PRIVACY_CODE, createThread, deleteOwn, editOwn, markNoticesRead, reply, report, setFollow, setHandle, toggleVote,
  type ReportReason, type Target,
} from "@/lib/forum";
import type { FormState } from "./auth";

/** Community (lib/forum). Forms return FormState; buttons return Result for useAction's toast. */

const str = (form: FormData, k: string) => String(form.get(k) ?? "");

/**
 * Runs a form's service call. Errors keep what the parent typed; a privacy check adds `privacy: "1"`, so the form
 * shows "Post anyway" and sends `acknowledged` next time.
 */
async function formRun(fields: Record<string, string>, fn: () => Promise<string | void>): Promise<FormState> {
  try {
    const ok = await fn();
    refresh();
    return { ok: ok || "Saved." };
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message, fields: e.code === PRIVACY_CODE ? { ...fields, privacy: "1" } : fields };
    if (e instanceof ZodError) return { error: e.issues[0]?.message ?? "Check what you wrote and try again.", fields };
    throw e;
  }
}

const targetFrom = (kind: string, id: string): Target => (kind === "post" ? { postId: id } : { threadId: id });

/** First visit to post: a community name and the rules. Later: changing the name. */
export async function saveHandle(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const handle = str(form, "handle");
  return formRun({ handle }, async () => {
    const p = await setHandle(user, handle, form.get("rules") === "on");
    return `You're ${p.handle} in Community.`;
  });
}

export async function startThread(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const fields = { category: str(form, "category"), title: str(form, "title"), body: str(form, "body") };
  let id: string | undefined;
  const res = await formRun(fields, async () => {
    id = (await createThread(user, fields, { acknowledged: form.get("acknowledged") === "1" })).id;
  });
  if (id) redirect(`/community/t/${id}`);
  return res;
}

export async function postReply(threadId: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const body = str(form, "body");
  return formRun({ body }, async () => {
    await reply(user, threadId, body, { acknowledged: form.get("acknowledged") === "1" });
    return "Reply posted.";
  });
}

/** Edits a thread (`kind` thread: title and body) or a reply (`kind` post) */
export async function editPost(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const kind = str(form, "kind"), id = str(form, "id");
  const fields = { title: str(form, "title"), body: str(form, "body") };
  return formRun(fields, async () => {
    await editOwn(user, targetFrom(kind, id), { ...(kind === "thread" ? { title: fields.title } : {}), body: fields.body }, { acknowledged: form.get("acknowledged") === "1" });
    return "Saved.";
  });
}

export async function deletePost(kind: "thread" | "post", id: string) {
  const user = await requireUser();
  const res = await toResult(() => deleteOwn(user, targetFrom(kind, id)));
  if (!res.error) refresh();
  return res;
}

export async function voteHelpful(kind: "thread" | "post", id: string) {
  const user = await requireUser();
  const res = await toResult(() => toggleVote(user, targetFrom(kind, id)));
  if (!res.error) refresh();
  return res;
}

export async function reportPost(kind: "thread" | "post", id: string, reason: ReportReason, note: string) {
  const user = await requireUser();
  const res = await toResult(() => report(user, targetFrom(kind, id), { reason, note }));
  if ("hidden" in res && res.hidden) refresh();
  return res;
}

export async function followThread(threadId: string, follow: boolean) {
  const user = await requireUser();
  const res = await toResult(() => setFollow(user, threadId, follow));
  if (!res.error) refresh();
  return res;
}

/** Marks notices read: these ids, or all of them */
export async function readNotices(ids?: string[]) {
  const user = await requireUser();
  await markNoticesRead(user.id, ids?.slice(0, 100));
  refresh();
  return {};
}
