import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, body } from "@/lib/mobile-api";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { carePreferences, updateCarePreferences } from "@/lib/parent-care/service";

/**
 * Settings › Notifications › Tips and reminders (docs/features/parent-care.md). Separate from alert preferences
 * (/me/notifications): nothing here changes which safety alerts arrive.
 *
 * Times are 24-hour local "HH:MM" in `effectiveTimezone`; `briefingDays` are 0 (Sunday) to 6. `push` and `email`
 * record consent when turned on (`consent.push` / `consent.email` timestamps) and withdraw it when turned off.
 * `channels` says whether each channel can reach the parent at all (a phone registered, a verified email).
 */
export const GET = authed(async ({ user }) => NextResponse.json(await carePreferences(user)));

export const PATCH = authed(async ({ req, user }) => {
  await enforce(`care:${user.id}`, LIMITS.careUser);
  // Validated by the service (CarePrefsSchema), the same for the web and the app; a bad field answers 400
  const b = await body(req, z.record(z.string(), z.unknown()));
  return NextResponse.json(await updateCarePreferences(user, b));
});
