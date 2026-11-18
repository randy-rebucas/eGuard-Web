/** Community constants the browser needs too (forms, report menu). lib/forum re-exports them. */

export const REPORT_REASONS = ["spam", "harassment", "child_info", "unsafe", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  spam: "Spam or advertising",
  harassment: "Rude or harassing",
  child_info: "Shares a child's details",
  unsafe: "Unsafe or harmful advice",
  other: "Something else",
};

export const LIMIT = { titleMin: 5, title: 120, bodyMin: 2, body: 10_000, handleMin: 3, handle: 24, note: 500, query: 100 } as const;

/** What every parent agrees to before their first post */
export const COMMUNITY_RULES = [
  "Keep your family private: no children's names, photos, schools, addresses or phone numbers.",
  "Be kind. Parents here are doing their best; disagree with ideas, not people.",
  "No selling, advertising or links to sell something.",
  "Don't share anything that could put a child at risk. If a child is in danger, contact the authorities first.",
  "eGuard moderators may hide posts and pause accounts that break these rules.",
] as const;
