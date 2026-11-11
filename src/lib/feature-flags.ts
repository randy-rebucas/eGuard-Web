import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import { db } from "./db";

/**
 * Feature flags staff switch on and off in the console (console › Feature flags, docs/console.md). A key nobody
 * created is off, so code can check a flag before it exists. A rollout below 100 turns it on for that share of
 * families, picked by a hash of the flag and family, so each family stays in or out as the share grows.
 */

export const FLAG_KEY_RE = /^[a-z][a-z0-9_]{1,47}$/;

/** 0–99: which slice of the rollout a family is in for this flag. */
export function flagBucket(key: string, familyId: string) {
  return createHash("sha256").update(`${key}:${familyId}`).digest().readUInt32BE(0) % 100;
}

/** Whether a flag row is on, for a family or (with none) everywhere: a partial rollout is off without a family. */
export function flagOn(flag: { key: string; enabled: boolean; rollout: number } | null, familyId?: string | null) {
  if (!flag?.enabled) return false;
  if (flag.rollout >= 100) return true;
  if (flag.rollout <= 0 || !familyId) return false;
  return flagBucket(flag.key, familyId) < flag.rollout;
}

/** One read of the flag table per request. */
const allFlags = cache(async () => new Map((await db.featureFlag.findMany({ select: { key: true, enabled: true, rollout: true } })).map((f) => [f.key, f])));

export async function isEnabled(key: string, familyId?: string | null) {
  return flagOn((await allFlags()).get(key) ?? null, familyId);
}
