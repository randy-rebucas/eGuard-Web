import "server-only";
import { revalidateTag } from "next/cache";
import { db } from "./db";
import { newToken, sha256 } from "./auth";
import { appUrl } from "./email-verification";
import { escapeHtml, sendMail } from "./mail";
import { conflict, invalid, notFound } from "./errors";

/**
 * Parents' words on eguard.family, only with their written consent (docs/marketing-site-review.md › Social proof).
 *
 *   PROPOSED ──send──▶ AWAITING_CONSENT ──agree──▶ CONSENTED ──publish──▶ PUBLISHED
 *                              │ decline                ▲ unpublish ◀──────┘
 *                              ▼                        │
 *                           DECLINED          any edit ─┴─▶ PROPOSED (consent again)
 *   the parent may withdraw at any time ──▶ WITHDRAWN (off the site at once)
 *
 * Staff propose a quote from what the parent wrote (Send feedback, the survey's comment); the parent is emailed the exact
 * quote and name, and agrees (perhaps under another name), or declines. The link keeps working afterwards to withdraw.
 * Store reviewers are anonymous and can't consent, so their reviews never become testimonials.
 */

/** Bump when CONSENT_TEXT changes: each consent records the version the parent saw */
export const CONSENT_VERSION = 1;
export const CONSENT_TEXT = "I agree that eGuard may show these words, under this name, on eguard.family and in eGuard's marketing. I can withdraw at any time from this page or by emailing eGuard, and they'll be removed.";
/** How long a consent request can be answered */
export const CONSENT_DAYS = 30;
/** Withdrawn or declined quotes are erased this long after, keeping only that it was handled */
export const TESTIMONIAL_ERASE_DAYS = 30;
/** The cache tag of everything the public site shows from here (lib/social-proof-data) */
export const PROOF_TAG = "social-proof";

export const STATUSES = ["PROPOSED", "AWAITING_CONSENT", "CONSENTED", "PUBLISHED", "WITHDRAWN", "DECLINED"] as const;
export type TestimonialStatus = (typeof STATUSES)[number];

const MAX_QUOTE = 400;
const MAX_NAME = 60;

export const quoteHash = (quote: string, name: string) => sha256(`${quote.trim()}\n${name.trim()}`);

type Row = { status: string; quote: string | null; displayName: string | null; quoteHash: string | null; consentAt: Date | null };

/** Only the exact quote and name the parent agreed to, while they still agree */
export function canPublish(t: Row) {
  return (t.status === "CONSENTED" || t.status === "PUBLISHED") && !!t.consentAt && !!t.quote?.trim() && !!t.displayName?.trim()
    && t.quoteHash === quoteHash(t.quote, t.displayName);
}

function clean(quote: string, displayName: string) {
  const q = quote.trim().replace(/\s+/g, " ");
  const n = displayName.trim().replace(/\s+/g, " ");
  if (q.length < 10) throw invalid("The quote needs at least 10 characters.");
  if (q.length > MAX_QUOTE) throw invalid(`Keep the quote under ${MAX_QUOTE} characters.`);
  if (n.length < 2 || n.length > MAX_NAME) throw invalid(`The name needs 2 to ${MAX_NAME} characters, like "Maria, Tacloban" or "Parent of two, Cebu".`);
  if (/@|https?:\/\//i.test(n)) throw invalid("Use a first name and town, or a description, not an email or link.");
  return { quote: q, displayName: n };
}

/** A proposal from a parent's feedback (their comment, as written) */
export async function proposeFromFeedback(feedbackId: string, input: { quote: string; displayName: string }, staffId: string) {
  const f = await db.feedback.findUnique({ where: { id: feedbackId }, select: { userId: true, comment: true } });
  if (!f) throw notFound("Feedback");
  if (!f.comment) throw invalid("This feedback has no words to quote.");
  if (await db.testimonial.count({ where: { feedbackId, status: { notIn: ["DECLINED", "WITHDRAWN"] } } })) throw conflict("A quote from this feedback is already proposed.");
  return db.testimonial.create({ data: { userId: f.userId, feedbackId, source: "FEEDBACK", originalText: f.comment, createdById: staffId, ...clean(input.quote, input.displayName) } });
}

/** A proposal from something a parent wrote elsewhere (an email to support), for their account's email */
export async function proposeForParent(parentEmail: string, input: { originalText: string; quote: string; displayName: string }, staffId: string) {
  const user = await db.user.findUnique({ where: { email: parentEmail.trim().toLowerCase() }, select: { id: true } });
  if (!user) throw invalid("No eGuard parent has that email.");
  return db.testimonial.create({
    data: { userId: user.id, source: "EMAIL", originalText: input.originalText.trim().slice(0, 4000) || null, createdById: staffId, ...clean(input.quote, input.displayName) },
  });
}

/**
 * Changes the quote or name. Whatever the parent agreed to no longer covers it: consent is cleared, it comes off the
 * site, and it's a proposal again, to be sent for consent.
 */
export async function editProposal(id: string, input: { quote: string; displayName: string }) {
  const t = await db.testimonial.findUnique({ where: { id } });
  if (!t) throw notFound("Testimonial");
  if (t.status === "WITHDRAWN" || t.status === "DECLINED") throw conflict("The parent said no: this one can't be used.");
  const v = clean(input.quote, input.displayName);
  if (v.quote === t.quote && v.displayName === t.displayName) return { wasPublished: false };
  await db.testimonial.update({
    where: { id },
    data: { ...v, status: "PROPOSED", consentAt: null, quoteHash: null, consentTextVersion: null, tokenHash: null, tokenExpiresAt: null, publishedAt: null },
  });
  return { wasPublished: t.status === "PUBLISHED" };
}

/** Emails the parent the exact quote and name with a link to agree or decline (sending again replaces the link) */
export async function sendConsentRequest(id: string, now = new Date()) {
  const t = await db.testimonial.findUnique({ where: { id }, include: { user: { select: { email: true, name: true } } } });
  if (!t) throw notFound("Testimonial");
  if (!t.user) throw conflict("The parent's account is gone.");
  if (t.status !== "PROPOSED" && t.status !== "AWAITING_CONSENT") throw conflict("Only a proposal can be sent for consent.");
  const token = newToken(24);
  await db.testimonial.update({
    where: { id },
    data: { status: "AWAITING_CONSENT", tokenHash: sha256(token), tokenExpiresAt: new Date(now.getTime() + CONSENT_DAYS * 864e5) },
  });
  const link = `${appUrl()}/testimonials/consent/${token}`;
  const first = t.user.name.split(/\s+/)[0] || "there";
  await sendMail({
    to: t.user.email,
    subject: "May we share your words about eGuard?",
    text: `Hi ${first},\n\nThank you for what you told us about eGuard. With your permission, we'd like to show it on eguard.family, exactly like this:\n\n"${t.quote}"\n— ${t.displayName}\n\nAgree, change the name, or say no here (the link works for ${CONSENT_DAYS} days):\n${link}\n\nIf you don't answer, nothing is shared. You can withdraw at any time from the same link.\n\n— The eGuard team`,
    html: `<p>Hi ${escapeHtml(first)},</p><p>Thank you for what you told us about eGuard. With your permission, we'd like to show it on eguard.family, exactly like this:</p>`
      + `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #2563eb">&ldquo;${escapeHtml(t.quote ?? "")}&rdquo;<br>— ${escapeHtml(t.displayName ?? "")}</blockquote>`
      + `<p><a href="${link}">Agree, change the name, or say no</a> (the link works for ${CONSENT_DAYS} days).</p><p>If you don't answer, nothing is shared. You can withdraw at any time from the same link.</p><p>— The eGuard team</p>`,
  });
}

/** What the consent page shows, or null for a link that's unknown or (unanswered and) expired */
export async function consentView(token: string, now = new Date()) {
  const t = await db.testimonial.findUnique({ where: { tokenHash: sha256(token) }, select: { id: true, status: true, quote: true, displayName: true, tokenExpiresAt: true } });
  if (!t) return null;
  // Answering expires; withdrawing never does
  if (t.status === "AWAITING_CONSENT" && t.tokenExpiresAt && t.tokenExpiresAt < now) return null;
  return { status: t.status as TestimonialStatus, quote: t.quote ?? "", displayName: t.displayName ?? "" };
}

/**
 * The parent's answer through the emailed link. `agree` may carry the name they'd rather use; anything else about the
 * quote can't be changed here (staff send a new proposal). Returns whether the public site changed.
 */
export async function answerConsent(token: string, answer: { decision: "agree" | "decline" | "withdraw"; displayName?: string }, now = new Date()) {
  const t = await db.testimonial.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { select: { email: true } } } });
  if (!t || !t.quote || !t.displayName) throw notFound("This link");
  if (answer.decision === "withdraw") {
    if (t.status === "WITHDRAWN" || t.status === "DECLINED") return { siteChanged: false };
    await db.testimonial.update({ where: { id: t.id }, data: { status: "WITHDRAWN", withdrawnAt: now, publishedAt: null } });
    return { siteChanged: t.status === "PUBLISHED" };
  }
  if (t.status !== "AWAITING_CONSENT") throw conflict("This was answered already.");
  if (t.tokenExpiresAt && t.tokenExpiresAt < now) throw conflict("This link has expired. Reply to the email and we'll send a new one.");
  if (answer.decision === "decline") {
    await db.testimonial.update({ where: { id: t.id }, data: { status: "DECLINED", withdrawnAt: now } });
    return { siteChanged: false };
  }
  const name = answer.displayName?.trim() ? clean(t.quote, answer.displayName).displayName : t.displayName;
  // From the state just read, so a double submit records one consent
  const { count } = await db.testimonial.updateMany({
    where: { id: t.id, status: "AWAITING_CONSENT" },
    data: {
      status: "CONSENTED", displayName: name, consentAt: now, consentEmail: t.user?.email ?? null, consentTextVersion: CONSENT_VERSION,
      quoteHash: quoteHash(t.quote, name),
    },
  });
  if (!count) throw conflict("This was answered already.");
  return { siteChanged: false };
}

/** Staff put a consented quote on the site, or take it off (it stays consented) */
export async function setPublished(id: string, publish: boolean, now = new Date()) {
  const t = await db.testimonial.findUnique({ where: { id } });
  if (!t) throw notFound("Testimonial");
  if (publish) {
    if (!canPublish(t)) throw conflict("Only the exact quote and name the parent agreed to can be published.");
    if (t.status === "PUBLISHED") return;
    await db.testimonial.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: now } });
  } else if (t.status === "PUBLISHED") {
    await db.testimonial.update({ where: { id }, data: { status: "CONSENTED", publishedAt: null } });
  }
}

/** A proposal that was never sent can simply go */
export async function discardProposal(id: string) {
  const { count } = await db.testimonial.deleteMany({ where: { id, status: "PROPOSED", consentAt: null } });
  if (!count) throw conflict("Only a proposal that wasn't sent can be discarded.");
}

/** The parent withdrawing from Settings › Privacy */
export async function withdrawOwn(userId: string, id: string, now = new Date()) {
  const t = await db.testimonial.findFirst({ where: { id, userId } });
  if (!t) throw notFound("Quote");
  if (t.status === "WITHDRAWN" || t.status === "DECLINED") return { siteChanged: false };
  await db.testimonial.update({ where: { id }, data: { status: "WITHDRAWN", withdrawnAt: now, publishedAt: null, tokenExpiresAt: null } });
  return { siteChanged: t.status === "PUBLISHED" };
}

/** The parent's own quotes that are shared or waiting for them (Settings › Privacy) */
export const ownTestimonials = (userId: string) =>
  db.testimonial.findMany({
    where: { userId, status: { in: ["AWAITING_CONSENT", "CONSENTED", "PUBLISHED"] } },
    select: { id: true, status: true, quote: true, displayName: true, consentAt: true, publishedAt: true },
    orderBy: { createdAt: "desc" },
  });

/** What the site shows: published, still matching what was agreed */
export async function publishedQuotes() {
  const rows = await db.testimonial.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ sortOrder: "asc" }, { publishedAt: "asc" }] });
  return rows.filter(canPublish).map((t) => ({ quote: t.quote!, name: t.displayName!, consentedOn: t.consentAt!.toISOString().slice(0, 10) }));
}

/**
 * Maintenance: erases the words, name and email of quotes withdrawn or declined over TESTIMONIAL_ERASE_DAYS ago,
 * keeping the row (status and dates) as the record that the parent's choice was carried out.
 */
export async function eraseWithdrawn(now = new Date()) {
  const { count } = await db.testimonial.updateMany({
    where: { status: { in: ["WITHDRAWN", "DECLINED"] }, withdrawnAt: { lt: new Date(now.getTime() - TESTIMONIAL_ERASE_DAYS * 864e5) }, quote: { not: null } },
    data: { quote: null, originalText: null, displayName: null, consentEmail: null, quoteHash: null, tokenHash: null, tokenExpiresAt: null },
  });
  return count;
}

/* ---------- Console › Social proof ---------- */

/** Every quote, newest first, with the parent's email (console only) */
export const listForConsole = () =>
  db.testimonial.findMany({
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { user: { select: { email: true } } },
  });

/** Moves a published quote earlier or later on the site */
export async function setSortOrder(id: string, sortOrder: number) {
  await db.testimonial.update({ where: { id }, data: { sortOrder: Math.max(-999, Math.min(999, Math.round(sortOrder))) } });
}

/** Whether any of these parents has a quote on the site (read before deleting their accounts) */
export const hasPublishedQuotes = async (userIds: string[]) =>
  userIds.length > 0 && (await db.testimonial.count({ where: { userId: { in: userIds }, status: "PUBLISHED" } })) > 0;

/**
 * Takes the site's proof out of the cache now, from outside a server action's own form (account deletion, the
 * maintenance job). Never fails the caller: at worst the hourly refresh catches up.
 */
export function expireProof() {
  try {
    revalidateTag(PROOF_TAG, { expire: 0 });
  } catch (e) {
    console.error("[testimonials] expiring the proof cache failed", e instanceof Error ? e.message : e);
  }
}
