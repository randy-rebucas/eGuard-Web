import "server-only";
import { after } from "next/server";
import { z } from "zod";
import { db } from "./db";
import { LIMITS, enforce } from "./rate-limit";
import { isEnabled } from "./feature-flags";
import { forwardTicket } from "./support";

/**
 * In-app feedback (docs/features/feedback.md): the NPS survey ("How likely are you to recommend eGuard…", 0–10) and
 * "Send feedback" in Help & support. Unhappy parents who said we may contact them get a support ticket, so a person
 * answers; the rest are listed for staff in console › Feedback.
 *
 * Feedback never decides whether a parent is asked for a store rating: that's lib/review-prompts, from what the parent
 * does in the app, never from what they answered here (store rules forbid "review gating").
 *
 * Comments are the parent's own words: never sent to an AI provider.
 */

export const FEEDBACK_KINDS = ["NPS", "FEEDBACK", "BUG", "IDEA"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = { NPS: "Survey", FEEDBACK: "Feedback", BUG: "Something's not working", IDEA: "An idea" };
export const PLATFORMS = ["WEB", "IOS", "ANDROID"] as const;
export const FOLLOW_UPS = ["NONE", "NEEDED", "TICKET", "CONTACTED", "RESOLVED"] as const;
export type FollowUp = (typeof FOLLOW_UPS)[number];

/** Comments are erased after a year (the score stays, for trends); the whole row after two (lib/maintenance) */
export const FEEDBACK_RETENTION_DAYS = { comment: 365, row: 730 } as const;

/** The NPS survey is shown only while this feature flag is on for the family (console › Feature flags) */
export const NPS_FLAG = "nps_survey";

export type Bucket = "PROMOTER" | "PASSIVE" | "DETRACTOR";

/** The standard NPS groups: 9–10 promoters, 7–8 passives, 0–6 detractors */
export function npsBucket(score: number): Bucket {
  return score >= 9 ? "PROMOTER" : score >= 7 ? "PASSIVE" : "DETRACTOR";
}

/** % promoters minus % detractors, -100…100, or null without answers */
export function npsScore(scores: number[]) {
  if (!scores.length) return null;
  const p = scores.filter((s) => s >= 9).length, d = scores.filter((s) => s <= 6).length;
  return Math.round(((p - d) / scores.length) * 100);
}

const DAY = 864e5;

/** When the survey may be shown (all must hold) */
export const NPS_RULES = {
  /** The family has had time to use eGuard */
  minAccountDays: 21,
  /** After an answer, not again for half a year */
  answeredDays: 180,
  /** "Not now": a quarter */
  dismissedDays: 90,
  /** Shown but closed without either (app killed): two weeks */
  seenDays: 14,
} as const;

export type NpsFacts = {
  flagOn: boolean;
  accountCreatedAt: Date;
  /** Paired phones, tablets, computers or browsers */
  devices: number;
  /** The parent is waiting on support: ask them later */
  openTickets: number;
  state: { npsSeenAt: Date | null; npsAnsweredAt: Date | null; npsDismissedAt: Date | null } | null;
};

const within = (d: Date | null | undefined, days: number, now: number) => !!d && now - d.getTime() < days * DAY;

/** Whether to show the NPS survey now, and if not, why (for logs and tests) */
export function npsDue(f: NpsFacts, now = Date.now()): { due: boolean; reason: string } {
  if (!f.flagOn) return { due: false, reason: "flag_off" };
  if (now - f.accountCreatedAt.getTime() < NPS_RULES.minAccountDays * DAY) return { due: false, reason: "too_new" };
  if (f.devices < 1) return { due: false, reason: "no_device" };
  if (f.openTickets > 0) return { due: false, reason: "open_ticket" };
  if (within(f.state?.npsAnsweredAt, NPS_RULES.answeredDays, now)) return { due: false, reason: "answered" };
  if (within(f.state?.npsDismissedAt, NPS_RULES.dismissedDays, now)) return { due: false, reason: "dismissed" };
  if (within(f.state?.npsSeenAt, NPS_RULES.seenDays, now)) return { due: false, reason: "seen" };
  return { due: true, reason: "due" };
}

/**
 * What happens after feedback: a support ticket when the parent is unhappy or something's broken and they said we
 * may contact them (and told us what's wrong), else a note for staff (NEEDED), else nothing.
 */
export function followUpFor(f: { kind: FeedbackKind; score?: number | null; comment?: string | null; contactOk: boolean }): FollowUp {
  const unhappy = f.kind === "BUG" || (f.kind === "NPS" && f.score != null && npsBucket(f.score) === "DETRACTOR");
  if (!unhappy) return "NONE";
  return f.contactOk && f.comment?.trim() ? "TICKET" : "NEEDED";
}

export const FeedbackSchema = z
  .object({
    kind: z.enum(FEEDBACK_KINDS),
    score: z.number().int().min(0).max(10).nullish(),
    comment: z.string().trim().max(2000, "Keep it under 2,000 characters.").nullish(),
    contactOk: z.boolean().default(false),
    appVersion: z.string().trim().max(40).nullish(),
    trigger: z.enum(["nps_survey", "settings", "help"]).default("settings"),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "NPS" && v.score == null) ctx.addIssue({ code: "custom", path: ["score"], message: "Choose a number from 0 to 10." });
    if (v.kind !== "NPS" && v.score != null) ctx.addIssue({ code: "custom", path: ["score"], message: "Only the survey takes a score." });
    if (v.kind !== "NPS" && (v.comment ?? "").length < 3) ctx.addIssue({ code: "custom", path: ["comment"], message: "Tell us a little more." });
  });
export type FeedbackInput = z.input<typeof FeedbackSchema>;

type Parent = { id: string; name: string; email: string; familyId: string };

/** The NPS facts for one parent, read from the database */
export async function npsFacts(user: { id: string; familyId: string }): Promise<NpsFacts> {
  const [flagOn, u, devices, browsers, openTickets, state] = await Promise.all([
    isEnabled(NPS_FLAG, user.familyId),
    db.user.findUnique({ where: { id: user.id }, select: { createdAt: true } }),
    db.device.count({ where: { familyId: user.familyId } }),
    db.browserInstallation.count({ where: { familyId: user.familyId, revokedAt: null } }),
    db.supportTicket.count({ where: { userId: user.id, status: "OPEN" } }),
    db.feedbackState.findUnique({ where: { userId: user.id }, select: { npsSeenAt: true, npsAnsweredAt: true, npsDismissedAt: true } }),
  ]);
  return { flagOn, accountCreatedAt: u?.createdAt ?? new Date(), devices: devices + browsers, openTickets, state };
}

/** What the apps may ask for now (GET /api/mobile/v1/feedback/prompts; the web dashboard's card) */
export async function feedbackPrompts(user: { id: string; familyId: string }, now = Date.now()) {
  return { nps: npsDue(await npsFacts(user), now) };
}

const touch = (userId: string, data: Record<string, Date>) =>
  db.feedbackState.upsert({ where: { userId }, create: { userId, ...data }, update: data });

/** The app showed the survey, or the parent chose "Not now" */
export async function npsEvent(user: { id: string }, event: "seen" | "dismissed", now = new Date()) {
  await touch(user.id, event === "seen" ? { npsSeenAt: now } : { npsDismissedAt: now });
}

const SUBJECT: Record<FeedbackKind, string> = { NPS: "Survey answer", FEEDBACK: "Feedback", BUG: "Something's not working", IDEA: "An idea" };

/**
 * Saves a parent's feedback. A ticket, when called for (followUpFor), is opened in their name and forwarded to the
 * support inbox like one they wrote, so they get a reply by email.
 */
export async function submitFeedback(user: Parent, input: FeedbackInput, platform: (typeof PLATFORMS)[number], now = new Date()) {
  await enforce(`feedback:${user.id}`, LIMITS.feedbackUser, "You've sent a lot of feedback this hour. Thank you! Try again a little later.");
  const v = FeedbackSchema.parse(input);
  const comment = v.comment?.trim() || null;
  const bucket = v.kind === "NPS" && v.score != null ? npsBucket(v.score) : null;
  const followUp = followUpFor({ ...v, comment });

  const { feedback, ticket } = await db.$transaction(async (tx) => {
    const ticket = followUp === "TICKET"
      ? await tx.supportTicket.create({
        data: {
          familyId: user.familyId, userId: user.id, category: "FEEDBACK",
          subject: v.kind === "NPS" ? `${SUBJECT.NPS}: ${v.score}/10` : SUBJECT[v.kind],
          message: comment!,
        },
      })
      : null;
    const feedback = await tx.feedback.create({
      data: {
        familyId: user.familyId, userId: user.id, kind: v.kind, score: v.score ?? null, bucket, comment, contactOk: v.contactOk,
        platform, appVersion: v.appVersion ?? null, trigger: v.kind === "NPS" ? "nps_survey" : v.trigger, followUp, ticketId: ticket?.id ?? null,
      },
    });
    await tx.feedbackState.upsert({
      where: { userId: user.id },
      create: { userId: user.id, lastFeedbackAt: now, ...(v.kind === "NPS" ? { npsAnsweredAt: now } : {}) },
      update: { lastFeedbackAt: now, ...(v.kind === "NPS" ? { npsAnsweredAt: now } : {}) },
    });
    return { feedback, ticket };
  });
  if (ticket) after(() => forwardTicket(ticket, user).catch((e) => console.error("[feedback] forwarding ticket failed", ticket.id, e)));
  return { id: feedback.id, followUp, ticketId: ticket?.id ?? null, bucket, message: thanks(followUp, bucket) };
}

/** What the parent sees after sending */
export function thanks(followUp: FollowUp, bucket: Bucket | null) {
  if (followUp === "TICKET") return "Thank you. We're sorry it isn't working well: someone from our team will email you within one business day.";
  if (bucket === "PROMOTER") return "Thank you! We're glad eGuard is helping your family.";
  return "Thank you. Every message is read by the eGuard team.";
}
