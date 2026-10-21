"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { invalid, toResult, type Result } from "@/lib/errors";
import { LIMITS, enforce } from "@/lib/rate-limit";
import * as care from "@/lib/parent-care/service";

/** Parent care on the web (docs/features/parent-care.md): the same service the mobile API uses. */

/** Settings › Notifications › Tips and reminders */
export async function saveCarePreferences(input: care.CarePrefsInput): Promise<Result> {
  const u = await requireUser();
  return toResult(async () => {
    await enforce(`care:${u.id}`, LIMITS.careUser);
    await care.updateCarePreferences(u, input);
    revalidatePath("/settings/notifications");
    revalidatePath("/plan", "layout");
    return {};
  });
}

export type ActivityAction = "start" | "complete" | "dismiss" | "restore";

export async function activityAction(key: string, action: ActivityAction): Promise<Result> {
  const u = await requireUser();
  return toResult(async () => {
    await enforce(`care:${u.id}`, LIMITS.careUser);
    const run = { start: care.startActivity, complete: care.completeActivity, dismiss: care.dismissActivity, restore: care.restoreActivity }[action];
    if (!run || typeof key !== "string" || key.length > 64) throw invalid("Choose an activity and what to do with it.");
    await run(u, key);
    revalidatePath("/plan", "layout");
    return {};
  });
}

/** A message tapped or dismissed on the Safety plan. Tapping answers where it goes. */
export async function messageAction(id: string, action: "click" | "dismiss"): Promise<Result<{ link: string }>> {
  const u = await requireUser();
  return toResult(async () => {
    await enforce(`care:${u.id}`, LIMITS.careUser);
    const r = await care.markMessage(u, String(id).slice(0, 64), action === "click" ? "click" : "dismiss");
    if (action === "dismiss") revalidatePath("/plan");
    return { link: r.link };
  });
}
