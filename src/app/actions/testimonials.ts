"use server";

import { headers } from "next/headers";
import { updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/errors";
import { LIMITS, clientIpFrom, hit, ipKey } from "@/lib/rate-limit";
import { PROOF_TAG, answerConsent, withdrawOwn } from "@/lib/testimonials";

export type ConsentResult = { done?: "agreed" | "declined" | "withdrawn"; error?: string } | undefined;

/** The buttons on /testimonials/consent/[token]: the emailed token alone says whose quote it is */
export async function answerTestimonial(_: ConsentResult, form: FormData): Promise<ConsentResult> {
  if ((await hit(ipKey("token", clientIpFrom(await headers())), LIMITS.tokenIp)).limited) return { error: "Too many tries. Wait a few minutes and try again." };
  const decision = String(form.get("decision") ?? "");
  if (decision !== "agree" && decision !== "decline" && decision !== "withdraw") return { error: "Choose an answer." };
  if (decision === "agree" && form.get("confirm") !== "on") return { error: "Tick the box to agree." };
  try {
    const r = await answerConsent(String(form.get("token") ?? ""), { decision, displayName: String(form.get("displayName") ?? "") });
    if (r.siteChanged) updateTag(PROOF_TAG);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  return { done: decision === "agree" ? "agreed" : decision === "decline" ? "declined" : "withdrawn" };
}

/** Settings › Privacy › "Your words on eguard.family": take one back */
export async function withdrawTestimonial(id: string) {
  const user = await requireUser();
  const r = await withdrawOwn(user.id, id);
  // Off the site at once, not after the hourly refresh
  if (r.siteChanged) updateTag(PROOF_TAG);
}
