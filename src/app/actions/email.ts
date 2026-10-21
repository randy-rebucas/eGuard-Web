"use server";

import { headers } from "next/headers";
import { unsubscribeByToken } from "@/lib/broadcasts";
import { LIMITS, clientIpFrom, hit, ipKey } from "@/lib/rate-limit";

export type UnsubscribeResult = "done" | "list" | "care" | "invalid" | "limited";

/** The button on /unsubscribe: turns product-update emails off for the parent the link was sent to, or deletes a mailing-list subscriber. */
export async function unsubscribe(_: UnsubscribeResult | undefined, form: FormData): Promise<UnsubscribeResult> {
  if ((await hit(ipKey("token", clientIpFrom(await headers())), LIMITS.tokenIp)).limited) return "limited";
  return unsubscribeByToken(String(form.get("token") ?? ""));
}
