"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import type { AppApproval } from "@prisma/client";
import { db } from "@/lib/db";
import { clearSessionCookie, requireAdmin, requireUser } from "@/lib/auth";
import { sendVerificationEmailLater } from "@/lib/email-verification";
import { ServiceError, invalid, notFound, planRequired, toResult, type Result } from "@/lib/errors";
import * as family from "@/lib/family-service";
import * as browsers from "@/lib/browser-service";
import * as browserPolicy from "@/lib/browser-policy";
import * as browserAccess from "@/lib/browser-access";
import { LOCATION_UPGRADE, familyEntitlements, planWith } from "@/lib/plan-access";
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
  let childId: string;
  try {
    childId = (await family.createChild(u, parsed.data)).id;
  } catch (e) {
    return failed(e);
  }
  redirect(`/children/${childId}`);
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
  try {
    await family.deleteChild(await requireAdmin(), childId, String(form.get("password") ?? ""));
  } catch (e) {
    return failed(e);
  }
  redirect("/children");
}

export async function setAppApproval(appId: string, approval: AppApproval): Promise<Result> {
  const u = await requireUser();
  return toResult(async () => {
    const app = await family.setAppApproval(u, appId, approval, "web");
    revalidatePath(`/children/${app.childId}`);
    return {};
  });
}

export async function setAppLimit(appId: string, minutes: number | null): Promise<Result> {
  const u = await requireUser();
  return toResult(async () => {
    const app = await family.setAppLimit(u, appId, minutes);
    revalidatePath(`/children/${app.childId}`);
    return {};
  });
}

/* ---------- Devices ---------- */

export async function createPairingCode(childId: string, opts: family.PairingOptions = { kind: "DEVICE" }) {
  const u = await requireUser();
  const parsed = family.PairingOptions.safeParse(opts);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const p = await family.createPairingCode(u, childId, parsed.data);
    return { code: p.code, expiresAt: p.expiresAt.toISOString(), childName: p.childName };
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
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

export async function removeDevice(deviceId: string, _: FormState, form: FormData): Promise<FormState> {
  const u = await requireUser();
  try {
    await family.removeDevice(u, deviceId, String(form.get("password") ?? ""));
  } catch (e) {
    // Already removed (another tab, another parent): nothing left to do here
    if (e instanceof ServiceError && e.status === 404) return { error: "This device was already removed.", fields: { gone: "1" } };
    return failed(e);
  }
  revalidatePath("/", "layout");
  redirect("/devices");
}

export async function removeBrowser(installationId: string, _: FormState, form: FormData): Promise<FormState> {
  const u = await requireUser();
  try {
    await browsers.removeBrowser(u, installationId, String(form.get("password") ?? ""));
  } catch (e) {
    if (e instanceof ServiceError && e.status === 404) return { error: "This browser was already removed.", fields: { gone: "1" } };
    return failed(e);
  }
  revalidatePath("/", "layout");
  return { ok: "Browser removed." };
}

/** Saves browser protection as a new version; returns the saved lists as the server normalised them. */
export async function saveBrowserPolicy(childId: string, input: unknown) {
  const u = await requireUser();
  return toResult(async () => {
    const p = await browserPolicy.updateBrowserPolicy(u, childId, browserPolicy.BrowserPolicyInput.parse(input), "web");
    revalidatePath(`/children/${childId}`);
    return { version: p.version, blockedDomains: p.blockedDomains, allowedDomains: p.allowedDomains };
  });
}

/** Answers a child's request to open a blocked site. */
export async function decideAccessRequest(requestId: string, decision: unknown) {
  const u = await requireUser();
  return toResult(async () => {
    const r = await browserAccess.decideAccessRequest(u, requestId, browserAccess.Decision.parse(decision), "web");
    revalidatePath(`/children/${r.childId}`);
    revalidatePath("/", "layout");
    return { status: r.status };
  });
}

/** Polled while a pairing code is on screen. */
export async function pairingStatus(code: string) {
  const u = await requireUser();
  const s = await family.pairingCodeStatus(u, code);
  if (s.status === "paired") revalidatePath("/", "layout");
  return s;
}

/* ---------- Settings ---------- */

export async function updateAccount(_: FormState, form: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = z.object({
    name: z.string().trim().min(2, "Enter your name.").max(family.NAME_MAX, family.NAME_TOO_LONG),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    timezone: z.string().refine((tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } }, "Choose a valid time zone."),
  }).safeParse({ name: form.get("name"), email: form.get("email"), timezone: form.get("timezone") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let emailChanged = false;
  try {
    // A new email needs the password and is unverified until they open the link we send it
    emailChanged = await family.changeEmail(u, parsed.data.email, String(form.get("password") ?? ""));
  } catch (e) {
    return failed(e);
  }
  await db.user.update({ where: { id: u.id }, data: { name: parsed.data.name } });
  if (emailChanged) await sendVerificationEmailLater(u.id);
  if (u.role === "FAMILY_ADMIN") await db.family.update({ where: { id: u.familyId }, data: { timezone: parsed.data.timezone } });
  revalidatePath("/", "layout");
  return { ok: emailChanged ? "Saved. Open the link we sent to your new email to verify it." : "Account details saved." };
}

/** Settings › Export or delete data. The admin's account takes the whole family with it. */
export async function deleteAccount(_: FormState, form: FormData): Promise<FormState> {
  const u = await requireUser();
  try {
    await family.deleteAccount(u, { password: String(form.get("password") ?? ""), phrase: String(form.get("phrase") ?? "").trim() });
  } catch (e) {
    return failed(e);
  }
  await clearSessionCookie();
  redirect("/?deleted=1");
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

const USER_TOGGLES = ["notifyPush", "notifyEmail", "notifyApproval", "weeklySummary"] as const;
const FAMILY_TOGGLES = ["keepLocationHistory", "shareAnalytics"] as const;

export async function setToggle(key: string, value: boolean): Promise<Result> {
  const u = await requireUser();
  return toResult(async () => {
    const plan = await familyEntitlements(u.familyId);
    if (value && key === "notifyPush" && !plan.realtimeAlerts) throw planRequired(`Push alerts are included with ${planWith((e) => e.realtimeAlerts).name}.`);
    if (value && key === "keepLocationHistory" && !plan.locationSharing) throw planRequired(LOCATION_UPGRADE);
    if ((USER_TOGGLES as readonly string[]).includes(key)) {
      await db.user.update({ where: { id: u.id }, data: { [key]: value } });
    } else if ((FAMILY_TOGGLES as readonly string[]).includes(key)) {
      await requireAdmin();
      await db.family.update({ where: { id: u.familyId }, data: { [key]: value } });
      await audit(u.familyId, u.name, `privacy.${key}`, String(value));
      // Turning history off deletes the history already kept
      if (key === "keepLocationHistory" && !value) await db.locationVisit.deleteMany({ where: { child: { familyId: u.familyId } } });
    } else throw invalid("Unknown setting.");
    revalidatePath("/settings", "layout");
    return {};
  });
}

export async function addParent(_: FormState, form: FormData): Promise<FormState> {
  const parsed = family.ParentSchema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let parentId: string;
  try {
    parentId = (await family.addParent(await requireAdmin(), parsed.data)).id;
  } catch (e) {
    return failed(e);
  }
  await sendVerificationEmailLater(parentId);
  revalidatePath("/settings/family");
  return { ok: `${parsed.data.name} can now sign in with the temporary password. Ask them to change it.` };
}

export async function removeParent(userId: string): Promise<Result> {
  return toResult(async () => {
    const u = await requireAdmin();
    if (userId === u.id) throw invalid("You can't remove yourself.");
    const r = await db.user.deleteMany({ where: { id: userId, familyId: u.familyId, role: "PARENT" } });
    if (!r.count) throw notFound("Parent");
    await audit(u.familyId, u.name, "member.removed", userId);
    revalidatePath("/settings/family");
    return {};
  });
}

export async function unlinkIdentity(identityId: string): Promise<Result> {
  const u = await requireUser();
  return toResult(async () => {
    await family.unlinkIdentity(u, identityId);
    revalidatePath("/settings/security");
    return {};
  });
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
