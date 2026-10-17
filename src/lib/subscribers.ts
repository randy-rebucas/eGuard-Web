import "server-only";
import { z } from "zod";
import { db } from "./db";
import { newToken, sha256 } from "./auth";
import { appUrl } from "./email-verification";
import { escapeHtml, sendMail } from "./mail";

/**
 * The public mailing lists: eGuard news (the site's footer) and a note when the iPhone app is out (/iphone).
 * Anyone can sign up, with or without an account. Double opt-in: the confirmation email's link must be pressed
 * before anything else is sent, so nobody can sign someone else up. Unconfirmed sign-ups are deleted after
 * CONFIRM_DAYS (maintenance › data retention); unsubscribing deletes the row. Staff send to a list from
 * console › Email (lib/broadcasts, audience NEWSLETTER or IOS_LAUNCH).
 */

export const LISTS = ["NEWSLETTER", "IOS_LAUNCH"] as const;
export type MailingList = (typeof LISTS)[number];
export const isMailingList = (v: unknown): v is MailingList => LISTS.includes(v as MailingList);

/** What each list is, in the words the sign-up form, the confirmation email and the console use. */
export const LIST_COPY: Record<MailingList, { name: string; promise: string; why: string }> = {
  NEWSLETTER: {
    name: "eGuard news",
    promise: "occasional news from eGuard: new protections, guides and offers. About once a month at most",
    why: "You get this because you signed up for eGuard news at eguard.family.",
  },
  IOS_LAUNCH: {
    name: "iPhone launch",
    promise: "one email when eGuard for iPhone and iPad is out, and a few about getting it set up",
    why: "You get this because you asked to hear when eGuard for iPhone is out.",
  },
};

/** How long a confirmation link works, and how long an unconfirmed sign-up is kept */
export const CONFIRM_DAYS = 7;
/** A new confirmation email for the same address at most this often (the form says "check your inbox" anyway) */
const RESEND_SECONDS = 60;

export const SubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Enter your email address.").email("Enter a valid email address.").max(254, "Enter a valid email address."),
  list: z.enum(LISTS),
  source: z.string().trim().max(40).default("site"),
});

export const confirmPage = (token: string) => `${appUrl()}/subscribe/confirm?t=${encodeURIComponent(token)}`;

/** The confirmation email. Pure, so it can be tested without a database. */
export function confirmEmail(list: MailingList, token: string) {
  const { name, promise } = LIST_COPY[list];
  const url = confirmPage(token);
  const text = `Hi,\n\nPlease confirm you'd like ${promise}.\n\nConfirm: ${url}\n\nThe link works for ${CONFIRM_DAYS} days. If you didn't ask for this, ignore this email: we won't send you anything else, and we'll delete your address after ${CONFIRM_DAYS} days.\n\n— The eGuard team`;
  const html = `<p>Hi,</p><p>Please confirm you'd like ${escapeHtml(promise)}.</p>`
    + `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#1a73e8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Confirm my email</a></p>`
    + `<p style="color:#555;font-size:13px">The link works for ${CONFIRM_DAYS} days. If you didn't ask for this, ignore this email: we won't send you anything else, and we'll delete your address after ${CONFIRM_DAYS} days.</p>`
    + `<p>— The eGuard team</p>`;
  return { subject: `Confirm your email for ${name === "eGuard news" ? name : `eGuard's ${name} email`}`, text, html };
}

/**
 * Adds the address to a list. Always looks the same from outside (the caller says "check your inbox"), so the form
 * can't be used to find out who's subscribed:
 * - new address: stored unconfirmed, confirmation email sent;
 * - unconfirmed: the list is added, and a new link sent unless one went out in the last minute;
 * - confirmed: the list is added, and nothing is sent (they already said yes to email from us).
 * Returns what happened, for tests and logs only.
 */
export async function subscribe(input: { email: string; list: MailingList; source: string }, now = new Date()) {
  const { email, list, source } = input;
  const existing = await db.subscriber.findUnique({ where: { email } });
  if (existing?.confirmedAt) {
    if (!existing.lists.includes(list)) await db.subscriber.update({ where: { id: existing.id }, data: { lists: { push: list }, source } });
    return "already-confirmed" as const;
  }
  if (existing && now.getTime() - existing.confirmSentAt.getTime() < RESEND_SECONDS * 1000) {
    if (!existing.lists.includes(list)) await db.subscriber.update({ where: { id: existing.id }, data: { lists: { push: list } } });
    return "throttled" as const;
  }
  const token = newToken();
  const data = { confirmTokenHash: sha256(token), confirmSentAt: now, source };
  if (existing) {
    await db.subscriber.update({ where: { id: existing.id }, data: { ...data, lists: existing.lists.includes(list) ? existing.lists : [...existing.lists, list] } });
  } else {
    // A race with another sign-up for the same address loses quietly: that one sent the link
    await db.subscriber.create({ data: { ...data, email, lists: [list] } }).catch((e) => { if (e?.code !== "P2002") throw e; });
  }
  await sendMail({ to: email, ...confirmEmail(list, token) });
  return "sent" as const;
}

/** The confirmation link's button. Single use; a link older than CONFIRM_DAYS no longer works. */
export async function confirmSubscription(token: string, now = new Date()): Promise<{ lists: MailingList[] } | null> {
  if (!token || token.length > 100) return null;
  const s = await db.subscriber.findUnique({ where: { confirmTokenHash: sha256(token) } });
  if (!s || s.confirmSentAt.getTime() < now.getTime() - CONFIRM_DAYS * 864e5) return null;
  // Conditional, so two presses at once confirm it once
  const { count } = await db.subscriber.updateMany({ where: { id: s.id, confirmTokenHash: s.confirmTokenHash }, data: { confirmedAt: now, confirmTokenHash: null } });
  return count ? { lists: s.lists.filter(isMailingList) } : null;
}

/** Unsubscribing from any list email: the address is deleted outright, with every list it was on. */
export const deleteSubscriber = (id: string) => db.subscriber.deleteMany({ where: { id } });

/** Confirmed subscribers on a list: who a NEWSLETTER or IOS_LAUNCH broadcast goes to */
export const listWhere = (list: MailingList) => ({ confirmedAt: { not: null }, lists: { has: list } });

/** Confirmed and waiting counts per list, for the console */
export async function listCounts() {
  const counts = await Promise.all(LISTS.map(async (l) => [l, {
    confirmed: await db.subscriber.count({ where: listWhere(l) }),
    waiting: await db.subscriber.count({ where: { confirmedAt: null, lists: { has: l } } }),
  }] as const));
  return Object.fromEntries(counts) as Record<MailingList, { confirmed: number; waiting: number }>;
}
