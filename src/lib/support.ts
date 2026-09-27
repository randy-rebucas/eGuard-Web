import "server-only";
import type { SupportTicket } from "@prisma/client";
import { escapeHtml, sendMail } from "./mail";

/** Where parents' support requests go, and the address the apps show. Set SUPPORT_EMAIL in production. */
export const supportEmail = () => process.env.SUPPORT_EMAIL?.trim() || "support@eguard.app";

/** Forwards a new ticket to the support inbox, with Reply-To set to the parent. */
export async function forwardTicket(t: SupportTicket, from: { name: string; email: string; familyId: string }) {
  await sendMail({
    to: supportEmail(),
    replyTo: `${from.name} <${from.email}>`,
    subject: `[eGuard ${t.category}] ${t.subject}`,
    text: `From: ${from.name} <${from.email}>\nFamily: ${from.familyId}\nTicket: ${t.id}\nCategory: ${t.category}\n\n${t.message}`,
    html: `<p><b>From:</b> ${escapeHtml(from.name)} &lt;${escapeHtml(from.email)}&gt;<br><b>Family:</b> ${escapeHtml(from.familyId)}<br><b>Ticket:</b> ${escapeHtml(t.id)}<br><b>Category:</b> ${escapeHtml(t.category)}</p>`
      + `<pre style="white-space:pre-wrap;font:inherit">${escapeHtml(t.message)}</pre>`,
  });
}
