import type { Platform, Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * How the iOS child app got its Screen Time (FamilyControls) permission, as it reports on /device/v1/sync
 * `screenTimeAuthorization`: "child" (approved by a parent's Apple ID through Family Sharing; the child can't take it
 * back) or "individual" (the child approved it on the phone themselves, and can turn it off in Settings › Screen Time).
 *
 * Stored without a migration in `Device.accounts`, which only computers use otherwise (their Windows accounts, always
 * an array): on an iPhone it's `{ "screenTimeAuthorization": "child" | "individual" }`. Read and write it only here.
 */
export const ScreenTimeAuthorization = z.enum(["child", "individual"]);
export type ScreenTimeAuthorization = z.infer<typeof ScreenTimeAuthorization>;

type DeviceLike = { platform: Platform; accounts?: Prisma.JsonValue | null };

/** What the iPhone last reported; null on other platforms, or before an app that reports it has synced. */
export function screenTimeAuthorizationOf(d: DeviceLike): ScreenTimeAuthorization | null {
  if (d.platform !== "IOS") return null;
  const a = d.accounts;
  if (!a || typeof a !== "object" || Array.isArray(a)) return null;
  const v = ScreenTimeAuthorization.safeParse((a as Record<string, unknown>).screenTimeAuthorization);
  return v.success ? v.data : null;
}

/** True only when the last report was "individual": the child can turn eGuard's Screen Time access off themselves. */
export const isSelfApproved = (d: DeviceLike) => screenTimeAuthorizationOf(d) === "individual";

/** The `Device.accounts` value to save, or undefined when nothing changes (not an iPhone, nothing sent, same value). */
export function screenTimeAuthorizationUpdate(d: DeviceLike, reported: ScreenTimeAuthorization | undefined) {
  if (d.platform !== "IOS" || !reported || screenTimeAuthorizationOf(d) === reported) return undefined;
  return { screenTimeAuthorization: reported } satisfies Prisma.InputJsonObject;
}

/** What the parent is told on the device (web and docs use the same words). */
export const SELF_APPROVED_NOTE = "Self-approved: the child can turn this off in Settings";
