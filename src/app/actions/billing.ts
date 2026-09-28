"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/errors";
import * as web from "@/lib/web-billing";

const Interval = z.enum(["month", "year"]);

/** Settings › Subscription › Pay once: off to PayMongo's hosted checkout. */
export async function buyPass(interval: string): Promise<{ error: string }> {
  const u = await requireUser();
  let url: string;
  try {
    url = (await web.buyPass(u, Interval.parse(interval))).checkoutUrl;
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  redirect(url);
}

/** Settings › Subscription › Auto-renew: what the browser needs to send the first payment to PayMongo. */
export async function startAutoRenew(interval: string): Promise<{ error: string } | { payment: web.FirstPayment }> {
  const u = await requireUser();
  try {
    return { payment: await web.startAutoRenew(u, Interval.parse(interval)) };
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
