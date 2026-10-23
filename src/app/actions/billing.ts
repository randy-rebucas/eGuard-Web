"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/errors";
import * as web from "@/lib/web-billing";

const PaidPlan = z.enum(["PLUS", "PRO"]);
/** One month or one year; anything else is a month */
const period = (v: unknown) => (v === "year" ? "year" : "month") as "month" | "year";
const CHOOSE_PLAN = { error: "Choose eGuard Plus or Family Pro." };

/** Settings › Subscription › Pay once (one month or one year): off to PayMongo's hosted checkout. */
export async function buyPass(plan: string, interval?: string): Promise<{ error: string }> {
  const u = await requireUser();
  const p = PaidPlan.safeParse(plan);
  if (!p.success) return CHOOSE_PLAN;
  let url: string;
  try {
    url = (await web.buyPass(u, p.data, { interval: period(interval) })).checkoutUrl;
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  redirect(url);
}

/** Settings › Subscription › Auto-renew (monthly or yearly): what the browser needs to send the first payment to PayMongo. */
export async function startAutoRenew(plan: string, interval?: string): Promise<{ error: string } | { payment: web.FirstPayment }> {
  const u = await requireUser();
  const p = PaidPlan.safeParse(plan);
  if (!p.success) return CHOOSE_PLAN;
  try {
    return { payment: await web.startAutoRenew(u, p.data, { interval: period(interval) }) };
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
}

export async function cancelAutoRenew(): Promise<{ error?: string }> {
  const u = await requireUser();
  try {
    await web.cancelAutoRenew(u);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return {};
}
