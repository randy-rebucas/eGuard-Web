/**
 * Facts the privacy policy and terms depend on. Fill in the blanks before launch: the Data Privacy Act
 * (RA 10173) requires naming a Data Protection Officer, and the stores ask for a business address.
 * Fields left null are simply not shown.
 */
export const LEGAL = {
  /** Registered business name, exactly as on the DTI or SEC registration. eGuard is its product. */
  entity: "DevCom Digital Marketing Services",
  /** Short name used after the first mention ("we") */
  shortName: "DevCom",
  /** Full name of the Data Protection Officer. Null shows the role only ("DevCom's Data Protection Officer"). */
  dpoName: null as string | null,
  /** Business address for privacy and legal notices */
  address: "Brgy. Hipusngo, Baybay City, Leyte 6521, Philippines" as string | null,
  /** Where privacy and legal requests go (both pages). Null uses SUPPORT_EMAIL. */
  privacyEmail: "support@devcomdigital.com" as string | null,
  /** Working days to act on an emailed deletion request (/delete-account) */
  deletionDays: 7,
  /** Shown as "Last updated" on both pages; change it whenever either page changes */
  updated: "2026-09-29",
};

export const legalDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
