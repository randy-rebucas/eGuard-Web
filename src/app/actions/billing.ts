"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/errors";
import * as web from "@/lib/web-billing";

const PaidPlan = z.enum(["PLUS", "PRO"]);

/** Settings › Subscription › Pay once (one month): off to PayMongo's hosted checkout. */
export async function buyPass(plan: string): Promise<{ error: string }> {
  const u = await requireUser();
  let url: string;
  try {
    url = (await web.buyPass(u, PaidPlan.parse(plan))).checkoutUrl;
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  redirect(url);
}

/** Settings › Subscription › Auto-renew (monthly): what the browser needs to send the first payment to PayMongo. */
export async function startAutoRenew(plan: string): Promise<{ error: string } | { payment: web.FirstPayment }> {
  const u = await requireUser();
  try {
    return { payment: await web.startAutoRenew(u, PaidPlan.parse(plan)) };
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
