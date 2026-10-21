/**
 * The parent-care automations, as data the engine runs (docs/features/parent-care.md). Each names its trigger, its
 * steps, the parent's switch that controls it, and the channels it may use in order of preference: a message goes
 * out on the first channel that's permitted, available and under its contact limit, never on several.
 *
 * Bump `version` when the behaviour changes: the console shows it, enrollments record it, and the definition's
 * snapshot is synced to ParentCareAutomation so staff see what is live.
 */

export const CHANNELS = ["PUSH", "EMAIL", "IN_APP"] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABEL: Record<Channel, string> = { PUSH: "Push", EMAIL: "Email", IN_APP: "In-app" };

/** Each parent's own switch for an automation (ParentCarePreference) */
export type PreferenceToggle = "briefings" | "followUps" | "weeklyPlan" | "checkIns" | "monthlyReport";

export type AutomationKey = "briefing" | "follow_up" | "weekly_plan" | "check_in" | "monthly_report";

export type AutomationDef = {
  key: AutomationKey;
  name: string;
  description: string;
  trigger: "EVENT" | "SCHEDULE";
  /** Human-readable schedule, for the console */
  schedule: string;
  version: number;
  templateKey: string;
  toggle: PreferenceToggle;
  channels: Channel[];
  /** Days that must pass between two messages of this automation to one parent */
  cooldownDays: number;
  /** check_in: days of inactivity each step is sent at */
  steps?: number[];
  /** follow_up: hours after the activity was started */
  delayHours?: number;
};

export const AUTOMATIONS: AutomationDef[] = [
  {
    key: "briefing", name: "Family safety briefing", trigger: "SCHEDULE", version: 1, templateKey: "briefing", toggle: "briefings",
    description: "A practical tip from the knowledge center and one suggested activity, on the days the parent chose.",
    schedule: "Parent's briefing days (default Mon, Wed, Fri) at their delivery time",
    channels: ["PUSH", "IN_APP"], cooldownDays: 1,
  },
  {
    key: "follow_up", name: "Incomplete activity follow-up", trigger: "EVENT", version: 1, templateKey: "follow_up", toggle: "followUps",
    description: "One reminder about an activity the parent started and didn't finish. Cancelled when it's completed.",
    schedule: "About 24 hours after an activity is started, outside quiet hours",
    channels: ["PUSH", "IN_APP"], cooldownDays: 0, delayHours: 24,
  },
  {
    key: "weekly_plan", name: "Weekly family safety plan", trigger: "SCHEDULE", version: 1, templateKey: "weekly_plan", toggle: "weeklyPlan",
    description: "One or two activities for the week, fitting the children's ages and skipping what's done.",
    schedule: "Mondays at the parent's delivery time",
    channels: ["EMAIL", "PUSH", "IN_APP"], cooldownDays: 6,
  },
  {
    key: "check_in", name: "Inactive parent check-in", trigger: "SCHEDULE", version: 1, templateKey: "check_in", toggle: "checkIns",
    description: "Up to three helpful messages after 7, 14 and 21 days without a qualifying action. Stops the moment the parent returns.",
    schedule: "Day 7, 14 and 21 of inactivity at the parent's delivery time",
    channels: ["EMAIL", "PUSH"], cooldownDays: 6, steps: [7, 14, 21],
  },
  {
    key: "monthly_report", name: "Monthly family progress report", trigger: "SCHEDULE", version: 1, templateKey: "monthly_report", toggle: "monthlyReport",
    description: "Last month's completed activities and protection changes, from the family's own records, with a next step.",
    schedule: "The 1st of each month at the parent's delivery time",
    channels: ["EMAIL", "IN_APP"], cooldownDays: 20,
  },
];

const BY_KEY = new Map(AUTOMATIONS.map((a) => [a.key, a]));
export const automationByKey = (key: string) => BY_KEY.get(key as AutomationKey) ?? null;

/**
 * Contact limits across every automation together. Push and email ("outbound") are the ones that interrupt;
 * in-app messages are limited too, so the Safety plan never fills with them. Safety alerts aren't counted and
 * never wait for these: they're sent by lib/maintenance, which this engine doesn't touch.
 */
export const CONTACT_LIMITS = { outboundPerDay: 1, outboundPer7Days: 3, inAppPerDay: 2, inAppPer7Days: 6 } as const;

/** Share of parents put in the holdout group when their preferences are first made (0 turns it off) */
export const HOLDOUT_PCT = 10;

/** Retries: base × 2^attempt with ±20% jitter, capped, then the job is given up (DEAD) */
export const RETRY = { maxAttempts: 5, baseMs: 5 * 60_000, maxMs: 6 * 3600_000 } as const;

/** A RUNNING job whose worker hasn't finished in this long is assumed lost (a restart) and released */
export const STALE_LOCK_MS = 10 * 60_000;

/** A planned message whose time passed by more than this (the scheduler was down) is skipped, not sent late */
export const LATE_MS = 12 * 3600_000;

/** Inactivity: a qualifying action after this many days without one is a reactivation */
export const INACTIVE_DAYS = 7;
