import "server-only";
import { after } from "next/server";
import { z } from "zod";
import type { SupportTicket } from "@prisma/client";
import { db } from "./db";
import { escapeHtml, sendMail } from "./mail";
import { LIMITS, enforce } from "./rate-limit";

/** Where parents' support requests go, and the address the apps show. Set SUPPORT_EMAIL in production. */
export const supportEmail = () => process.env.SUPPORT_EMAIL?.trim() || "support@devcomdigital.com";

/** What a request is about, as the parent picks it (docs/mobile-api.md › Support) */
export const TICKET_CATEGORIES = { SETUP: "Setting up", DEVICE: "A child's device", BILLING: "Plans and billing", ACCOUNT: "My account", OTHER: "Something else" } as const;

export const TicketSchema = z.object({
  category: z.enum(Object.keys(TICKET_CATEGORIES) as [keyof typeof TICKET_CATEGORIES, ...(keyof typeof TICKET_CATEGORIES)[]]).default("OTHER"),
  subject: z.string().trim().min(3, "Add a short subject.").max(120),
  message: z.string().trim().min(10, "Tell us a little more so we can help.").max(5000),
});

/** A parent's new request, from the web app or the mobile API: saved, then forwarded to the support inbox. */
export async function createTicket(user: { id: string; name: string; email: string; familyId: string }, input: z.infer<typeof TicketSchema>) {
  await enforce(`support:${user.id}`, LIMITS.supportUser, "You've sent several requests. We'll reply to those first.");
  const t = await db.supportTicket.create({ data: { ...input, familyId: user.familyId, userId: user.id } });
  // The ticket is saved either way, so a mail hiccup isn't the parent's problem
  after(() => forwardTicket(t, user).catch((e) => console.error("[support] forwarding ticket failed", t.id, e)));
  return t;
}

/** This parent's requests, newest first. */
export const listTickets = (user: { id: string; familyId: string }) =>
  db.supportTicket.findMany({
    where: { familyId: user.familyId, userId: user.id }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, category: true, subject: true, message: true, status: true, createdAt: true },
  });

/**
 * Forwards a new ticket to the support inbox, with Reply-To set to the parent. The family's plan is in the subject:
 * paid plans are sold with priority (Plus) and top-priority (Pro) support, so the inbox has to show who comes first.
 */
export async function forwardTicket(t: SupportTicket, from: { name: string; email: string; familyId: string }) {
  const plan = (await db.family.findUnique({ where: { id: t.familyId }, select: { plan: true } }))?.plan ?? "unknown plan";
  await sendMail({
    to: supportEmail(),
    // The name is the parent's own text: quoted, so a comma or "<…>" in it can't add a second Reply-To address
    replyTo: `"${from.name.replace(/["\\\r\n<>]/g, "")}" <${from.email}>`,
    subject: `[eGuard ${t.category} · ${plan}] ${t.subject.replace(/[\r\n]+/g, " ")}`,
    text: `From: ${from.name} <${from.email}>\nFamily: ${from.familyId}\nPlan: ${plan}\nTicket: ${t.id}\nCategory: ${t.category}\n\n${t.message}`,
    html: `<p><b>From:</b> ${escapeHtml(from.name)} &lt;${escapeHtml(from.email)}&gt;<br><b>Family:</b> ${escapeHtml(from.familyId)}<br><b>Plan:</b> ${escapeHtml(plan)}<br><b>Ticket:</b> ${escapeHtml(t.id)}<br><b>Category:</b> ${escapeHtml(t.category)}</p>`
      + `<pre style="white-space:pre-wrap;font:inherit">${escapeHtml(t.message)}</pre>`,
  });
}
