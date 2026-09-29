import "server-only";
import type { BrowserInstallation, Child } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { audit } from "./audit";
import { ServiceError, notFound } from "./errors";
import { enforce } from "./rate-limit";
import { allowDomain, normalizeDomain } from "./browser-policy";
import { browserLabel } from "./browser-service";
import type { Actor } from "./config-service";

/**
 * A child asks, from the extension's block page, to open a blocked site; a parent approves (for a while or
 * always) or denies. Approval becomes a new policy version, so it reaches the browser like any other change.
 */

export const DURATIONS = ["15M", "1H", "TODAY", "ALWAYS"] as const;
export type Duration = (typeof DURATIONS)[number];
export const DURATION_LABEL: Record<Duration, string> = { "15M": "15 minutes", "1H": "1 hour", TODAY: "the rest of today", ALWAYS: "always" };

export const Decision = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE"), duration: z.enum(DURATIONS) }),
  z.object({ decision: z.literal("DENY") }),
]);
export type Decision = z.infer<typeof Decision>;

const REQUESTS_PER_HOUR = { max: 10, windowMs: 3600_000 };

/** Midnight at the end of today in `timeZone` (the family's). */
export function endOfDay(timeZone: string, now = new Date()) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
  }
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const elapsed = (n("hour") * 3600 + n("minute") * 60 + n("second")) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() + 86_400_000 - elapsed);
}

function untilFor(duration: Duration, timeZone: string, now = new Date()): Date | null {
  switch (duration) {
    case "15M": return new Date(now.getTime() + 15 * 60_000);
    case "1H": return new Date(now.getTime() + 60 * 60_000);
    case "TODAY": return endOfDay(timeZone, now);
    case "ALWAYS": return null;
  }
}

/** From the browser. Asking again for the same site while a request is open returns the open one. */
export async function createAccessRequest(inst: BrowserInstallation & { child: Child }, input: { domain: string; reason?: string | null }) {
  const domain = normalizeDomain(input.domain);
  if (!domain) throw new ServiceError(400, "That isn't a website address.", "invalid_domain");
  const reason = input.reason?.trim().slice(0, 280) || null;

  const open = await db.browserAccessRequest.findFirst({ where: { childId: inst.childId, domain, status: "PENDING" } });
  if (open) return { request: open, created: false };
  await enforce(`webreq:${inst.id}`, REQUESTS_PER_HOUR, "You've sent several requests. Wait a little before asking again.");

  const request = await db.browserAccessRequest.create({
    data: { familyId: inst.familyId, childId: inst.childId, installationId: inst.id, domain, reason },
  });
  await db.alert.create({
    data: {
      familyId: inst.familyId, childId: inst.childId, severity: "ATTENTION", category: "PROTECTION", icon: "globe",
      title: "Website access request", subject: `${inst.child.name}'s ${browserLabel(inst)}`,
      body: `${inst.child.name} asked to open ${domain}${reason ? `: "${reason}"` : "."}`,
      resolveKey: `WEBREQ:${request.id}`,
    },
  });
  return { request, created: true };
}

export const requestJson = (r: { id: string; domain: string; reason: string | null; status: string; duration: string | null; expiresAt: Date | null; createdAt: Date; decidedAt: Date | null; decidedBy?: string | null }) => ({
  id: r.id, domain: r.domain, reason: r.reason, status: r.status, duration: r.duration,
  expiresAt: r.expiresAt, createdAt: r.createdAt, decidedAt: r.decidedAt, decidedBy: r.decidedBy ?? null,
});

/** What this browser asked for recently, so the block page can say "waiting for a parent" or "approved". */
export function requestsForInstallation(inst: Pick<BrowserInstallation, "id" | "childId">) {
  return db.browserAccessRequest.findMany({ where: { childId: inst.childId, installationId: inst.id }, orderBy: { createdAt: "desc" }, take: 20 });
}

/** Open requests first, then the most recent answered ones. */
export async function requestsForChild(actor: Actor, childId: string) {
  const child = await db.child.findFirst({ where: { id: childId, familyId: actor.familyId }, select: { id: true } });
  if (!child) throw notFound("Child");
  const [pending, recent] = await Promise.all([
    db.browserAccessRequest.findMany({ where: { childId, status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    db.browserAccessRequest.findMany({ where: { childId, status: { not: "PENDING" } }, orderBy: { decidedAt: "desc" }, take: 10 }),
  ]);
  return { pending, recent };
}

export async function decideAccessRequest(actor: Actor, requestId: string, d: Decision, via: string) {
  const req = await db.browserAccessRequest.findFirst({ where: { id: requestId, familyId: actor.familyId }, include: { child: { include: { family: true } } } });
  if (!req) throw notFound("Request");
  if (req.status !== "PENDING") throw new ServiceError(409, "This request was already answered.", "already_decided");
  const now = new Date();

  let expiresAt: Date | null = null;
  if (d.decision === "APPROVE") {
    expiresAt = untilFor(d.duration, req.child.family.timezone, now);
    await allowDomain(req.childId, req.domain, expiresAt, actor.name);
  }
  // Only the first answer counts (two parents answering at once)
  const res = await db.browserAccessRequest.updateMany({
    where: { id: req.id, status: "PENDING" },
    data: {
      status: d.decision === "APPROVE" ? "APPROVED" : "DENIED", duration: d.decision === "APPROVE" ? d.duration : null,
      expiresAt, decidedBy: actor.name, decidedAt: now,
    },
  });
  if (!res.count) throw new ServiceError(409, "This request was already answered.", "already_decided");

  await db.alert.updateMany({ where: { familyId: actor.familyId, resolveKey: `WEBREQ:${req.id}`, resolvedAt: null }, data: { resolvedAt: now } });
  const what = d.decision === "APPROVE" ? `${req.domain} (${DURATION_LABEL[d.duration]})` : req.domain;
  await audit(actor.familyId, actor.name, d.decision === "APPROVE" ? "browser.access.approved" : "browser.access.denied", `${req.child.name}: ${what}`);
  await db.configChange.create({
    data: {
      familyId: actor.familyId, childId: req.childId, key: "WEB",
      title: d.decision === "APPROVE" ? `Allowed ${what}` : `Declined ${req.domain}`,
      actor: `${actor.name} on ${via}${d.decision === "APPROVE" ? " · applies on next browser sync" : ""}`,
    },
  });
  return db.browserAccessRequest.findUniqueOrThrow({ where: { id: req.id } });
}
