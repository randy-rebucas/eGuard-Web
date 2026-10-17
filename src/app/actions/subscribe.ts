"use server";

import { headers } from "next/headers";
import { BOT_CHECK_FIELD, verifyHuman } from "@/lib/bot-check";
import { ServiceError } from "@/lib/errors";
import { LIMITS, clientIpFrom, hit, ipKey } from "@/lib/rate-limit";
import { SubscribeSchema, confirmSubscription, subscribe } from "@/lib/subscribers";

export type SubscribeState = { ok?: string; error?: string; email?: string } | undefined;

/**
 * The mailing-list forms (footer: eGuard news; /iphone: the launch list). The answer is the same whether or not the
 * address was already on a list, so the form can't be used to find out who's subscribed.
 */
export async function subscribeAction(_: SubscribeState, form: FormData): Promise<SubscribeState> {
  const parsed = SubscribeSchema.safeParse({ email: form.get("email"), list: form.get("list"), source: form.get("source") ?? undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email: String(form.get("email") ?? "") };
  const { email } = parsed.data;
  const ip = clientIpFrom(await headers());
  if ((await hit(ipKey("subscribe", ip), LIMITS.subscribeIp)).limited) return { error: "Too many sign-ups from here. Try again later.", email };
  try {
    await verifyHuman(form.get(BOT_CHECK_FIELD), ip, "subscribe");
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message, email };
    throw e;
  }
  // Over the per-address limit, say the same as success: the earlier emails already have a working link
  if (!(await hit(`subscribe:mail:${email}`, LIMITS.subscribeMail)).limited) {
    try {
      await subscribe(parsed.data);
    } catch (e) {
      console.error("[subscribe] failed", e);
      return { error: "We couldn't send the confirmation email just now. Try again in a few minutes.", email };
    }
  }
  return { ok: `Thanks! Check ${email} for a link to confirm (look in spam if it isn't there in a few minutes). If you've confirmed before, you're all set.` };
}

export type ConfirmResult = "done" | "invalid" | "limited" | undefined;

/** The button on /subscribe/confirm. Nothing changes until it's pressed, so a mail scanner opening the link confirms nothing. */
export async function confirmAction(_: ConfirmResult, form: FormData): Promise<ConfirmResult> {
  if ((await hit(ipKey("token", clientIpFrom(await headers())), LIMITS.tokenIp)).limited) return "limited";
  return (await confirmSubscription(String(form.get("token") ?? ""))) ? "done" : "invalid";
}
