import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import type { AppApproval, Prisma } from "@prisma/client";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./auth";
import { profileConfigs, type ProfileId } from "./profiles";
import type { ProtectionConfig } from "./protections";
import type { Actor } from "./config-service";
import { ServiceError, conflict, forbidden, invalid, isUniqueViolation, notFound } from "./errors";
import { requireVerifiedEmail } from "./email-verification";

/** Family, children, apps and devices: shared by the web server actions and the mobile API. */

export const audit = (familyId: string, actor: string, action: string, detail?: string) =>
  db.auditLog.create({ data: { familyId, actor, action, detail } });

const requireAdminActor = (a: Actor) => { if (a.role !== "FAMILY_ADMIN") throw forbidden(); };

/* ---------- Children ---------- */

export const ChildSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(40),
  birthYear: z.coerce.number().int().min(new Date().getFullYear() - 19, "eGuard is for children under 18.").max(new Date().getFullYear(), "Enter a valid birth year."),
});
const HUES = [205, 160, 330, 28, 265, 190];

/** Creates a child with a full policy from the chosen profile (Protected by default). */
export async function createChild(actor: Actor, input: { name: string; birthYear: number; profile?: ProfileId }) {
  const count = await db.child.count({ where: { familyId: actor.familyId } });
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
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifyPassword(password, user.passwordHash))) throw new ServiceError(403, "That password isn't right.", "wrong_password");
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

async function appFor(familyId: string, appId: string) {
  const app = await db.childApp.findFirst({ where: { id: appId, child: { familyId } } });
  if (!app) throw notFound("App");
  return app;
}

/** Devices pick up app rules on their next sync. Resolves any open approval request for the app. */
export async function setAppApproval(actor: Actor, appId: string, approval: AppApproval, via: string) {
  const app = await appFor(actor.familyId, appId);
  if (app.approval === approval) return app;
  const updated = await db.childApp.update({ where: { id: appId }, data: { approval } });
  await db.configChange.create({
    data: {
      familyId: actor.familyId, childId: app.childId, key: "APP_RESTRICTIONS", title: `${app.name} set to ${APPROVAL_LABEL[approval]}`,
      actor: `${actor.name} on ${via} · applies on next sync`, fromValue: APPROVAL_LABEL[app.approval], toValue: APPROVAL_LABEL[approval],
    },
  });
  await db.alert.updateMany({ where: { familyId: actor.familyId, resolveKey: `APPREQ:${app.childId}:${app.name}`, resolvedAt: null }, data: { resolvedAt: new Date() } });
  return updated;
}

export async function setAppLimit(actor: Actor, appId: string, minutes: number | null) {
  await appFor(actor.familyId, appId);
  const m = minutes && minutes > 0 ? Math.min(1440, Math.round(minutes)) : null;
  return db.childApp.update({ where: { id: appId }, data: { dailyLimitMinutes: m } });
}

/* ---------- Devices ---------- */

export async function createPairingCode(actor: Actor, childId: string) {
  const [child, family, count] = await Promise.all([
    db.child.findFirst({ where: { id: childId, familyId: actor.familyId } }),
    db.family.findUniqueOrThrow({ where: { id: actor.familyId } }),
    db.device.count({ where: { familyId: actor.familyId } }),
  ]);
  if (!child) throw notFound("Child");
  await requireVerifiedEmail(actor.id);
  if (count >= family.deviceLimit) throw conflict(`Your plan covers ${family.deviceLimit} devices. Remove a device to add another.`);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  await db.pairingCode.create({ data: { familyId: actor.familyId, childId, code, expiresAt } });
  return { code, expiresAt, childName: child.name };
}

/* ---------- Account ---------- */

export async function changePassword(actor: Actor & { sessionId: string }, current: string, next: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifyPassword(current, user.passwordHash))) throw new ServiceError(403, "Your current password isn't right.", "wrong_password");
  if (next.length < 10) throw invalid("Use at least 10 characters for your new password.");
  await db.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(next), passwordChangedAt: new Date() } });
  await db.session.deleteMany({ where: { userId: actor.id, id: { not: actor.sessionId } } });
  await audit(actor.familyId, actor.name, "password.changed");
}

export const ParentSchema = z.object({
  name: z.string().trim().min(2, "Enter their name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(10, "Temporary password needs at least 10 characters."),
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
  name: z.string().trim().min(2, "Enter your name."),
  familyName: z.string().trim().min(2, "Enter a family name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters for your password."),
  /** Accounts are for parents and guardians only; children are added by a parent, never sign up */
  guardian: z.literal(true, { error: GUARDIAN_REQUIRED }),
});

/**
 * Creates a family and its admin. Callers must have had the person confirm they're a parent or
 * guardian (18+); it's recorded in the audit log. `passwordHash` lets social sign-up pass an unusable hash,
 * and `emailVerified` marks an email the provider already verified. Otherwise, send a verification email.
 */
export async function createFamily(input: { name: string; familyName: string; email: string; passwordHash: string; emailVerified?: boolean }) {
  const taken = () => conflict("An account with this email already exists. Sign in instead.");
  if (await userIdForMailbox(input.email)) throw taken();
  const renews = new Date(); renews.setMonth(renews.getMonth() + 1);
  // Family and admin are created in one statement, so a lost race leaves no empty family behind
  const family = await db.family.create({
    data: {
      name: input.familyName, plan: "eGuard Plus", deviceLimit: 8, renewsAt: renews,
      users: { create: {
        name: input.name, email: input.email, passwordHash: input.passwordHash, role: "FAMILY_ADMIN",
        emailVerifiedAt: input.emailVerified ? new Date() : null,
      } },
    },
    include: { users: true },
  }).catch((e) => { throw isUniqueViolation(e) ? taken() : e; });
  await audit(family.id, input.name, "account.created", "Confirmed parent or legal guardian, 18 or older");
  return family.users[0];
}
