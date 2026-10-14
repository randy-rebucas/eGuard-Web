import "server-only";
import { after } from "next/server";
import { appUrl } from "./email-verification";
import { escapeHtml, sendMail } from "./mail";
import { supportEmail } from "./support";

/**
 * "Your eGuard email was changed" and the like, sent to the account's owner when its sign-in changes. With a stolen
 * session and the password, someone could otherwise move the account to their own address unseen: the email change
 * notice goes to the old address, which the thief doesn't control.
 */
export type SecurityChange =
  | { kind: "email"; newEmail: string }
  | { kind: "password" }
  | { kind: "two_factor_off" };

const WHAT: Record<SecurityChange["kind"], { subject: string; did: string }> = {
  email: { subject: "Your eGuard email was changed", did: "The email address for your eGuard account was changed" },
  password: { subject: "Your eGuard password was changed", did: "The password for your eGuard account was changed, and your other sessions were signed out" },
  two_factor_off: { subject: "Two-step verification was turned off", did: "Two-step verification was turned off for your eGuard account" },
};

export function securityNoticeEmail(change: SecurityChange, firstName: string) {
  const w = WHAT[change.kind];
  const detail = change.kind === "email" ? ` to ${change.newEmail}` : "";
  const reset = `${appUrl()}/forgot-password`;
  const help = `If this was you, there's nothing to do. If it wasn't, reset your password now (${reset}) and write to ${supportEmail()}.`;
  return {
    subject: w.subject,
    text: `Hi ${firstName},\n\n${w.did}${detail}.\n\n${help}\n\n— eGuard`,
    html: `<p>Hi ${escapeHtml(firstName)},</p><p>${escapeHtml(w.did + detail)}.</p>`
      + `<p>If this was you, there's nothing to do. If it wasn't, <a href="${reset}">reset your password now</a> and write to ${escapeHtml(supportEmail())}.</p>`,
  };
}

/**
 * Sent after the response, and never fails the change it reports: the change is already made, and a mail outage
 * mustn't undo it or show the parent an error.
 */
export function sendSecurityNotice(to: string, name: string, change: SecurityChange) {
  const send = async () => {
    try {
      await sendMail({ to, ...securityNoticeEmail(change, name.split(/\s+/)[0]) });
    } catch (e) {
      console.error("[mail] security notice failed", change.kind, e);
    }
  };
  // Outside a request (scripts, tests) there's no after(): send straight away
  try { after(send); } catch { void send(); }
}
