import { CONTACT_LIMITS, type AutomationDef, type Channel } from "./definitions";
import { afterQuietHours, inQuietHours, localMinute } from "./schedule";

/**
 * The one place that decides whether a parent-care message may go, and on which channel. Run when a job is
 * scheduled ("schedule") and again just before it's delivered ("deliver"), when everything is re-read: preferences,
 * consent, opt-outs, contact counts, and whether the message still makes sense. Pure: the caller loads the facts.
 */

export type CarePrefs = {
  enabled: boolean;
  inApp: boolean; push: boolean; email: boolean;
  pushConsentAt: Date | null; emailConsentAt: Date | null;
  briefings: boolean; followUps: boolean; weeklyPlan: boolean; checkIns: boolean; monthlyReport: boolean;
  quietStart: number; quietEnd: number;
  cohort: string;
};

export type Suppression = { scope: string; reason: string; until: Date | null };

export type SentMessage = { channel: string; automationKey: string; sentAt: Date };

export type EligibilityInput = {
  now: Date;
  timezone: string;
  automation: AutomationDef & { enabled: boolean };
  /** A pending invitation hasn't joined yet; a missing account is caught before this */
  account: { active: boolean; emailVerified: boolean };
  prefs: CarePrefs;
  suppressions: Suppression[];
  /** Whether each channel can deliver at all: push needs FCM, a registered phone and Push notifications on */
  available: Record<Channel, boolean>;
  /** Proactive messages accepted in the last 7 days, every automation */
  recent: SentMessage[];
  /** A message for this exact step already exists */
  alreadySent?: boolean;
  /** The automation's own recheck: null when still relevant, else why not (activity_completed, returned, …) */
  irrelevant?: string | null;
};

export type Decision =
  | { ok: true; channel: Channel }
  | { ok: false; reason: string; retryAt?: Date };

const OUTBOUND: Channel[] = ["PUSH", "EMAIL"];

export const activeSuppression = (s: Suppression, now: Date) => !s.until || s.until > now;

/** Whether the parent allows this channel for parent care: their switch, and recorded consent for push and email. */
export function channelPermitted(c: Channel, p: CarePrefs) {
  if (c === "IN_APP") return p.inApp;
  if (c === "PUSH") return p.push && !!p.pushConsentAt;
  return p.email && !!p.emailConsentAt;
}

/** How many more messages this channel may carry now, under the contact limits. */
export function underLimits(c: Channel, recent: SentMessage[], now: Date) {
  const day = now.getTime() - 864e5;
  const outbound = OUTBOUND.includes(c);
  const same = recent.filter((m) => (outbound ? OUTBOUND.includes(m.channel as Channel) : m.channel === "IN_APP"));
  const today = same.filter((m) => m.sentAt.getTime() > day).length;
  return outbound
    ? today < CONTACT_LIMITS.outboundPerDay && same.length < CONTACT_LIMITS.outboundPer7Days
    : today < CONTACT_LIMITS.inAppPerDay && same.length < CONTACT_LIMITS.inAppPer7Days;
}

export function checkEligibility(i: EligibilityInput, stage: "schedule" | "deliver"): Decision {
  const { automation: a, prefs: p, now } = i;
  if (!a.enabled) return { ok: false, reason: "automation_paused" };
  if (!i.account.active) return { ok: false, reason: "account_inactive" };
  if (!p.enabled) return { ok: false, reason: "care_off" };
  if (!p[a.toggle]) return { ok: false, reason: "automation_off" };
  if (p.cohort === "HOLDOUT") return { ok: false, reason: "holdout" };
  const blocked = i.suppressions.filter((s) => activeSuppression(s, now));
  if (blocked.some((s) => s.scope === "ALL" || s.scope === a.key)) {
    return { ok: false, reason: blocked.some((s) => s.reason === "OPT_OUT") ? "opted_out" : "suppressed" };
  }
  if (i.irrelevant) return { ok: false, reason: i.irrelevant };

  const usable = a.channels.filter((c) =>
    channelPermitted(c, p) && i.available[c] && !(c === "EMAIL" && !i.account.emailVerified)
    && !blocked.some((s) => s.scope === `CHANNEL:${c}`));
  if (!usable.length) return { ok: false, reason: "no_channel" };
  if (stage === "schedule") return { ok: true, channel: usable[0] };

  if (i.alreadySent) return { ok: false, reason: "already_sent" };
  const last = i.recent.filter((m) => m.automationKey === a.key).sort((x, y) => y.sentAt.getTime() - x.sentAt.getTime())[0];
  if (last && a.cooldownDays && now.getTime() - last.sentAt.getTime() < a.cooldownDays * 864e5) return { ok: false, reason: "cooldown" };

  const channel = usable.find((c) => underLimits(c, i.recent, now));
  if (!channel) return { ok: false, reason: "contact_limit" };
  if (OUTBOUND.includes(channel) && inQuietHours(localMinute(now, i.timezone), p.quietStart, p.quietEnd)) {
    return { ok: false, reason: "quiet_hours", retryAt: afterQuietHours(now, i.timezone, p.quietStart, p.quietEnd) };
  }
  return { ok: true, channel };
}
