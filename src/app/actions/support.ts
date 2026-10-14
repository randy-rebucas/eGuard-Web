"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/errors";
import { TicketSchema, createTicket } from "@/lib/support";
import type { FormState } from "./auth";

/** Settings › Support › Contact support: the same request the mobile app's Contact Support sends. */
export async function submitTicket(_: FormState, form: FormData): Promise<FormState> {
  const parsed = TicketSchema.safeParse({ category: form.get("category") || undefined, subject: form.get("subject"), message: form.get("message") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await createTicket(await requireUser(), parsed.data);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/settings/support");
  return { ok: "Thanks, we got your request. We'll reply by email within one business day." };
}
