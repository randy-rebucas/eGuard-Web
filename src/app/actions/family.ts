"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import type { AppApproval } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/errors";
import * as family from "@/lib/family-service";
import type { FormState } from "./auth";

const { audit, ChildSchema } = family;

/** Turns a parent-facing service error into form state; anything else is a real failure. */
function failed(e: unknown): FormState {
  if (e instanceof ServiceError) return { error: e.message };
  throw e;
}

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

export async function createChild(_: FormState, form: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = ChildSchema.safeParse({ name: form.get("name"), birthYear: form.get("birthYear") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const child = await family.createChild(u, parsed.data);
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
  try {
    await family.deleteChild(u, childId, String(form.get("password") ?? ""));
  } catch (e) {
    return failed(e);
  }
  redirect("/children");
}

export async function setAppApproval(appId: string, approval: AppApproval) {
  const u = await requireUser();
  const app = await family.setAppApproval(u, appId, approval, "web");
  revalidatePath(`/children/${app.childId}`);
}

export async function setAppLimit(appId: string, minutes: number | null) {
  const u = await requireUser();
  const app = await family.setAppLimit(u, appId, minutes);
  revalidatePath(`/children/${app.childId}`);
}

/* ---------- Devices ---------- */

export async function createPairingCode(childId: string) {
  const u = await requireUser();
  try {
    const p = await family.createPairingCode(u, childId);
    return { code: p.code, expiresAt: p.expiresAt.toISOString(), childName: p.childName };
  } catch (e) {
    if (e instanceof ServiceError && e.status === 409) return { error: e.message };
    throw e;
  }
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
  try {
    await family.changePassword(u, String(form.get("current") ?? ""), String(form.get("next") ?? ""));
  } catch (e) {
    return failed(e);
  }
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
    // Turning history off deletes the history already kept
    if (key === "keepLocationHistory" && !value) await db.locationVisit.deleteMany({ where: { child: { familyId: u.familyId } } });
  } else throw new Error("Unknown setting.");
  revalidatePath("/settings", "layout");
}

export async function addParent(_: FormState, form: FormData): Promise<FormState> {
  const u = await requireAdmin();
  const parsed = family.ParentSchema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await family.addParent(u, parsed.data);
  } catch (e) {
    return failed(e);
  }
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
