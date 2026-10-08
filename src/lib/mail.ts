import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing email (see .env.example).
 * - Production: Resend (RESEND_API_KEY). SMTP_URL is used only when there's no Resend key.
 * - Anywhere else (development, tests): always the Mailpit container (`npm run db:up`), at MAILPIT_SMTP_URL or
 *   smtp://127.0.0.1:1025. SMTP_URL and RESEND_API_KEY are ignored there, so a .env copied from production can't
 *   send real email from a laptop or a test run.
 */

const isProduction = () => process.env.NODE_ENV === "production";
const MAILPIT_SMTP = "smtp://127.0.0.1:1025";

let transport: { url: string; t: Transporter } | undefined;
function transporter(url: string) {
  if (transport?.url !== url) transport = { url, t: nodemailer.createTransport(url) };
  return transport.t;
}

export type Mail = { to: string; subject: string; text: string; html: string; replyTo?: string };

const mailFrom = () => process.env.MAIL_FROM || "eGuard <no-reply@eguard.family>";

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

/** Sends an email: Resend in production, Mailpit everywhere else. */
export async function sendMail(mail: Mail) {
  if (!isProduction()) {
    try {
      await transporter(process.env.MAILPIT_SMTP_URL?.trim() || MAILPIT_SMTP).sendMail({ from: mailFrom(), ...mail });
    } catch (e) {
      // Mailpit isn't running: show the email here rather than fail the sign-up or reset that sent it
      console.info(`[mail] Mailpit unreachable (${e instanceof Error ? e.message : e}); start it with npm run db:up. To ${mail.to}: ${mail.subject}\n${mail.text}`);
    }
    return;
  }
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    if (isReservedDomain(mail.to)) {
      console.info(`[mail] Not sent: ${mail.to} is on a reserved test domain, which Resend refuses. ${mail.subject}`);
      return;
    }
    return sendWithResend(mail, resendKey);
  }
  const smtp = process.env.SMTP_URL?.trim();
  if (smtp) return void (await transporter(smtp).sendMail({ from: mailFrom(), ...mail }));
  throw new Error("RESEND_API_KEY isn't set (nor SMTP_URL), so eGuard can't send email.");
}

/** RFC 2606 / 6761 names used by demo data and tests (example.com, *.test, …). Nobody can receive mail there. */
const isReservedDomain = (to: string) =>
  /@(?:[^@]*\.)?(?:example\.(?:com|net|org)|example|test|invalid|localhost)$/i.test(to.trim());

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
