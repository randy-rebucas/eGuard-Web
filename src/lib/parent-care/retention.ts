/**
 * How long parent-care records are kept (lib/maintenance purgeExpiredData deletes older ones). Long enough for
 * year-on-year retention numbers, and no longer. Deleting the account deletes everything at once (foreign keys
 * cascade from User). Preferences and activity progress are kept while the account exists: they're the parent's
 * own choices.
 */
export const CARE_RETENTION_DAYS = {
  /** Lifecycle events, the basis of every metric */
  events: 400,
  /** Message history: also what stops a tip being sent twice */
  messages: 365,
  /** Finished jobs; pending ones are kept until they run */
  jobs: 90,
  /** Weekly plans */
  plans: 400,
} as const;
