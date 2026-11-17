import "server-only";
import { db } from "./db";
import { isEnabled } from "./feature-flags";
import { deviceState } from "./health";
import { STORE_LINKS } from "@/components/brand-marks";

/**
 * Asking for a store rating (docs/features/feedback.md › Store ratings): when the apps may show the store's own review
 * prompt (Play In-App Review, Apple's requestReview), and when parent care may invite a rating by email or push.
 *
 * The rule that shapes this file: **no review gating.** Google Play forbids asking for an opinion before its review
 * card, and both stores forbid asking only happy users. So whether to ask is decided only from what the parent does in
 * the app: time with eGuard, devices working, nothing wrong right now. `RateFacts` has no score or sentiment on purpose,
 * and any feedback in the last 30 days delays the ask whatever it said (src/lib/test/review-prompts.test.ts checks
 * that a 10 and a 2 get the same answer).
 */

export const RATE_PROMPT_FLAG = "rate_prompt";
export const APP_PLATFORMS = ["IOS", "ANDROID"] as const;
export type AppPlatform = (typeof APP_PLATFORMS)[number];

const DAY = 864e5;

/** The app's prompt (all must hold). The store may still decide not to show its card. */
export const RATE_RULES = {
  minAccountDays: 14,
  /** Days with a qualifying action (a protection change, a request answered…) in the last 14 */
  minActiveDays: 3,
  /** A device paired at least this long ago, and every device online and passing its checks */
  devicePairedDays: 7,
  /** After any survey answer or Send feedback, whatever it said */
  feedbackQuietDays: 30,
  /** Since this app last asked */
  platformCooldownDays: 120,
  /** Apple allows 3 a year; Android keeps to the same */
  maxPerYear: 3,
} as const;

/** The parent care invitation (email or push) is stricter: later, and never soon after a native prompt */
export const INVITE_RULES = { minAccountDays: 30, nativePromptQuietDays: 60 } as const;

export type RateFacts = {
  flagOn: boolean;
  accountCreatedAt: Date;
  activeDays14: number;
  devices: { pairedAt: Date; healthy: boolean }[];
  /** Unresolved ACTION_REQUIRED or CRITICAL alerts: something needs fixing, so not now */
  urgentAlerts: number;
  openTickets: number;
  lastFeedbackAt: Date | null;
  /** When each app last asked the store for its prompt */
  promptedAt: Partial<Record<AppPlatform, Date>>;
  promptsLastYear: number;
};

export type RateDecision = { eligible: boolean; reason: string };

const daysAgo = (d: Date | null | undefined, now: number) => (d ? (now - d.getTime()) / DAY : Infinity);

/** The checks every ask shares, from what the parent does; never from what they said */
function baseRules(f: RateFacts, now: number, minAccountDays: number): RateDecision | null {
  if (!f.flagOn) return { eligible: false, reason: "flag_off" };
  if (daysAgo(f.accountCreatedAt, now) < minAccountDays) return { eligible: false, reason: "too_new" };
  if (f.activeDays14 < RATE_RULES.minActiveDays) return { eligible: false, reason: "not_active" };
  if (!f.devices.some((d) => daysAgo(d.pairedAt, now) >= RATE_RULES.devicePairedDays)) return { eligible: false, reason: "no_settled_device" };
  if (f.devices.some((d) => !d.healthy)) return { eligible: false, reason: "device_needs_attention" };
  if (f.urgentAlerts > 0) return { eligible: false, reason: "urgent_alert" };
  if (f.openTickets > 0) return { eligible: false, reason: "open_ticket" };
  if (daysAgo(f.lastFeedbackAt, now) < RATE_RULES.feedbackQuietDays) return { eligible: false, reason: "recent_feedback" };
  return null;
}

/** Whether the app on `platform` may ask the store for its review prompt now */
export function ratePromptEligibility(f: RateFacts, platform: AppPlatform, now = Date.now()): RateDecision {
  const base = baseRules(f, now, RATE_RULES.minAccountDays);
  if (base) return base;
  if (daysAgo(f.promptedAt[platform], now) < RATE_RULES.platformCooldownDays) return { eligible: false, reason: "asked_recently" };
  if (f.promptsLastYear >= RATE_RULES.maxPerYear) return { eligible: false, reason: "yearly_limit" };
  return { eligible: true, reason: "eligible" };
}

/** Whether parent care may invite a rating (its own 180-day cooldown is the automation's) */
export function reviewInviteEligibility(f: RateFacts, now = Date.now()): RateDecision {
  const base = baseRules(f, now, INVITE_RULES.minAccountDays);
  if (base) return base;
  const lastNative = Math.min(...APP_PLATFORMS.map((p) => daysAgo(f.promptedAt[p], now)));
  if (lastNative < INVITE_RULES.nativePromptQuietDays) return { eligible: false, reason: "asked_recently" };
  return { eligible: true, reason: "eligible" };
}

/** `ratePromptedAt` as stored: { IOS?: iso, ANDROID?: iso } */
export function readPromptedAt(json: unknown): Partial<Record<AppPlatform, Date>> {
  const out: Partial<Record<AppPlatform, Date>> = {};
  if (json && typeof json === "object") {
    for (const p of APP_PLATFORMS) {
      const v = (json as Record<string, unknown>)[p];
      const d = typeof v === "string" ? new Date(v) : null;
      if (d && !Number.isNaN(d.getTime())) out[p] = d;
    }
  }
  return out;
}

/** The year's count, which restarts 365 days after the year's first prompt */
export const promptsThisYear = (s: { ratePromptCount: number; ratePromptYearFrom: Date | null } | null, now = Date.now()) =>
  s?.ratePromptYearFrom && daysAgo(s.ratePromptYearFrom, now) < 365 ? s.ratePromptCount : 0;

/** The facts for one parent, read from the database */
export async function rateFacts(user: { id: string; familyId: string }, now = Date.now()): Promise<RateFacts> {
  const since = new Date(now - 14 * DAY);
  const [flagOn, u, events, devices, urgentAlerts, openTickets, state] = await Promise.all([
    isEnabled(RATE_PROMPT_FLAG, user.familyId),
    db.user.findUnique({ where: { id: user.id }, select: { createdAt: true } }),
    db.parentCareEvent.findMany({ where: { userId: user.id, type: "QUALIFYING_ACTIVITY", occurredAt: { gte: since } }, select: { occurredAt: true } }),
    db.device.findMany({
      where: { familyId: user.familyId, removalRequestedAt: null },
      select: { id: true, name: true, platform: true, lastSeenAt: true, createdAt: true, protections: { select: { key: true, status: true, message: true, lastVerifiedAt: true } } },
    }),
    db.alert.count({ where: { familyId: user.familyId, resolvedAt: null, severity: { in: ["ACTION_REQUIRED", "CRITICAL"] } } }),
    db.supportTicket.count({ where: { userId: user.id, status: "OPEN" } }),
    db.feedbackState.findUnique({ where: { userId: user.id } }),
  ]);
  return {
    flagOn,
    accountCreatedAt: u?.createdAt ?? new Date(now),
    activeDays14: new Set(events.map((e) => e.occurredAt.toISOString().slice(0, 10))).size,
    devices: devices.map((d) => ({ pairedAt: d.createdAt, healthy: deviceState(d, now).key === "healthy" })),
    urgentAlerts, openTickets,
    lastFeedbackAt: state?.lastFeedbackAt ?? null,
    promptedAt: readPromptedAt(state?.ratePromptedAt),
    promptsLastYear: promptsThisYear(state, now),
  };
}

/** GET /api/mobile/v1/review-prompt */
export async function ratePrompt(user: { id: string; familyId: string }, platform: AppPlatform, now = Date.now()) {
  return ratePromptEligibility(await rateFacts(user, now), platform, now);
}

/**
 * The app asked the store for its prompt (POST /api/mobile/v1/review-prompt). Whether the card actually showed, and
 * whether the parent rated, is the store's to know: eGuard only records that it asked.
 */
export async function recordRatePrompt(user: { id: string }, platform: AppPlatform, now = new Date()) {
  const s = await db.feedbackState.findUnique({ where: { userId: user.id } });
  const promptedAt = { ...Object.fromEntries(Object.entries(readPromptedAt(s?.ratePromptedAt)).map(([k, v]) => [k, v!.toISOString()])), [platform]: now.toISOString() };
  const newYear = !s?.ratePromptYearFrom || daysAgo(s.ratePromptYearFrom, now.getTime()) >= 365;
  const data = {
    ratePromptedAt: promptedAt,
    ratePromptCount: newYear ? 1 : (s?.ratePromptCount ?? 0) + 1,
    ratePromptYearFrom: newYear ? now : s!.ratePromptYearFrom,
  };
  await db.feedbackState.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
}

/** Parents who use the Android app: the only store eGuard is in today (STORE_LINKS.appStore is null) */
export async function usesAndroidApp(userId: string) {
  const [push, session] = await Promise.all([
    db.pushToken.count({ where: { userId, platform: "ANDROID" } }),
    db.session.count({ where: { userId, web: false, userAgent: { contains: "Android", mode: "insensitive" } } }),
  ]);
  return push + session > 0;
}

/** Where /rate sends a parent: their phone's store, or null for the page listing them */
export function storeFor(userAgent: string | null): string | null {
  const ua = userAgent ?? "";
  if (/android/i.test(ua)) return STORE_LINKS.googlePlay;
  if (/iphone|ipad|ipod/i.test(ua)) return STORE_LINKS.appStore;
  return null;
}
