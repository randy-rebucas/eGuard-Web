"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { isConsoleHost } from "@/lib/console-host";
import { authenticateStaff, endStaffSession, logStaff, requireStaff, startStaffSession } from "@/lib/staff-auth";
import { clientIpFrom } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import { isTicketStatus } from "@/lib/console-queries";
import type { FormState } from "./auth";

/**
 * The staff console's actions (docs/console.md). Server actions can be posted to any page of the app, so each one
 * first checks it was sent to the console host: the staff cookie only exists there anyway, but signing in mustn't
 * leave one on www.
 */
async function consoleRequest() {
  const h = await headers();
  if (!isConsoleHost(h.get("host"))) throw new ServiceError(404, "Not found.", "not_found");
  return h;
}

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  code: z.string().trim().min(1, "Enter the code from your authenticator app."),
});

export async function consoleLogin(_: FormState, form: FormData): Promise<FormState> {
  const h = await consoleRequest();
  const email = String(form.get("email") ?? "");
  const parsed = LoginSchema.safeParse({ email, password: form.get("password"), code: form.get("code") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { email } };
  try {
    const staff = await authenticateStaff(parsed.data.email, parsed.data.password, parsed.data.code, clientIpFrom(h));
    await startStaffSession(staff.id);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message, fields: { email } };
    throw e;
  }
  redirect("/");
}

export async function consoleLogout() {
  await consoleRequest();
  await endStaffSession();
  redirect("/login");
}

export async function setTicketStatus(form: FormData) {
  await consoleRequest();
  const staff = await requireStaff();
  const id = String(form.get("id") ?? ""), status = form.get("status");
  if (!id || !isTicketStatus(status)) throw new ServiceError(400, "Choose a status.", "invalid");
  const t = await db.supportTicket.findUnique({ where: { id }, select: { status: true } });
  if (!t) throw new ServiceError(404, "Ticket not found.", "not_found");
  // Only from the state just read, so two staff (or a double click) closing at once log one change, not two
  if (t.status !== status && (await db.supportTicket.updateMany({ where: { id, status: t.status }, data: { status } })).count) {
    await logStaff(staff.id, "ticket.status", `ticket:${id}`, `${t.status} → ${status}`);
  }
  refresh();
}
