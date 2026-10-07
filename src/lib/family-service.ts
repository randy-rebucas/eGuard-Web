import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import type { AppApproval, AppCategory, PairingKind, Prisma } from "@prisma/client";
import { db } from "./db";
import { PASSWORD_TOO_LONG, confirmDestructive, confirmPassword, hashPassword, isPendingInvite, passwordTooLong } from "./auth";
import { refreshPurchases } from "./billing";
import { cancelSubscriptionsBeforeDeletion } from "./web-billing";
import { handOverOrganizations } from "./organizations";
import { audit } from "./audit";
import { profileConfigs, type ProfileId } from "./profiles";
import { fmtMinutes, type ProtectionConfig } from "./protections";
import type { Actor } from "./config-service";
import { conflict, forbidden, invalid, isUniqueViolation, notFound, planLimit, planRequired } from "./errors";
import { requireVerifiedEmail } from "./email-verification";
import { BASE_PLAN, entitlementsFor, nextPlan, planByName } from "./plans";
import { CATEGORY_BY_KEY, CATEGORY_KEYS, CATEGORY_UPGRADE, categoryOf, guessCategory } from "./app-categories";
import { LIMITS, enforce } from "./rate-limit";
import { ensurePrimary, makePrimary, promoteOldest, usedDeviceSlots, withDeviceLock } from "./device-slots";

/** Family, children, apps and devices: shared by the web server actions and the mobile API. */

export { audit };

const requireAdminActor = (a: Actor) => { if (a.role !== "FAMILY_ADMIN") throw forbidden(); };

/** How a parent confirms a deletion: their password, or typing DELETE when they have none (see confirmDestructive). */
export type Confirm = { password?: string; phrase?: string };

/** Longest parent or family name; it appears in emails, alerts and history lines. */
export const NAME_MAX = 80;
export const NAME_TOO_LONG = `Use up to ${NAME_MAX} characters.`;

/* ---------- Children ---------- */

/** Oldest birth year offered is this many years back. */
export const MAX_CHILD_AGE = 18;

export const ChildSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(40),
  // Bounds are read when validating, not when the module loads, so a server running over New Year stays right.
  // Born 18 years ago can still be 17 (birthday later this year); 19 years ago is 18 at least.
  birthYear: z.coerce.number({ error: "Enter a valid birth year." }).int("Enter a valid birth year.")
    .refine((y) => y >= new Date().getFullYear() - MAX_CHILD_AGE, "eGuard is for children under 18.")
    .refine((y) => y <= new Date().getFullYear(), "Enter a valid birth year."),
});
const HUES = [205, 160, 330, 28, 265, 190];

/** Why the family can't add another child, or null if it can. Families over the limit keep the children they have. */
export function childLimitReached(plan: string, count: number) {
  const limit = planByName(plan).entitlements.childLimit;
  if (count < limit) return null;
  const up = nextPlan(plan);
  return `${plan} covers ${limit} ${limit === 1 ? "child" : "children"}.${up ? ` Upgrade to ${up.name} to add up to ${up.entitlements.childLimit}.` : ""}`;
}

/** Creates a child with a full policy from the chosen profile (Protected by default). */
export async function createChild(actor: Actor, input: { name: string; birthYear: number; profile?: ProfileId }) {
  // The limit comes from the plan; make sure a lapsed or refunded subscription is reflected first
  await refreshPurchases(actor.familyId);
  const age = new Date().getFullYear() - input.birthYear;
  const configs = profileConfigs(input.profile ?? "PROTECTED", age);
  const screen = configs.find((c) => c.key === "SCREEN_TIME") as Extract<ProtectionConfig, { key: "SCREEN_TIME" }>;
  const child = await db.$transaction(async (tx) => {
    // One add at a time per family (two parents, or web and app at once): otherwise both pass the count below
    // and the family ends up over its plan's limit. Released when the transaction ends.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`child.create:${actor.familyId}`}))`;
    const [existing, family] = await Promise.all([
      tx.child.findMany({ where: { familyId: actor.familyId }, select: { name: true } }),
      tx.family.findUniqueOrThrow({ where: { id: actor.familyId }, select: { plan: true } }),
    ]);
    const full = childLimitReached(family.plan, existing.length);
    if (full) throw planLimit(full);
    // Most often the same child added twice (two tabs, web and app); a nickname tells real namesakes apart
    if (existing.some((e) => e.name.trim().toLowerCase() === input.name.trim().toLowerCase())) {
      throw conflict(`You already have a child named ${input.name}. If this is another child, add a last initial or nickname.`);
    }
    return tx.child.create({
      data: {
        familyId: actor.familyId, name: input.name, birthYear: input.birthYear, hue: HUES[existing.length % HUES.length],
        dailyLimitMinutes: screen.dailyMinutes, weekendLimitMinutes: screen.weekendMinutes,
        policies: { create: configs.map((c) => ({ key: c.key, config: c as Prisma.InputJsonValue })) },
      },
    });
  });
  await audit(actor.familyId, actor.name, "child.created", child.name);
  return child;
}

/** The "already have a child named …" error when another child in the family uses this name (any case). */
export async function assertNameFree(familyId: string, name: string, exceptChildId?: string) {
  const others = await db.child.findMany({ where: { familyId, ...(exceptChildId ? { id: { not: exceptChildId } } : {}) }, select: { name: true } });
  if (others.some((o) => o.name.trim().toLowerCase() === name.trim().toLowerCase())) {
    throw conflict(`You already have a child named ${name}. Add a last initial or nickname to tell them apart.`);
  }
}

export async function deleteChild(actor: Actor, childId: string, confirm: Confirm) {
  requireAdminActor(actor);
  await confirmDestructive(actor.id, confirm);
  const child = await db.child.findFirst({ where: { id: childId, familyId: actor.familyId } });
  if (!child) throw notFound("Child");
  const [, gone] = await db.$transaction([
    // Codes aren't linked to the child in the schema, so they'd outlive it: a device pairing with one would
    // fail with a database error and use the code up
    db.pairingCode.deleteMany({ where: { childId: child.id, familyId: actor.familyId } }),
    // deleteMany: two deletes at once (two parents, a double tap) make the second a 404, not a database error
    db.child.deleteMany({ where: { id: child.id, familyId: actor.familyId } }),
  ]);
  if (!gone.count) throw notFound("Child");
  await audit(actor.familyId, actor.name, "child.deleted", child.name);
  // Like removing a device, this ends verification and tamper alerts, so the other parents hear about it
  await db.alert.create({
    data: {
      familyId: actor.familyId, severity: "ATTENTION", category: "PROTECTION", icon: "trash", title: "Child removed", subject: child.name,
      body: `${actor.name} removed ${child.name} and their data from eGuard. Protections already on their devices stay, but eGuard no longer verifies them or tells you if they change.`,
    },
  });
  return child;
}

/* ---------- Apps ---------- */

export const APPROVAL_LABEL: Record<AppApproval, string> = {
  ALLOWED: "Allowed", ALWAYS_ALLOWED: "Always allowed", FILTERED: "Filtered", BLOCKED: "Blocked", PENDING: "Pending",
};

/**
 * Names of apps with an open approval request: new apps (PENDING), and blocked apps the child asked for
 * again. A blocked app stays blocked; the parent approves or declines the request.
 */
export async function requestedApps(childId: string) {
  const prefix = `APPREQ:${childId}:`;
  const open = await db.alert.findMany({ where: { childId, resolveKey: { startsWith: prefix }, resolvedAt: null }, select: { resolveKey: true } });
  return new Set(open.map((o) => o.resolveKey!.slice(prefix.length)));
}

async function appFor(familyId: string, appId: string) {
  const app = await db.childApp.findFirst({ where: { id: appId, child: { familyId } } });
  if (!app) throw notFound("App");
  return app;
}

/**
 * Devices pick up app rules on their next sync. Resolves any open approval request for the app, even when
 * the approval doesn't change (declining a child's request for an app that is already blocked).
 */
export async function setAppApproval(actor: Actor, appId: string, approval: AppApproval, via: string) {
  const app = await appFor(actor.familyId, appId);
  const resolveRequest = () =>
    db.alert.updateMany({ where: { familyId: actor.familyId, resolveKey: `APPREQ:${app.childId}:${app.name}`, resolvedAt: null }, data: { resolvedAt: new Date() } });
  if (app.approval === approval) {
    await resolveRequest();
    return app;
  }
  const updated = await db.childApp.update({ where: { id: appId }, data: { approval } });
  await db.configChange.create({
    data: {
      familyId: actor.familyId, childId: app.childId, key: "APP_RESTRICTIONS", title: `${app.name} set to ${APPROVAL_LABEL[approval]}`,
      actor: `${actor.name} on ${via} · applies on next sync`, fromValue: APPROVAL_LABEL[app.approval], toValue: APPROVAL_LABEL[approval],
    },
  });
  await resolveRequest();
  return updated;
}

export async function setAppLimit(actor: Actor, appId: string, minutes: number | null, via: string) {
  const app = await appFor(actor.familyId, appId);
  // Round before the zero test: 0.4 would otherwise be stored as 0, which devices read as "no time at all"
  const rounded = Math.min(1440, Math.round(minutes ?? 0));
  const m = rounded > 0 ? rounded : null;
  if (app.dailyLimitMinutes === m) return app;
  const updated = await db.childApp.update({ where: { id: appId }, data: { dailyLimitMinutes: m } });
  // In the child's history like approvals, so "who changed what" covers limits too
  const label = (v: number | null) => (v ? `${fmtMinutes(v)} a day` : "No limit");
  await db.configChange.create({
    data: {
      familyId: actor.familyId, childId: app.childId, key: "APP_RESTRICTIONS", title: m ? `${app.name} limited to ${fmtMinutes(m)} a day` : `${app.name} limit removed`,
      actor: `${actor.name} on ${via} · applies on next sync`, fromValue: label(app.dailyLimitMinutes), toValue: label(m),
    },
  });
  return updated;
}

/**
 * Sets which category an app counts toward, or (null) goes back to eGuard's guess from its name. Any plan: the
 * category only matters once a category limit is set.
 */
export async function setAppCategory(actor: Actor, appId: string, category: AppCategory | null, via: string) {
  const app = await appFor(actor.familyId, appId);
  if (app.category === category) return app;
  const before = categoryOf(app), after = categoryOf({ name: app.name, category });
  const updated = await db.childApp.update({ where: { id: appId }, data: { category } });
  if (before.category !== after.category) {
    await db.configChange.create({
      data: {
        familyId: actor.familyId, childId: app.childId, key: "APP_RESTRICTIONS", title: `${app.name} counted as ${CATEGORY_BY_KEY[after.category].label}`,
        actor: `${actor.name} on ${via} · applies on next sync`, fromValue: CATEGORY_BY_KEY[before.category].label, toValue: CATEGORY_BY_KEY[after.category].label,
      },
    });
  }
  return updated;
}

/**
 * Minutes per category from a day's app usage (queries.appMinutesOn): each app counts toward its category, and an app
 * that isn't on the child's list yet toward eGuard's guess. "Others" (apps the device didn't name) counts nowhere.
 */
export async function categoryUsage(childId: string, usage: { app: string; minutes: number }[]) {
  const apps = await db.childApp.findMany({ where: { childId }, select: { name: true, category: true } });
  const byName = new Map(apps.map((a) => [a.name, categoryOf(a).category]));
  const total = new Map<AppCategory, number>();
  for (const u of usage) {
    if (u.app === "Others") continue;
    const c = byName.get(u.app) ?? guessCategory(u.app);
    total.set(c, (total.get(c) ?? 0) + u.minutes);
  }
  return total;
}

/** A child's category limits, in APP_CATEGORIES order. */
export const categoryLimits = (childId: string) =>
  db.childCategoryLimit.findMany({ where: { childId }, select: { category: true, dailyLimitMinutes: true } })
    .then((rows) => rows.sort((a, b) => CATEGORY_KEYS.indexOf(a.category) - CATEGORY_KEYS.indexOf(b.category)));

/**
 * A daily limit for all of a child's apps in a category together ("Gaming time"), or null to remove it. Needs a
 * plan with category limits; removing one works on any plan. Devices get it on their next sync.
 */
export async function setCategoryLimit(actor: Actor, childId: string, category: AppCategory, minutes: number | null, via: string) {
  const child = await db.child.findFirst({ where: { id: childId, familyId: actor.familyId }, select: { id: true, family: { select: { plan: true } } } });
  if (!child) throw notFound("Child");
  const rounded = Math.min(1440, Math.round(minutes ?? 0));
  const m = rounded > 0 ? rounded : null;
  if (m != null && !entitlementsFor(child.family.plan).categoryLimits) throw planRequired(CATEGORY_UPGRADE);
  const where = { childId_category: { childId, category } };
  const current = await db.childCategoryLimit.findUnique({ where });
  if ((current?.dailyLimitMinutes ?? null) === m) return { category, dailyLimitMinutes: m };
  if (m == null) await db.childCategoryLimit.delete({ where });
  else await db.childCategoryLimit.upsert({ where, create: { childId, category, dailyLimitMinutes: m }, update: { dailyLimitMinutes: m } });
  const label = (v: number | null) => (v ? `${fmtMinutes(v)} a day` : "No limit");
  const name = CATEGORY_BY_KEY[category].limitLabel;
  await db.configChange.create({
    data: {
      familyId: actor.familyId, childId, key: "APP_RESTRICTIONS", title: m ? `${name} limited to ${fmtMinutes(m)} a day` : `${name} limit removed`,
      actor: `${actor.name} on ${via} · applies on next sync`, fromValue: label(current?.dailyLimitMinutes ?? null), toValue: label(m),
    },
  });
  return { category, dailyLimitMinutes: m };
}

/* ---------- Devices ---------- */

export const PairingOptions = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("DEVICE") }),
  z.object({ kind: z.literal("BROWSER"), deviceLabel: z.string().trim().min(1, "Enter the computer's name, like Mia's MacBook.").max(60) }),
]);
export type PairingOptions = z.infer<typeof PairingOptions>;

/** How long a pairing code works. */
export const PAIRING_CODE_TTL_S = 15 * 60;

/**
 * A one-time code the child's device (or browser, for BROWSER codes) exchanges for its credentials. Only the
 * newest code of each kind for a child works: getting another replaces it, so at most two guessable codes per child
 * (one for the phone app, one for the browser extension) are ever live.
 */
export async function createPairingCode(actor: Actor, childId: string, opts: PairingOptions = { kind: "DEVICE" }) {
  // The device limit comes from the plan; make sure a lapsed or refunded subscription is reflected first
  await refreshPurchases(actor.familyId);
  const [child, family, count] = await Promise.all([
    db.child.findFirst({ where: { id: childId, familyId: actor.familyId } }),
    db.family.findUniqueOrThrow({ where: { id: actor.familyId } }),
    usedDeviceSlots(actor.familyId),
  ]);
  if (!child) throw notFound("Child");
  await requireVerifiedEmail(actor.id);
  if (count >= family.deviceLimit) {
    const up = nextPlan(family.plan);
    throw planLimit(`${family.plan} covers ${family.deviceLimit} devices. Remove a device${up ? ` or upgrade to ${up.name}` : ""} to add another.`);
  }
  await enforce(`paircode:${actor.id}`, LIMITS.pairCodeUser, "You've made several pairing codes. Wait a few minutes before making another.");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_S * 1000);
  await db.$transaction([
    // Replaces only the same kind: the Devices page offers a phone code and a browser code side by side
    db.pairingCode.deleteMany({ where: { childId, usedAt: null, kind: opts.kind as PairingKind } }),
    db.pairingCode.create({
      data: { familyId: actor.familyId, childId, code, expiresAt, kind: opts.kind as PairingKind, deviceLabel: opts.kind === "BROWSER" ? opts.deviceLabel : null },
    }),
  ]);
  // expiresInSeconds: screens count down from this, not from expiresAt, so a device clock that's off doesn't matter
  return { code, expiresAt, expiresInSeconds: PAIRING_CODE_TTL_S, childName: child.name, kind: opts.kind };
}

/**
 * Whether a pairing code has been used yet, so the parent's screen can say "Paired" without a refresh.
 * `device` is the device that joined the child with it (paired right after the code was claimed).
 */
export async function pairingCodeStatus(actor: Actor, code: string) {
  const p = await db.pairingCode.findFirst({ where: { code, familyId: actor.familyId } });
  if (!p) return { status: "replaced" as const };
  if (!p.usedAt) return { status: p.expiresAt < new Date() ? ("expired" as const) : ("waiting" as const), expiresAt: p.expiresAt };
  if (p.kind === "BROWSER") {
    const b = await db.browserInstallation.findFirst({
      where: { childId: p.childId, createdAt: { gte: p.usedAt } }, orderBy: { createdAt: "asc" }, select: { id: true, browser: true, deviceLabel: true },
    });
    return b ? { status: "paired" as const, device: { id: b.id, name: `${b.browser} on ${b.deviceLabel}`, kind: "BROWSER" as const } } : { status: "waiting" as const, expiresAt: p.expiresAt };
  }
  const device = await db.device.findFirst({
    where: { childId: p.childId, createdAt: { gte: p.usedAt } }, orderBy: { createdAt: "asc" }, select: { id: true, name: true },
  });
  // Claimed but the device isn't created yet (or the plan was full and the code is about to be released)
  return device ? { status: "paired" as const, device } : { status: "waiting" as const, expiresAt: p.expiresAt };
}

export const DeviceName = z.string().trim().min(1, "Enter a device name.").max(60, "Use up to 60 characters.");

/** Renames a phone or tablet; in the audit log like removing, so "who renamed it" has an answer. */
export async function renameDevice(actor: Actor, deviceId: string, name: string) {
  const d = await db.device.findFirst({ where: { id: deviceId, familyId: actor.familyId }, include: { child: true } });
  if (!d) throw notFound("Device");
  if (d.name === name) return d;
  // updateMany: removed by another parent in the meantime is a 404, not a Prisma error
  if (!(await db.device.updateMany({ where: { id: d.id, familyId: actor.familyId }, data: { name } })).count) throw notFound("Device");
  await audit(actor.familyId, actor.name, "device.renamed", `${d.child.name}'s ${d.name} → ${name}`);
  return { ...d, name };
}

/** Makes a phone or tablet its child's primary device: listed first, and the one on the child's card. */
export async function setPrimaryDevice(actor: Actor, deviceId: string) {
  const d = await db.device.findFirst({ where: { id: deviceId, familyId: actor.familyId }, include: { child: true } });
  if (!d) throw notFound("Device");
  if (d.isPrimary) return d;
  if (!(await makePrimary(actor.familyId, d.childId, d.id))) throw notFound("Device");
  await audit(actor.familyId, actor.name, "device.primary", `${d.child.name}'s ${d.name}`);
  return { ...d, isPrimary: true };
}

/** A configuration request the device hasn't finished: it was for the old child's protections. */
const OPEN_REQUESTS = ["PENDING", "AWAITING_PARENT", "DELIVERED"] as const;

/**
 * Moves a phone or tablet to another child in the family, without pairing it again. From its next sync it gets
 * the new child's protections and apps. Needs the password (or DELETE), like removing: moving a device to a child
 * with looser rules would otherwise be a quiet way to lift them, so the other parents are told too.
 *
 * What it recorded stays with the old child: its screen time, app usage and places are detached from the device
 * (as when it's removed), so new usage starts fresh rows for the new child. Its reported protections are cleared,
 * since they were checked against the old child's settings, and a full report is requested; until it arrives the
 * device reads "Waiting for first check". Its last position is cleared, so the old child's whereabouts aren't
 * shown as the new child's.
 */
export async function moveDevice(actor: Actor, deviceId: string, childId: string, confirm: Confirm) {
  const [d, to] = await Promise.all([
    db.device.findFirst({ where: { id: deviceId, familyId: actor.familyId }, include: { child: true } }),
    db.child.findFirst({ where: { id: childId, familyId: actor.familyId } }),
  ]);
  if (!d) throw notFound("Device");
  if (!to) throw notFound("Child");
  if (to.id === d.childId) throw invalid(`${d.name} already belongs to ${to.name}.`);
  await confirmDestructive(actor.id, confirm);
  const now = new Date();
  const moved = await withDeviceLock(actor.familyId, async (tx) => {
    // Removed or moved by another parent since it was read: don't move it from a child it no longer belongs to
    const cur = await tx.device.findFirst({ where: { id: d.id, familyId: actor.familyId }, select: { childId: true, isPrimary: true } });
    if (!cur || cur.childId !== d.childId) return false;
    const mine = { where: { deviceId: d.id } };
    await tx.screenTimeDaily.updateMany({ ...mine, data: { deviceId: null } });
    await tx.appUsageDaily.updateMany({ ...mine, data: { deviceId: null } });
    await tx.locationVisit.updateMany({ ...mine, data: { deviceId: null } });
    await tx.deviceProtection.deleteMany(mine);
    await tx.deviceLocation.updateMany({ ...mine, data: { lat: null, lng: null, accuracyM: null, placeLabel: null, placeId: null, locatedAt: null } });
    await tx.configRequest.updateMany({ where: { deviceId: d.id, status: { in: [...OPEN_REQUESTS] } }, data: { status: "CANCELLED" } });
    // Its open alerts name the old child and their settings
    await tx.alert.updateMany({ where: { familyId: actor.familyId, deviceId: d.id, resolvedAt: null }, data: { resolvedAt: now } });
    const toHasPrimary = await tx.device.count({ where: { childId: to.id, isPrimary: true } });
    await tx.device.update({ where: { id: d.id }, data: { childId: to.id, isPrimary: !toHasPrimary, checkRequestedAt: now } });
    if (cur.isPrimary) await promoteOldest(tx, d.childId);
    return true;
  });
  if (!moved) throw notFound("Device");
  await audit(actor.familyId, actor.name, "device.moved", `${d.name}: ${d.child.name} → ${to.name}`);
  await db.alert.create({
    data: {
      familyId: actor.familyId, childId: to.id, deviceId: d.id, severity: "ATTENTION", category: "DEVICES", icon: "tablet-smartphone",
      title: "Device moved", subject: `${to.name}'s ${d.name}`,
      body: `${actor.name} moved ${d.name} from ${d.child.name} to ${to.name}. It gets ${to.name}'s protections on its next sync, and eGuard checks them then. What it recorded stays in ${d.child.name}'s reports and history.`,
    },
  });
  return { ...d, childId: to.id, child: to };
}

/**
 * Removes a device from the family. Its token stops working and eGuard stops verifying it, which would also
 * silence tamper alerts, so it needs the parent's password and tells the family (the alert is emailed).
 * The screen time, app usage and location visits it recorded stay with the child (their deviceId becomes null)
 * unless the parent chose `deleteHistory`.
 */
export async function removeDevice(actor: Actor, deviceId: string, confirm: Confirm, opts: { deleteHistory?: boolean } = {}) {
  const d = await db.device.findFirst({ where: { id: deviceId, familyId: actor.familyId }, include: { child: true } });
  if (!d) throw notFound("Device");
  await confirmDestructive(actor.id, confirm);
  const history = { where: { deviceId: d.id, childId: d.childId } };
  const results = await db.$transaction([
    // First, while the rows still carry the device's id: deleting the device sets it to null on them
    ...(opts.deleteHistory ? [db.screenTimeDaily.deleteMany(history), db.appUsageDaily.deleteMany(history), db.locationVisit.deleteMany(history)] : []),
    // deleteMany: another parent removing it at the same moment is a 404 here, not a Prisma error
    db.device.deleteMany({ where: { id: d.id } }),
    // Alerts only hold the device's id, so its open ones (offline, protection changed) would never resolve
    db.alert.updateMany({ where: { familyId: actor.familyId, deviceId: d.id, resolvedAt: null }, data: { resolvedAt: new Date() } }),
  ]);
  const gone = results.at(-2)!; // the device delete: last comes the alerts update
  if (!gone.count) throw notFound("Device");
  if (d.isPrimary) await ensurePrimary(actor.familyId, d.childId);
  const label = `${d.child.name}'s ${d.name}`;
  await audit(actor.familyId, actor.name, opts.deleteHistory ? "device.removed_with_history" : "device.removed", label);
  await db.alert.create({
    data: {
      familyId: actor.familyId, childId: d.childId, severity: "ATTENTION", category: "DEVICES", icon: "trash",
      title: "Device removed", subject: label,
      // Other parents are told what happened to the history too, since it can't be undone
      body: `${actor.name} removed ${d.name} from eGuard. Its protections stay on the device, but eGuard no longer verifies them or tells you if they change. ${opts.deleteHistory
        ? `The screen time, app usage and places it recorded were deleted.`
        : `The screen time, app usage and places it recorded stay in ${d.child.name}'s reports and history.`}`,
    },
  });
  return d;
}

/* ---------- Account ---------- */

export async function changePassword(actor: Actor & { sessionId: string }, current: string, next: string) {
  if (next.length < 10) throw invalid("Use at least 10 characters for your new password.");
  if (passwordTooLong(next)) throw invalid(PASSWORD_TOO_LONG);
  await confirmPassword(actor.id, current);
  await db.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(next), passwordChangedAt: new Date() } });
  await db.session.deleteMany({ where: { userId: actor.id, id: { not: actor.sessionId } } });
  await audit(actor.familyId, actor.name, "password.changed");
}

/**
 * Changes the parent's email. Needs their password, so a stolen session can't move the account to
 * an address the thief controls. The new address is unverified until its link is opened, and Apple/Google
 * sign-ins linked under the old address are unlinked.
 */
export async function changeEmail(actor: Actor, email: string, password: string) {
  const current = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (email === current.email) return false;
  const taken = () => conflict("Another account already uses this email.");
  if (await userIdForMailbox(email, actor.id)) throw taken();
  await confirmPassword(actor.id, password);
  await db.$transaction([
    db.user.update({ where: { id: actor.id }, data: { email, emailVerifiedAt: null } }),
    db.oAuthIdentity.deleteMany({ where: { userId: actor.id } }),
    db.emailVerification.deleteMany({ where: { userId: actor.id } }),
    db.passwordReset.deleteMany({ where: { userId: actor.id } }),
  ]).catch((e) => { throw isUniqueViolation(e) ? taken() : e; });
  await audit(actor.familyId, actor.name, "email.changed", `${current.email} → ${email}`);
  return true;
}

/** Linked Apple/Google sign-ins (Privacy & security). */
export const listIdentities = (userId: string) =>
  db.oAuthIdentity.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, provider: true, email: true, createdAt: true } });

/** Unlinks an Apple/Google sign-in, unless it's the only way left to sign in. */
export async function unlinkIdentity(actor: Actor, identityId: string) {
  const target = await db.$transaction(async (tx) => {
    // One unlink at a time per parent: unlinking Apple and Google at once would otherwise both see "another
    // sign-in is left" and remove the last way into an account with no password
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`identities:${actor.id}`}))`;
    const [user, identities] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: actor.id } }),
      tx.oAuthIdentity.findMany({ where: { userId: actor.id }, select: { id: true, provider: true } }),
    ]);
    const t = identities.find((i) => i.id === identityId);
    if (!t) throw notFound("Sign-in");
    if (!user.passwordSet && identities.length === 1) {
      throw conflict("This is your only way to sign in. Set a password first (sign out, then “Forgot password?”).");
    }
    await tx.oAuthIdentity.delete({ where: { id: t.id } });
    return t;
  });
  await audit(actor.familyId, actor.name, "identity.unlinked", target.provider);
}

/**
 * Deletes the signed-in parent's account. The family admin's account takes the whole family with it
 * (children, devices, history, other parents) and first cancels any PayMongo auto-renew; another parent's
 * account removes only them. Needs the password, or for Apple/Google accounts without one, typing DELETE.
 */
export async function deleteAccount(actor: Actor, confirm: Confirm) {
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  await confirmDestructive(actor.id, confirm);
  if (actor.role === "FAMILY_ADMIN") {
    await cancelSubscriptionsBeforeDeletion(actor.familyId);
    const members = await db.user.findMany({ where: { familyId: actor.familyId }, select: { id: true } });
    await handOverOrganizations(members.map((m) => m.id));
    await db.family.delete({ where: { id: actor.familyId } });
    return { deleted: "family" as const };
  }
  await handOverOrganizations([actor.id]);
  await db.user.delete({ where: { id: actor.id } });
  await audit(actor.familyId, actor.name, "member.left", user.email);
  return { deleted: "account" as const };
}

/** Who the family admin invites. Children never get an account; another parent or guardian does. */
export const InviteSchema = z.object({
  name: z.string().trim().min(2, "Enter their name.").max(NAME_MAX, NAME_TOO_LONG),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export { isPendingInvite };

/**
 * Before an account is created for `email` by its owner (sign-up, Apple/Google): an invitation waiting at that
 * address is dropped, so nobody is put in a family they didn't choose and an invitation can't hold an address hostage.
 */
export async function dropPendingInvite(email: string) {
  const id = await userIdForMailbox(email);
  if (!id) return false;
  const u = await db.user.findUnique({ where: { id } });
  if (!u || !isPendingInvite(u)) return false;
  const r = await db.user.deleteMany({ where: { id: u.id, role: "PARENT", passwordSet: false, emailVerifiedAt: null } });
  if (r.count) await audit(u.familyId, "eGuard", "member.invite_dropped", `${u.email} created their own eGuard account`);
  return r.count > 0;
}

export async function removeParent(actor: Actor, userId: string) {
  requireAdminActor(actor);
  if (userId === actor.id) throw invalid("You can't remove yourself.");
  const parent = await db.user.findFirst({ where: { id: userId, familyId: actor.familyId, role: "PARENT" } });
  if (!parent) throw notFound("Family member");
  await handOverOrganizations([userId]);
  const r = await db.user.deleteMany({ where: { id: userId, familyId: actor.familyId, role: "PARENT" } });
  if (!r.count) throw notFound("Family member");
  // Name the person: the id means nothing in the audit log once their account is gone
  await audit(actor.familyId, actor.name, isPendingInvite(parent) ? "member.invite_withdrawn" : "member.removed", `${parent.name} (${parent.email})`);
}

/* ---------- Registration ---------- */

export const GUARDIAN_REQUIRED = "Confirm you're a parent or legal guardian, 18 or older.";

/**
 * The account already using this mailbox, matching aliases too: "R.andy+kids@gmail.com" finds randy@gmail.com.
 * Uses email_key() from the email_uniqueness migration, whose unique index backs this up under races.
 */
export async function userIdForMailbox(email: string, exceptUserId = "") {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE email_key(email) = email_key(${email}) AND id <> ${exceptUserId} LIMIT 1`;
  return rows[0]?.id ?? null;
}

export const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(NAME_MAX, NAME_TOO_LONG),
  familyName: z.string().trim().min(2, "Enter a family name.").max(NAME_MAX, NAME_TOO_LONG),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters for your password.").refine((p) => !passwordTooLong(p), PASSWORD_TOO_LONG),
  /** Accounts are for parents and guardians only; children are added by a parent, never sign up */
  guardian: z.literal(true, { error: GUARDIAN_REQUIRED }),
});

/**
 * Creates a family and its admin. Callers must have had the person confirm they're a parent or
 * guardian (18+); it's recorded in the audit log. `passwordHash` lets social sign-up pass an unusable hash,
 * and `emailVerified` marks an email the provider already verified. Otherwise, send a verification email.
 */
export async function createFamily(input: { name: string; familyName: string; email: string; passwordHash: string; emailVerified?: boolean; passwordSet?: boolean }) {
  const taken = () => conflict("An account with this email already exists. Sign in instead.");
  await dropPendingInvite(input.email);
  if (await userIdForMailbox(input.email)) throw taken();
  // Family and admin are created in one statement, so a lost race leaves no empty family behind.
  // The base plan is free and has no renewal date; a store purchase sets one.
  const family = await db.family.create({
    data: {
      name: input.familyName, plan: BASE_PLAN, deviceLimit: planByName(BASE_PLAN).entitlements.deviceLimit, renewsAt: null,
      users: { create: {
        name: input.name, email: input.email, passwordHash: input.passwordHash, role: "FAMILY_ADMIN",
        emailVerifiedAt: input.emailVerified ? new Date() : null, passwordSet: input.passwordSet ?? true,
      } },
    },
    include: { users: true },
  }).catch((e) => { throw isUniqueViolation(e) ? taken() : e; });
  await audit(family.id, input.name, "account.created", "Confirmed parent or legal guardian, 18 or older");
  return family.users[0];
}
