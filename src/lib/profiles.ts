import type { ProtectionKey } from "@prisma/client";
import { PROTECTIONS, defaultConfig, type ProtectionConfig } from "./protections";

/**
 * Protection profiles offered during onboarding. A profile is only a starting point:
 * it produces a full set of configs that the parent reviews before anything is sent.
 * Every profile keeps all 10 protections switched on, so none of them lowers the health score.
 */
export type ProfileId = "BALANCED" | "PROTECTED" | "CUSTOM";

export const PROFILES: { id: ProfileId; name: string; description: string; icon: string }[] = [
  { id: "BALANCED", name: "Balanced", description: "Moderate limits for independent kids", icon: "scale" },
  { id: "PROTECTED", name: "Protected", description: "Stronger controls for younger children", icon: "shield-check" },
  { id: "CUSTOM", name: "Custom", description: "Choose settings yourself", icon: "sliders-horizontal" },
];

export const PROFILE_IDS = PROFILES.map((p) => p.id) as [ProfileId, ...ProfileId[]];

/** Younger children start on Protected, teenagers on Balanced. */
export const recommendedProfile = (age: number): ProfileId => (age >= 13 ? "BALANCED" : "PROTECTED");

const RATING_TIERS = [4, 9, 13, 16, 18];
const nextTier = (r: number) => RATING_TIERS.find((t) => t > r) ?? 18;

function shiftTime(t: string, minutes: number) {
  const [h, m] = t.split(":").map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function profileConfig(profile: ProfileId, key: ProtectionKey, age: number): ProtectionConfig {
  const base = defaultConfig(key, age);
  if (profile !== "BALANCED") return base; // Protected = eGuard's age defaults; Custom starts there too
  switch (base.key) {
    case "SCREEN_TIME":
      return { ...base, dailyMinutes: Math.min(1440, base.dailyMinutes + 60), weekendMinutes: Math.min(1440, base.weekendMinutes + 60) };
    case "BEDTIME":
      return { ...base, start: shiftTime(base.start, 60) };
    case "APP_RESTRICTIONS":
    case "CONTENT":
      return { ...base, maxAgeRating: nextTier(base.maxAgeRating) };
    default:
      return base;
  }
}

export const profileConfigs = (profile: ProfileId, age: number) => PROTECTIONS.map((p) => profileConfig(profile, p.key, age));
