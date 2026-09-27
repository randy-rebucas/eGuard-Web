import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing email over SMTP_URL (see .env.example), falling back to Resend (RESEND_API_KEY) if SMTP
 * isn't set or fails. In dev, the Mailpit container catches SMTP mail.
 */

let transport: Transporter | null | undefined;
function transporter() {
  if (transport === undefined) transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  return transport;
}

export type Mail = { to: string; subject: string; text: string; html: string; replyTo?: string };

const mailFrom = () => process.env.MAIL_FROM || "eGuard <no-reply@eguard.app>";

/** Sends through Resend's HTTP API. RESEND_FROM must be on a domain verified in Resend (defaults to MAIL_FROM). */
async function sendWithResend(mail: Mail, apiKey: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || mailFrom(), to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend refused the email (${res.status}): ${(await res.text()).slice(0, 300)}`);
}

/** Sends an email: SMTP first, then Resend. With neither configured, dev prints it to the server log; production refuses. */
export async function sendMail(mail: Mail) {
  const t = transporter();
  const resendKey = process.env.RESEND_API_KEY;
  if (t) {
    try {
      await t.sendMail({ from: mailFrom(), ...mail });
      return;
    } catch (e) {
      if (!resendKey) throw e;
      console.error("[mail] SMTP failed, trying Resend", e);
    }
  }
  if (resendKey) return sendWithResend(mail, resendKey);
  if (process.env.NODE_ENV === "production") throw new Error("Neither SMTP_URL nor RESEND_API_KEY is set, so eGuard can't send email.");
  console.info(`[mail] No SMTP_URL or RESEND_API_KEY. To ${mail.to}: ${mail.subject}\n${mail.text}`);
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
