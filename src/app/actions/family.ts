"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import type { AppApproval, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword, requireAdmin, requireUser, verifyPassword } from "@/lib/auth";
import { PROTECTIONS, defaultConfig } from "@/lib/protections";
import type { FormState } from "./auth";

const audit = (familyId: string, actor: string, action: string, detail?: string) =>
  db.auditLog.create({ data: { familyId, actor, action, detail } });

/* ---------- Alerts ---------- */

export async function markAlertRead(alertId: string) {
  const u = await requireUser();
  const a = await db.alert.findFirst({ where: { id: alertId, familyId: u.familyId } });
  if (!a) return;
  await db.alertRead.upsert({ where: { alertId_userId: { alertId, userId: u.id } }, create: { alertId, userId: u.id }, update: {} });
  revalidatePath("/", "layout");
}

export async function markAllRead() {
  const u = await requireUser();
  const alerts = await db.alert.findMany({ where: { familyId: u.familyId, reads: { none: { userId: u.id } } }, select: { id: true } });
  await db.alertRead.createMany({ data: alerts.map((a) => ({ alertId: a.id, userId: u.id })), skipDuplicates: true });
  revalidatePath("/", "layout");
}

export async function dismissAlert(alertId: string) {
  const u = await requireUser();
  await db.alert.updateMany({ where: { id: alertId, familyId: u.familyId, severity: "INFO" }, data: { resolvedAt: new Date() } });
  revalidatePath("/", "layout");
}

/* ---------- Children ---------- */

const ChildSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(40),
  birthYear: z.coerce.number().int().min(new Date().getFullYear() - 19, "eGuard is for children under 18.").max(new Date().getFullYear(), "Enter a valid birth year."),
});
const HUES = [205, 160, 330, 28, 265, 190];

export async function createChild(_: FormState, form: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = ChildSchema.safeParse({ name: form.get("name"), birthYear: form.get("birthYear") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const count = await db.child.count({ where: { familyId: u.familyId } });
  const age = new Date().getFullYear() - parsed.data.birthYear;
  const child = await db.child.create({
    data: {
      familyId: u.familyId, name: parsed.data.name, birthYear: parsed.data.birthYear, hue: HUES[count % HUES.length],
      dailyLimitMinutes: (defaultConfig("SCREEN_TIME", age) as { dailyMinutes: number }).dailyMinutes,
      policies: { create: PROTECTIONS.map((p) => ({ key: p.key, config: defaultConfig(p.key, age) as Prisma.InputJsonValue })) },
    },
  });
  await audit(u.familyId, u.name, "child.created", child.name);
  redirect(`/children/${child.id}`);
}

export async function updateChild(childId: string, _: FormState, form: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = ChildSchema.safeParse({ name: form.get("name"), birthYear: form.get("birthYear") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const res = await db.child.updateMany({ where: { id: childId, familyId: u.familyId }, data: parsed.data });
  if (!res.count) return { error: "Child not found." };
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

export async function deleteChildData(childId: string, _: FormState, form: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const user = await db.user.findUniqueOrThrow({ where: { id: u.id } });
  if (!(await verifyPassword(String(form.get("password") ?? ""), user.passwordHash))) return { error: "That password isn't right." };
  const child = await db.child.findFirst({ where: { id: childId, familyId: u.familyId } });
  if (!child) return { error: "Child not found." };
  await db.child.delete({ where: { id: child.id } });
  await audit(u.familyId, u.name, "child.deleted", child.name);
  redirect("/children");
}

export async function setAppApproval(appId: string, approval: AppApproval) {
  const u = await requireUser();
  const app = await db.childApp.findFirst({ where: { id: appId, child: { familyId: u.familyId } } });
  if (!app) throw new Error("App not found.");
  await db.childApp.update({ where: { id: appId }, data: { approval } });
  const label: Record<AppApproval, string> = { ALLOWED: "Allowed", ALWAYS_ALLOWED: "Always allowed", FILTERED: "Filtered", BLOCKED: "Blocked", PENDING: "Pending" };
  await db.configChange.create({
    data: {
      familyId: u.familyId, childId: app.childId, key: "APP_RESTRICTIONS", title: `${app.name} set to ${label[approval]}`,
      actor: `${u.name} on web · applies on next sync`, fromValue: label[app.approval], toValue: label[approval],
    },
  });
  await db.alert.updateMany({ where: { familyId: u.familyId, resolveKey: `APPREQ:${app.childId}:${app.name}`, resolvedAt: null }, data: { resolvedAt: new Date() } });
  revalidatePath(`/children/${app.childId}`);
}

export async function setAppLimit(appId: string, minutes: number | null) {
  const u = await requireUser();
  const app = await db.childApp.findFirst({ where: { id: appId, child: { familyId: u.familyId } } });
  if (!app) throw new Error("App not found.");
  const m = minutes && minutes > 0 ? Math.min(1440, Math.round(minutes)) : null;
  await db.childApp.update({ where: { id: appId }, data: { dailyLimitMinutes: m } });
  revalidatePath(`/children/${app.childId}`);
}

/* ---------- Devices ---------- */

export async function createPairingCode(childId: string) {
  const u = await requireUser();
  const [child, family, count] = await Promise.all([
    db.child.findFirst({ where: { id: childId, familyId: u.familyId } }),
    db.family.findUniqueOrThrow({ where: { id: u.familyId } }),
    db.device.count({ where: { familyId: u.familyId } }),
  ]);
  if (!child) throw new Error("Child not found.");
  if (count >= family.deviceLimit) return { error: `Your plan covers ${family.deviceLimit} devices. Remove a device to add another.` };
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  await db.pairingCode.create({ data: { familyId: u.familyId, childId, code, expiresAt } });
  return { code, expiresAt: expiresAt.toISOString(), childName: child.name };
}

export async function renameDevice(deviceId: string, _: FormState, form: FormData): Promise<FormState> {
  const u = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 60) return { error: "Enter a device name up to 60 characters." };
  const r = await db.device.updateMany({ where: { id: deviceId, familyId: u.familyId }, data: { name } });
  if (!r.count) return { error: "Device not found." };
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

export async function removeDevice(deviceId: string) {
  const u = await requireUser();
  const d = await db.device.findFirst({ where: { id: deviceId, familyId: u.familyId }, include: { child: true } });
  if (!d) throw new Error("Device not found.");
  await db.device.delete({ where: { id: d.id } });
  await audit(u.familyId, u.name, "device.removed", `${d.child.name}'s ${d.name}`);
  redirect("/devices");
}

/* ---------- Settings ---------- */

export async function updateAccount(_: FormState, form: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = z.object({
    name: z.string().trim().min(2, "Enter your name."),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    timezone: z.string().refine((tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } }, "Choose a valid time zone."),
  }).safeParse({ name: form.get("name"), email: form.get("email"), timezone: form.get("timezone") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const clash = await db.user.findFirst({ where: { email: parsed.data.email, id: { not: u.id } } });
  if (clash) return { error: "Another account already uses this email." };
  await db.user.update({ where: { id: u.id }, data: { name: parsed.data.name, email: parsed.data.email } });
  if (u.role === "FAMILY_ADMIN") await db.family.update({ where: { id: u.familyId }, data: { timezone: parsed.data.timezone } });
  revalidatePath("/", "layout");
  return { ok: "Account details saved." };
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const u = await requireUser();
  const current = String(form.get("current") ?? ""), next = String(form.get("next") ?? "");
  const user = await db.user.findUniqueOrThrow({ where: { id: u.id } });
  if (!(await verifyPassword(current, user.passwordHash))) return { error: "Your current password isn't right." };
  if (next.length < 10) return { error: "Use at least 10 characters for your new password." };
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(next), passwordChangedAt: new Date() } });
  await db.session.deleteMany({ where: { userId: u.id, id: { not: u.sessionId } } });
  await audit(u.familyId, u.name, "password.changed");
  return { ok: "Password changed. Other sessions were signed out." };
}

const USER_TOGGLES = ["notifyPush", "notifyEmail", "notifyApproval", "weeklySummary", "twoFactor"] as const;
const FAMILY_TOGGLES = ["keepLocationHistory", "shareAnalytics"] as const;

export async function setToggle(key: string, value: boolean) {
  const u = await requireUser();
  if ((USER_TOGGLES as readonly string[]).includes(key)) {
    await db.user.update({ where: { id: u.id }, data: { [key]: value } });
  } else if ((FAMILY_TOGGLES as readonly string[]).includes(key)) {
    await requireAdmin();
    await db.family.update({ where: { id: u.familyId }, data: { [key]: value } });
    await audit(u.familyId, u.name, `privacy.${key}`, String(value));
  } else throw new Error("Unknown setting.");
  revalidatePath("/settings", "layout");
}

export async function addParent(_: FormState, form: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const parsed = z.object({
    name: z.string().trim().min(2, "Enter their name."),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: z.string().min(10, "Temporary password needs at least 10 characters."),
  }).safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (await db.user.findUnique({ where: { email: parsed.data.email } })) return { error: "An account with this email already exists." };
  await db.user.create({ data: { familyId: u.familyId, name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password), role: "PARENT" } });
  await audit(u.familyId, u.name, "member.added", parsed.data.email);
  revalidatePath("/settings/family");
  return { ok: `${parsed.data.name} can now sign in with the temporary password. Ask them to change it.` };
}

export async function removeParent(userId: string) {
  const u = await requireAdmin();
  if (userId === u.id) throw new Error("You can't remove yourself.");
  const r = await db.user.deleteMany({ where: { id: userId, familyId: u.familyId, role: "PARENT" } });
  if (r.count) await audit(u.familyId, u.name, "member.removed", userId);
  revalidatePath("/settings/family");
}

export async function signOutOthers() {
  const u = await requireUser();
  await db.session.deleteMany({ where: { userId: u.id, id: { not: u.sessionId } } });
  revalidatePath("/settings/security");
}

export async function setTheme(theme: "system" | "light" | "dark") {
  const jar = await cookies();
  if (theme === "system") jar.delete("eg_theme");
  else jar.set("eg_theme", theme, { path: "/", maxAge: 365 * 864e2, sameSite: "lax" });
}
