/**
 * Facts the privacy policy and terms depend on. Fill in the blanks before launch: the Data Privacy Act
 * (RA 10173) requires naming a Data Protection Officer, and the stores ask for a business address.
 * Fields left null are simply not shown.
 */
export const LEGAL = {
  /** Registered business name, as on the DTI or SEC registration */
  entity: "eGuard",
  /** Full name of the Data Protection Officer */
  dpoName: null as string | null,
  /** Business address for privacy and legal notices */
  address: null as string | null,
  /** Where privacy requests go. Null uses SUPPORT_EMAIL. */
  privacyEmail: null as string | null,
  /** Shown as "Last updated" on both pages; change it whenever either page changes */
  updated: "2026-09-28",
};

export const legalDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
