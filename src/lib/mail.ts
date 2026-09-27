import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/** Outgoing email over SMTP_URL (see .env.example). In dev, the Mailpit container catches it. */

let transport: Transporter | null | undefined;
function transporter() {
  if (transport === undefined) transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  return transport;
}

export type Mail = { to: string; subject: string; text: string; html: string; replyTo?: string };

/** Sends an email. Without SMTP_URL, dev prints it to the server log; production refuses. */
export async function sendMail(mail: Mail) {
  const t = transporter();
  if (!t) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP_URL is not set, so eGuard can't send email.");
    console.info(`[mail] SMTP_URL not set. To ${mail.to}: ${mail.subject}\n${mail.text}`);
    return;
  }
  await t.sendMail({ from: process.env.MAIL_FROM || "eGuard <no-reply@eguard.app>", ...mail });
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
