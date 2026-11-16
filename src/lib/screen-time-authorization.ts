import type { Platform, ScreenTimeAuthorization as Stored } from "@prisma/client";
import { z } from "zod";

/**
 * How the iOS child app got its Screen Time (FamilyControls) permission, as it reports on /device/v1/sync
 * `screenTimeAuthorization`: "child" (approved by a parent's Apple ID through Family Sharing; the child can't take it
 * back) or "individual" (the child approved it on the phone themselves, and can turn it off in Settings › Screen Time).
 * Lowercase on the wire, as Apple names them; stored in `Device.screenTimeAuthorization` as CHILD / INDIVIDUAL.
 */
export const ScreenTimeAuthorization = z.enum(["child", "individual"]);
export type ScreenTimeAuthorization = z.infer<typeof ScreenTimeAuthorization>;

type DeviceLike = { platform: Platform; screenTimeAuthorization?: Stored | null };

/** What the iPhone last reported; null on other platforms, or before an app that reports it has synced. */
export function screenTimeAuthorizationOf(d: DeviceLike): ScreenTimeAuthorization | null {
  if (d.platform !== "IOS" || !d.screenTimeAuthorization) return null;
  return d.screenTimeAuthorization === "INDIVIDUAL" ? "individual" : "child";
}

/** True only when the last report was "individual": the child can turn eGuard's Screen Time access off themselves. */
export const isSelfApproved = (d: DeviceLike) => screenTimeAuthorizationOf(d) === "individual";

/** The column value to save, or undefined when nothing changes (not an iPhone, nothing sent, same value). */
export function screenTimeAuthorizationUpdate(d: DeviceLike, reported: ScreenTimeAuthorization | undefined): Stored | undefined {
  if (d.platform !== "IOS" || !reported || screenTimeAuthorizationOf(d) === reported) return undefined;
  return reported === "individual" ? "INDIVIDUAL" : "CHILD";
}

/** What the parent is told on the device (web and docs use the same words). */
export const SELF_APPROVED_NOTE = "Self-approved: the child can turn this off in Settings";
