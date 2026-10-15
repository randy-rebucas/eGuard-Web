import "server-only";
import { createHash } from "node:crypto";
import { invalid } from "./errors";

/**
 * Turns down a new password that's already been published in a data breach (Have I Been Pwned's Pwned Passwords),
 * since those are the first ones tried against every account. k-anonymity: only the first 5 characters of the
 * password's SHA-1 leave the server, and the reply lists every breached suffix sharing them, padded with fake ones so
 * its size says nothing either. If the service is slow or down, the password is allowed: signing up and resetting a
 * password mustn't depend on it. PWNED_PASSWORDS=off skips it (offline development).
 */

export const BREACHED_PASSWORD = "This password has appeared in a data breach, so it's one of the first that attackers try. Choose a different one.";

const RANGE_API = "https://api.pwnedpasswords.com/range/";

/** How many breaches the password appears in, 0 if none, or null if it couldn't be checked. */
export async function timesBreached(password: string): Promise<number | null> {
  if (process.env.PWNED_PASSWORDS === "off") return null;
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(RANGE_API + sha1.slice(0, 5), {
      headers: { "Add-Padding": "true", "User-Agent": "eGuard-password-check" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!res.ok) return null;
    for (const line of (await res.text()).split("\n")) {
      const [hash, count] = line.trim().split(":");
      // Padding lines carry a count of 0
      if (hash === suffix) return Number(count) || 0;
    }
    return 0;
  } catch (e) {
    console.warn("[auth] breached-password check unavailable", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Throws 400 with BREACHED_PASSWORD when the new password is a known breached one. */
export async function assertNotBreached(password: string) {
  if (((await timesBreached(password)) ?? 0) > 0) throw invalid(BREACHED_PASSWORD);
}
