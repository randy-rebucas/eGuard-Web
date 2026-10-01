import "server-only";
import { createHash, createPrivateKey, createPublicKey, sign, type KeyObject } from "node:crypto";
import { z } from "zod";
import { Prisma, type BrowserInstallation, type BrowserPolicy } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { ServiceError, notFound } from "./errors";
import type { Actor } from "./config-service";
import { categoryDomains } from "./category-lists";

/**
 * Browser protection: what the eGuard browser extension enforces for a child. One policy per child, shared
 * by all their browsers, versioned, and signed when sent so the extension can tell it came from eGuard
 * (and wasn't edited in the browser's storage). Contract: eguard-browser/packages/schemas/src/policy.ts.
 */

export const WEB_CATEGORIES = [
  "ADULT", "GAMBLING", "MALWARE", "PHISHING", "VIOLENCE", "DRUGS", "WEAPONS", "HATE",
  "DATING", "SOCIAL_MEDIA", "GAMING", "STREAMING", "SHOPPING", "DOWNLOADS",
] as const;
export type WebCategory = (typeof WEB_CATEGORIES)[number];

export const CATEGORY_META: Record<WebCategory, { label: string; hint: string }> = {
  ADULT: { label: "Adult content", hint: "Pornography and explicit material" },
  GAMBLING: { label: "Gambling", hint: "Betting, casinos, lotteries" },
  MALWARE: { label: "Malware", hint: "Sites known to spread harmful software" },
  PHISHING: { label: "Phishing", hint: "Fake sites that steal passwords" },
  VIOLENCE: { label: "Violence", hint: "Graphic violence and gore" },
  DRUGS: { label: "Drugs", hint: "Buying or promoting drugs" },
  WEAPONS: { label: "Weapons", hint: "Buying weapons" },
  HATE: { label: "Hate & extremism", hint: "Hate speech and extremist content" },
  DATING: { label: "Dating", hint: "Dating and hookup sites" },
  SOCIAL_MEDIA: { label: "Social media", hint: "Facebook, Instagram, TikTok and similar" },
  GAMING: { label: "Gaming", hint: "Online games and game stores" },
  STREAMING: { label: "Streaming", hint: "Video and music streaming" },
  SHOPPING: { label: "Shopping", hint: "Online stores" },
  DOWNLOADS: { label: "Downloads", hint: "File-sharing and download sites" },
};

export const UNKNOWN_SITES = ["ALLOW", "WARN", "BLOCK"] as const;
export const MAX_DOMAINS = 500;

/** Protected by default, by age, like the phone profiles. Security categories are always on. */
export function defaultCategories(age: number): WebCategory[] {
  const base: WebCategory[] = ["ADULT", "GAMBLING", "MALWARE", "PHISHING", "HATE", "DRUGS", "WEAPONS"];
  if (age < 13) base.push("VIOLENCE", "DATING");
  if (age < 9) base.push("SOCIAL_MEDIA");
  return base.sort();
}

/* ---------- Domains ---------- */

const DOMAIN_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

/**
 * Turns what a parent types ("https://www.YouTube.com/watch?v=1", "*.example.com") into a host name.
 * Returns null when it can't be one. A rule for example.com also covers its subdomains.
 */
export function normalizeDomain(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^\*\./, "");
  s = s.split(/[/?#]/)[0]!.replace(/:\d+$/, "").replace(/\.$/, "");
  return DOMAIN_RE.test(s) ? s : null;
}

/** Parses a list typed one per line (commas also work). Duplicates are dropped. */
export function parseDomainList(text: string): { domains: string[]; invalid: string[] } {
  const domains = new Set<string>();
  const invalid: string[] = [];
  for (const part of text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)) {
    const d = normalizeDomain(part);
    if (d) domains.add(d);
    else invalid.push(part);
  }
  return { domains: [...domains].sort(), invalid };
}

/* ---------- Input ---------- */

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 21:30.");

export const BrowserPolicyInput = z
  .object({
    safeBrowsing: z.boolean(),
    safeSearch: z.boolean(),
    blockedCategories: z.array(z.enum(WEB_CATEGORIES)).max(WEB_CATEGORIES.length),
    blockedDomains: z.array(z.string()).max(MAX_DOMAINS, `Up to ${MAX_DOMAINS} blocked sites.`),
    allowedDomains: z.array(z.string()).max(MAX_DOMAINS, `Up to ${MAX_DOMAINS} allowed sites.`),
    unknownSitesPolicy: z.enum(UNKNOWN_SITES),
    schedule: z.object({ enabled: z.boolean(), startTime: HHMM, endTime: HHMM }).nullable(),
  })
  .transform((p, ctx) => {
    const clean = (list: string[], which: string) => {
      const out = new Set<string>();
      for (const raw of list) {
        const d = normalizeDomain(raw);
        if (d) out.add(d);
        else ctx.addIssue({ code: "custom", message: `"${raw}" in ${which} isn't a website address.` });
      }
      return [...out].sort();
    };
    const blockedDomains = clean(p.blockedDomains, "blocked sites");
    const allowedDomains = clean(p.allowedDomains, "allowed sites");
    const both = blockedDomains.filter((d) => allowedDomains.includes(d));
    if (both.length) ctx.addIssue({ code: "custom", message: `${both[0]} is in both lists. Keep it in one.` });
    if (p.schedule?.enabled && p.schedule.startTime === p.schedule.endTime) {
      ctx.addIssue({ code: "custom", message: "Focus hours need different start and end times." });
    }
    return { ...p, blockedCategories: [...new Set(p.blockedCategories)].sort(), blockedDomains, allowedDomains };
  });
export type BrowserPolicyInput = z.output<typeof BrowserPolicyInput>;

/* ---------- Reading and writing ---------- */

const ageOf = (birthYear: number) => new Date().getFullYear() - birthYear;

function snapshot(p: BrowserPolicy) {
  return {
    version: p.version, safeBrowsing: p.safeBrowsing, safeSearch: p.safeSearch, blockedCategories: p.blockedCategories,
    blockedDomains: p.blockedDomains, allowedDomains: p.allowedDomains, unknownSitesPolicy: p.unknownSitesPolicy, schedule: p.schedule,
    temporaryAllows: p.temporaryAllows,
  };
}

/** The child's browser policy, created with age-based defaults the first time it's asked for. */
export async function getOrCreateBrowserPolicy(childId: string) {
  const existing = await db.browserPolicy.findUnique({ where: { childId } });
  if (existing) return existing;
  const child = await db.child.findUniqueOrThrow({ where: { id: childId } });
  try {
    return await db.$transaction(async (tx) => {
      const p = await tx.browserPolicy.create({
        data: { childId, blockedCategories: defaultCategories(ageOf(child.birthYear)), blockedDomains: [], allowedDomains: [], updatedBy: "eGuard defaults" },
      });
      await tx.browserPolicyVersion.create({ data: { policyId: p.id, version: 1, snapshot: snapshot(p) as Prisma.InputJsonValue, createdBy: "eGuard defaults" } });
      return p;
    });
  } catch {
    // Another request created it first
    return db.browserPolicy.findUniqueOrThrow({ where: { childId } });
  }
}

const sameSettings = (a: BrowserPolicy, b: BrowserPolicyInput) => {
  // Temporary allows aren't part of what the parent edits in the form
  const settings: Record<string, unknown> = { ...snapshot(a), version: 0 };
  delete settings.temporaryAllows;
  return JSON.stringify(canonical(settings)) === JSON.stringify(canonical({ ...b, version: 0 }));
};

export type TemporaryAllow = { domain: string; until: string };

/** Parent-approved temporary exceptions still in force at `now`. */
export function activeTemporaryAllows(p: Pick<BrowserPolicy, "temporaryAllows">, now = new Date()): TemporaryAllow[] {
  const list = Array.isArray(p.temporaryAllows) ? (p.temporaryAllows as TemporaryAllow[]) : [];
  return list.filter((t) => typeof t?.domain === "string" && Date.parse(t.until) > now.getTime());
}

/**
 * Writes the next version: optimistic on `current.version`, so two parents saving at once can't both become N+1,
 * and snapshotted. Expired temporary allows are dropped on every write.
 */
async function writeVersion(current: BrowserPolicy, data: Prisma.BrowserPolicyUpdateManyMutationInput, actorName: string) {
  return db.$transaction(async (tx) => {
    const res = await tx.browserPolicy.updateMany({
      where: { id: current.id, version: current.version },
      data: { temporaryAllows: activeTemporaryAllows(current), ...data, version: { increment: 1 }, updatedBy: actorName },
    });
    if (!res.count) throw new ServiceError(409, "Someone else changed these settings just now. Reload to see their changes.", "conflict");
    const p = await tx.browserPolicy.findUniqueOrThrow({ where: { id: current.id } });
    await tx.browserPolicyVersion.create({ data: { policyId: p.id, version: p.version, snapshot: snapshot(p) as Prisma.InputJsonValue, createdBy: actorName } });
    return p;
  });
}

/**
 * Lets a child open `domain`: until `until`, or for good (`until` null: moved to the allowed list and off the
 * blocked list). Used by access-request approvals. A new version, like any other change.
 */
export async function allowDomain(childId: string, domain: string, until: Date | null, actorName: string) {
  // It only adds this one site, so when another change landed first (two approvals at once), re-read and apply it
  // on top instead of failing like a stale form would
  for (let attempt = 0; ; attempt++) {
    const current = await getOrCreateBrowserPolicy(childId);
    try {
      if (!until) {
        return await writeVersion(current, {
          allowedDomains: [...new Set([...current.allowedDomains, domain])].sort(),
          blockedDomains: current.blockedDomains.filter((d) => d !== domain),
        }, actorName);
      }
      const others = activeTemporaryAllows(current).filter((t) => t.domain !== domain);
      return await writeVersion(current, { temporaryAllows: [...others, { domain, until: until.toISOString() }] }, actorName);
    } catch (e) {
      if (!(e instanceof ServiceError && e.status === 409) || attempt >= 4) throw e;
    }
  }
}

/** Saves a parent's change as a new version. Browsers pick it up on their next sync (within 5 minutes). */
/**
 * `baseVersion` is the version the parent was editing. When the policy moved on since (an approved access request,
 * another parent), saving the whole form would quietly undo that change, so it's refused instead.
 */
export async function updateBrowserPolicy(actor: Actor, childId: string, input: BrowserPolicyInput, via: string, baseVersion?: number) {
  const child = await db.child.findFirst({ where: { id: childId, familyId: actor.familyId } });
  if (!child) throw notFound("Child");
  const current = await getOrCreateBrowserPolicy(childId);
  if (sameSettings(current, input)) return current;
  if (baseVersion != null && baseVersion !== current.version) {
    throw new ServiceError(409, "These settings changed since you opened them, for example an approved request or another parent's edit. Load the latest settings, then make your change again.", "stale_version");
  }

  const next = await writeVersion(current, { ...input, schedule: input.schedule ?? Prisma.DbNull }, actor.name);

  await audit(actor.familyId, actor.name, "browser.policy.updated", `${child.name}: v${current.version} → v${next.version}`);
  await db.configChange.create({
    data: {
      familyId: actor.familyId, childId, key: "WEB", title: "Browser protection changed",
      actor: `${actor.name} on ${via} · applies on next browser sync`,
      fromValue: describeBrowserPolicy(current), toValue: describeBrowserPolicy(next),
    },
  });
  return next;
}

export function describeBrowserPolicy(p: Pick<BrowserPolicy, "blockedCategories" | "blockedDomains" | "allowedDomains" | "safeSearch">) {
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  return [
    n(p.blockedCategories.length, "category", "categories"),
    n(p.blockedDomains.length, "blocked site", "blocked sites"),
    n(p.allowedDomains.length, "allowed site", "allowed sites"),
    p.safeSearch ? "SafeSearch on" : "SafeSearch off",
  ].join(", ");
}

/* ---------- Signing ---------- */

/** JSON with object keys sorted at every level and no whitespace: the exact bytes that are signed. */
export function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object" && !(v instanceof Date)) {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical((v as Record<string, unknown>)[k])]));
  }
  return v;
}
export const canonicalJson = (v: unknown) => JSON.stringify(canonical(v));

let key: { priv: KeyObject; keyId: string } | null = null;

/**
 * BROWSER_POLICY_SIGNING_KEY: base64 of a PKCS#8 (DER) ECDSA P-256 private key; generate one with
 * `node scripts/browser-policy-keys.mjs`. The matching public key is built into the extension.
 */
function signingKey() {
  if (key) return key;
  const raw = process.env.BROWSER_POLICY_SIGNING_KEY;
  if (!raw) throw new ServiceError(503, "eGuard can't send browser settings right now. Try again later.", "signing_not_configured");
  const priv = createPrivateKey({ key: Buffer.from(raw, "base64"), format: "der", type: "pkcs8" });
  const spki = createPublicKey(priv).export({ format: "der", type: "spki" });
  key = { priv, keyId: createHash("sha256").update(spki).digest("hex").slice(0, 16) };
  return key;
}

/** ECDSA P-256 / SHA-256 over the canonical JSON, as raw r||s (what WebCrypto verifies). */
export function signPolicy(policy: object) {
  const k = signingKey();
  const signature = sign("sha256", Buffer.from(canonicalJson(policy)), { key: k.priv, dsaEncoding: "ieee-p1363" }).toString("base64");
  return { signature, keyId: k.keyId };
}

/** The policy for one installation, as the extension receives it. */
export async function policyForInstallation(inst: Pick<BrowserInstallation, "id" | "childId" | "familyId">) {
  const [p, family] = await Promise.all([
    getOrCreateBrowserPolicy(inst.childId),
    db.family.findUniqueOrThrow({ where: { id: inst.familyId }, select: { timezone: true } }),
  ]);
  const schedule = p.schedule as { enabled: boolean; startTime: string; endTime: string } | null;
  const policy = {
    id: p.id, childId: p.childId, installationId: inst.id, version: p.version,
    safeBrowsing: p.safeBrowsing, safeSearch: p.safeSearch,
    blockedCategories: p.blockedCategories, blockedDomains: p.blockedDomains, allowedDomains: p.allowedDomains,
    unknownSitesPolicy: p.unknownSitesPolicy,
    schedule: schedule ? { enabled: schedule.enabled, startTime: schedule.startTime, endTime: schedule.endTime, timezone: family.timezone } : null,
    temporaryAllows: activeTemporaryAllows(p),
    // Only the lists the family blocks, so the extension never holds categories it doesn't use
    categoryDomains: Object.fromEntries(
      p.blockedCategories
        .map((c) => [c, [...categoryDomains(c as WebCategory)]] as const)
        .filter(([, list]) => list.length),
    ),
    updatedAt: p.updatedAt.toISOString(),
  };
  return { policy, ...signPolicy(policy) };
}
