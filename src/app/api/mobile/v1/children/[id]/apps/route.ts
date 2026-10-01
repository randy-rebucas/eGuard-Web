import { NextResponse } from "next/server";
import { z } from "zod";
import type { AppApproval } from "@prisma/client";
import { db } from "@/lib/db";
import { childFor } from "@/lib/config-service";
import { APPROVAL_LABEL, audit, requestedApps } from "@/lib/family-service";
import { conflict, isUniqueViolation } from "@/lib/errors";
import { appMinutesOn, dateFromKey, dayKey, getFamily } from "@/lib/queries";
import { authed, body, clientLabel, query } from "@/lib/mobile-api";
import { APPS_UPGRADE, familyEntitlements, visibleApps } from "@/lib/plan-access";

const APPROVALS = ["ALLOWED", "ALWAYS_ALLOWED", "FILTERED", "BLOCKED", "PENDING"] as const;
const Query = z.object({ filter: z.enum(["all", "installed", "blocked", "pending"]).default("all") });

/**
 * App Management. `installed` = everything not blocked; `pending` = waiting for the parent's approval
 * (new apps, and blocked apps the child asked for again, which stay blocked and have `requested: true`).
 * On Free only a few apps are listed (waiting ones first, then the most used); `limited` says how many more there are.
 */
export const GET = authed<{ id: string }>(async ({ req, user, params }) => {
  const { filter } = query(req, Query);
  const child = await childFor(user.familyId, params.id);
  const family = await getFamily(user.familyId);
  const requested = await requestedApps(child.id);
  const where = filter === "blocked" ? { approval: "BLOCKED" as AppApproval }
    : filter === "pending" ? { OR: [{ approval: "PENDING" as AppApproval }, { name: { in: [...requested] } }] }
    : filter === "installed" ? { approval: { not: "BLOCKED" as AppApproval } } : {};
  const [all, usage, counts, pending, plan] = await Promise.all([
    db.childApp.findMany({ where: { childId: child.id, ...where }, orderBy: [{ approval: "asc" }, { name: "asc" }] }),
    appMinutesOn([child.id], dateFromKey(dayKey(new Date(), family.timezone))),
    db.childApp.groupBy({ by: ["approval"], where: { childId: child.id }, _count: true }),
    db.childApp.count({ where: { childId: child.id, OR: [{ approval: "PENDING" }, { name: { in: [...requested] } }] } }),
    familyEntitlements(user.familyId),
  ]);
  const { apps, hidden } = visibleApps(all, plan.appMonitoringLimit, { requested, minutes: (n) => usage.find((u) => u.app === n)?.minutes ?? 0 });
  const count = (a: AppApproval) => counts.find((c) => c.approval === a)?._count ?? 0;
  return NextResponse.json({
    counts: { all: counts.reduce((s, c) => s + c._count, 0), blocked: count("BLOCKED"), pending, installed: counts.reduce((s, c) => s + c._count, 0) - count("BLOCKED") },
    apps: apps.map((a) => ({
      id: a.id, name: a.name, approval: a.approval, approvalLabel: APPROVAL_LABEL[a.approval],
      /** true while the child's request waits for the parent (approve with ALLOWED, decline with BLOCKED) */
      requested: a.approval === "PENDING" || requested.has(a.name),
      /** convenience for the on/off switch */
      allowed: a.approval !== "BLOCKED" && a.approval !== "PENDING",
      dailyLimitMinutes: a.dailyLimitMinutes, todayMinutes: usage.find((u) => u.app === a.name)?.minutes ?? 0,
      installedAt: a.installedAt,
    })),
    limited: hidden ? { hidden, message: APPS_UPGRADE } : null,
  });
});

const Body = z.object({
  name: z.string().trim().min(1, "Enter the app's name.").max(80),
  approval: z.enum(APPROVALS).default("ALLOWED"),
  dailyLimitMinutes: z.number().int().min(1).max(1440).nullable().optional(),
});

/**
 * "Request to Install App": the parent adds an app to the child's list ahead of time (pre-approved,
 * limited, or blocked). Devices pick up app rules on their next sync.
 */
export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, Body);
  const child = await childFor(user.familyId, params.id);
  const taken = () => conflict(`${b.name} is already on ${child.name}'s list.`);
  if (await db.childApp.findUnique({ where: { childId_name: { childId: child.id, name: b.name } } })) throw taken();
  // A double tap (or the device reporting the app at the same moment) passes the check above twice
  const app = await db.childApp.create({ data: { childId: child.id, name: b.name, approval: b.approval, dailyLimitMinutes: b.dailyLimitMinutes ?? null } })
    .catch((e) => { throw isUniqueViolation(e) ? taken() : e; });
  await db.configChange.create({
    data: {
      familyId: user.familyId, childId: child.id, key: "APP_RESTRICTIONS", title: `${app.name} added as ${APPROVAL_LABEL[app.approval]}`,
      actor: `${user.name} on ${clientLabel(req)} · applies on next sync`, toValue: APPROVAL_LABEL[app.approval],
    },
  });
  await audit(user.familyId, user.name, "app.added", `${app.name} for ${child.name}`);
  return NextResponse.json({ id: app.id, name: app.name, approval: app.approval, approvalLabel: APPROVAL_LABEL[app.approval], dailyLimitMinutes: app.dailyLimitMinutes }, { status: 201 });
});
