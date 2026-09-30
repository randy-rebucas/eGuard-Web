import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import type { AppApproval, PairingKind, Prisma } from "@prisma/client";
import { db } from "./db";
import { PASSWORD_TOO_LONG, confirmPassword, hashPassword, passwordTooLong } from "./auth";
import { refreshPurchases } from "./billing";
import { cancelSubscriptionsBeforeDeletion } from "./web-billing";
import { audit } from "./audit";
import { profileConfigs, type ProfileId } from "./profiles";
import type { ProtectionConfig } from "./protections";
import type { Actor } from "./config-service";
import { conflict, forbidden, invalid, isUniqueViolation, notFound, planLimit } from "./errors";
import { requireVerifiedEmail } from "./email-verification";
import { BASE_PLAN, nextPlan, planByName } from "./plans";
import { LIMITS, enforce } from "./rate-limit";
import { usedDeviceSlots } from "./device-slots";

/** Family, children, apps and devices: shared by the web server actions and the mobile API. */

export { audit };

const requireAdminActor = (a: Actor) => { if (a.role !== "FAMILY_ADMIN") throw forbidden(); };

/** Longest parent or family name; it appears in emails, alerts and history lines. */
export const NAME_MAX = 80;
export const NAME_TOO_LONG = `Use up to ${NAME_MAX} characters.`;

/* ---------- Children ---------- */

export const ChildSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(40),
  birthYear: z.coerce.number().int().min(new Date().getFullYear() - 19, "eGuard is for children under 18.").max(new Date().getFullYear(), "Enter a valid birth year."),
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
  const [count, family] = await Promise.all([
    db.child.count({ where: { familyId: actor.familyId } }),
    db.family.findUniqueOrThrow({ where: { id: actor.familyId }, select: { plan: true } }),
  ]);
  const full = childLimitReached(family.plan, count);
  if (full) throw planLimit(full);
  const age = new Date().getFullYear() - input.birthYear;
  const configs = profileConfigs(input.profile ?? "PROTECTED", age);
  const screen = configs.find((c) => c.key === "SCREEN_TIME") as Extract<ProtectionConfig, { key: "SCREEN_TIME" }>;
  const child = await db.child.create({
    data: {
      familyId: actor.familyId, name: input.name, birthYear: input.birthYear, hue: HUES[count % HUES.length],
      dailyLimitMinutes: screen.dailyMinutes, weekendLimitMinutes: screen.weekendMinutes,
      policies: { create: configs.map((c) => ({ key: c.key, config: c as Prisma.InputJsonValue })) },
    },
  });
  await audit(actor.familyId, actor.name, "child.created", child.name);
  return child;
}

export async function deleteChild(actor: Actor, childId: string, password: string) {
  requireAdminActor(actor);
  await confirmPassword(actor.id, password);
  const child = await db.child.findFirst({ where: { id: childId, familyId: actor.familyId } });
  if (!child) throw notFound("Child");
  await db.child.delete({ where: { id: child.id } });
  await audit(actor.familyId, actor.name, "child.deleted", child.name);
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

export async function setAppLimit(actor: Actor, appId: string, minutes: number | null) {
  await appFor(actor.familyId, appId);
  const m = minutes && minutes > 0 ? Math.min(1440, Math.round(minutes)) : null;
  return db.childApp.update({ where: { id: appId }, data: { dailyLimitMinutes: m } });
}

/* ---------- Devices ---------- */

export const PairingOptions = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("DEVICE") }),
  z.object({ kind: z.literal("BROWSER"), deviceLabel: z.string().trim().min(1, "Enter the computer's name, like Mia's MacBook.").max(60) }),
]);
export type PairingOptions = z.infer<typeof PairingOptions>;

/**
 * A one-time code the child's device (or browser, for BROWSER codes) exchanges for its credentials. Only the
 * newest code for a child works: getting another replaces it, so at most one guessable code per child is ever live.
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
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  await db.$transaction([
    db.pairingCode.deleteMany({ where: { childId, usedAt: null } }),
    db.pairingCode.create({
      data: { familyId: actor.familyId, childId, code, expiresAt, kind: opts.kind as PairingKind, deviceLabel: opts.kind === "BROWSER" ? opts.deviceLabel : null },
    }),
  ]);
  return { code, expiresAt, childName: child.name, kind: opts.kind };
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

/**
 * Removes a device from the family. Its token stops working and eGuard stops verifying it, which would also
 * silence tamper alerts, so it needs the parent's password and tells the family (the alert is emailed).
 */
export async function removeDevice(actor: Actor, deviceId: string, password: string) {
  const d = await db.device.findFirst({ where: { id: deviceId, familyId: actor.familyId }, include: { child: true } });
  if (!d) throw notFound("Device");
  await confirmPassword(actor.id, password);
  await db.device.delete({ where: { id: d.id } });
  const label = `${d.child.name}'s ${d.name}`;
  await audit(actor.familyId, actor.name, "device.removed", label);
  await db.alert.create({
    data: {
      familyId: actor.familyId, childId: d.childId, severity: "ATTENTION", category: "DEVICES", icon: "trash",
      title: "Device removed", subject: label,
      body: `${actor.name} removed ${d.name} from eGuard. Its protections stay on the device, but eGuard no longer verifies them or tells you if they change.`,
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
  const [user, identities] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: actor.id } }), listIdentities(actor.id)]);
  const target = identities.find((i) => i.id === identityId);
  if (!target) throw notFound("Sign-in");
  if (!user.passwordSet && identities.length === 1) {
    throw conflict("This is your only way to sign in. Set a password first (sign out, then “Forgot password?”).");
  }
  await db.oAuthIdentity.delete({ where: { id: target.id } });
  await audit(actor.familyId, actor.name, "identity.unlinked", target.provider);
}

/**
 * Deletes the signed-in parent's account. The family admin's account takes the whole family with it
 * (children, devices, history, other parents) and first cancels any PayMongo auto-renew; another parent's
 * account removes only them. Needs the password, or for Apple/Google accounts without one, typing DELETE.
 */
export async function deleteAccount(actor: Actor, confirm: { password?: string; phrase?: string }) {
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (user.passwordSet) await confirmPassword(actor.id, confirm.password ?? "");
  else if (confirm.phrase !== "DELETE") throw invalid("Type DELETE to confirm.");
  if (actor.role === "FAMILY_ADMIN") {
    await cancelSubscriptionsBeforeDeletion(actor.familyId);
    await db.family.delete({ where: { id: actor.familyId } });
    return { deleted: "family" as const };
  }
  await db.user.delete({ where: { id: actor.id } });
  await audit(actor.familyId, actor.name, "member.left", user.email);
  return { deleted: "account" as const };
}

export const ParentSchema = z.object({
  name: z.string().trim().min(2, "Enter their name.").max(NAME_MAX, NAME_TOO_LONG),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(10, "Temporary password needs at least 10 characters.").refine((p) => !passwordTooLong(p), PASSWORD_TOO_LONG),
});

export async function addParent(actor: Actor, input: z.infer<typeof ParentSchema>) {
  requireAdminActor(actor);
  const taken = () => conflict("An account with this email already exists.");
  if (await userIdForMailbox(input.email)) throw taken();
  const user = await db.user.create({
    data: { familyId: actor.familyId, name: input.name, email: input.email, passwordHash: await hashPassword(input.password), role: "PARENT" },
  }).catch((e) => { throw isUniqueViolation(e) ? taken() : e; });
  await audit(actor.familyId, actor.name, "member.added", input.email);
  return user;
}

export async function removeParent(actor: Actor, userId: string) {
  requireAdminActor(actor);
  if (userId === actor.id) throw invalid("You can't remove yourself.");
  const r = await db.user.deleteMany({ where: { id: userId, familyId: actor.familyId, role: "PARENT" } });
  if (!r.count) throw notFound("Family member");
  await audit(actor.familyId, actor.name, "member.removed", userId);
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
