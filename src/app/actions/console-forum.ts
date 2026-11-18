"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { ZodError } from "zod";
import { isConsoleHost } from "@/lib/console-host";
import { logStaff, requireStaff } from "@/lib/staff-auth";
import { ServiceError } from "@/lib/errors";
import { MOD_OPS, moderate, muteMember, postAnnouncement, staffReply, type ModOp } from "@/lib/forum";
import type { FormState } from "./auth";

/**
 * Console › Community (lib/forum): reports, hiding and pinning posts, muting members, and the eGuard team's own
 * posts. Every decision is in the staff audit log.
 */
async function consoleRequest() {
  const h = await headers();
  if (!isConsoleHost(h.get("host"))) throw new ServiceError(404, "Not found.", "not_found");
  return requireStaff();
}

const str = (form: FormData, k: string) => String(form.get(k) ?? "");

async function run(fn: () => Promise<string>): Promise<FormState> {
  try {
    const ok = await fn();
    refresh();
    return { ok };
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    if (e instanceof ZodError) return { error: e.issues[0]?.message ?? "Check the details." };
    throw e;
  }
}

const DONE: Record<ModOp, string> = {
  hide: "Hidden. The author was told.", unhide: "Visible again.", delete: "Deleted. The author was told.", dismiss: "Reports dismissed.",
  pin: "Pinned.", unpin: "Unpinned.", lock: "Closed to replies.", unlock: "Open to replies again.",
};

export async function moderateAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await consoleRequest();
  const kind = str(form, "kind"), id = str(form, "id"), op = str(form, "op") as ModOp;
  return run(async () => {
    if (!MOD_OPS.includes(op)) throw new ServiceError(400, "Unknown action.", "invalid");
    const target = kind === "post" ? { postId: id } : { threadId: id };
    await moderate(staff.id, target, op);
    await logStaff(staff.id, `community.${op}`, `${kind === "post" ? "forum_post" : "forum_thread"}:${id}`);
    return DONE[op];
  });
}

export async function muteAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await consoleRequest();
  const userId = str(form, "userId"), days = Number(str(form, "days"));
  return run(async () => {
    await muteMember(userId, days);
    await logStaff(staff.id, days ? "community.mute" : "community.unmute", `user:${userId}`, days ? `${days} days` : undefined);
    return days ? `Muted for ${days} days.` : "Unmuted.";
  });
}

export async function announceAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await consoleRequest();
  return run(async () => {
    const t = await postAnnouncement(staff.id, { title: str(form, "title"), body: str(form, "body"), category: str(form, "category"), pinned: form.get("pinned") === "on" });
    await logStaff(staff.id, "community.announce", `forum_thread:${t.id}`);
    return "Posted as the eGuard team.";
  });
}

export async function staffReplyAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await consoleRequest();
  const threadId = str(form, "threadId");
  return run(async () => {
    const p = await staffReply(staff.id, threadId, str(form, "body"));
    await logStaff(staff.id, "community.reply", `forum_post:${p.id}`);
    return "Replied as the eGuard team.";
  });
}
