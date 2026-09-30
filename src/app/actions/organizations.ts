"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { ServiceError, toResult, type Result } from "@/lib/errors";
import * as orgs from "@/lib/organizations";
import * as orgApi from "@/lib/org-api";
import type { FormState } from "./auth";

/** Organizations and sponsor codes (docs/organizations.md). Every check happens in lib/organizations. */

function failed(e: unknown): FormState {
  if (e instanceof ServiceError) return { error: e.message };
  if (e instanceof ZodError) return { error: e.issues[0]?.message ?? "Check the details and try again." };
  throw e;
}

const orgPath = (orgId: string) => `/organizations/${orgId}`;

/* ---------- Families ---------- */

export async function previewJoin(code: string): Promise<Result<{ name: string; kind: string; alreadyJoined: boolean }>> {
  return toResult(async () => orgs.previewJoin(await requireUser(), code));
}

export async function joinOrganization(code: string): Promise<Result<{ name: string }>> {
  return toResult(async () => {
    const r = await orgs.joinOrganization(await requireUser(), code);
    revalidatePath("/settings/organizations");
    return r;
  });
}

export async function leaveOrganization(orgId: string): Promise<Result<{ name: string }>> {
  return toResult(async () => {
    const r = await orgs.leaveOrganization(await requireUser(), orgId);
    revalidatePath("/settings/organizations");
    return r;
  });
}

/** Settings › Subscription › Have a sponsor code? */
export async function redeemCode(_: FormState, form: FormData): Promise<FormState> {
  const code = String(form.get("code") ?? "");
  if (!code.trim()) return { error: "Enter the code you were given." };
  try {
    const r = await orgs.redeemCode(await requireUser(), code);
    revalidatePath("/", "layout");
    return { ok: `Code redeemed. ${r.sponsor} is sponsoring ${r.plan} for your family for ${r.months} month${r.months === 1 ? "" : "s"}.` };
  } catch (e) {
    return failed(e);
  }
}

/* ---------- Organization admins ---------- */

export async function createOrganization(_: FormState, form: FormData): Promise<FormState> {
  let id: string;
  try {
    id = (await orgs.createOrganization(await requireUser(), { name: String(form.get("name") ?? ""), kind: String(form.get("kind") ?? "") as "SCHOOL" })).id;
  } catch (e) {
    return failed(e);
  }
  redirect(orgPath(id));
}

export async function replaceJoinCode(orgId: string): Promise<Result<{ joinCode: string }>> {
  return toResult(async () => {
    const r = await orgs.replaceJoinCode(await requireUser(), orgId);
    revalidatePath(orgPath(orgId));
    return r;
  });
}

/** Off to PayMongo's checkout to pay for a batch of sponsor codes. */
export async function buyCodes(orgId: string, _: FormState, form: FormData): Promise<FormState> {
  let url: string;
  try {
    url = (await orgs.buyCodes(await requireUser(), orgId, {
      plan: String(form.get("plan") ?? ""), months: String(form.get("months") ?? ""), quantity: String(form.get("quantity") ?? ""),
    })).checkoutUrl;
  } catch (e) {
    return failed(e);
  }
  redirect(url);
}

export async function cancelCode(orgId: string, voucherId: string): Promise<Result> {
  return toResult(async () => {
    await orgs.cancelCode(await requireUser(), orgId, voucherId);
    revalidatePath(orgPath(orgId));
    return {};
  });
}

export async function addOrgAdmin(orgId: string, _: FormState, form: FormData): Promise<FormState> {
  try {
    const r = await orgs.addOrgAdmin(await requireUser(), orgId, String(form.get("email") ?? ""));
    revalidatePath(orgPath(orgId));
    return { ok: `${r.name} can now manage this organization.` };
  } catch (e) {
    return failed(e);
  }
}

export async function removeOrgAdmin(orgId: string, userId: string): Promise<Result> {
  return toResult(async () => {
    const u = await requireUser();
    await orgs.removeOrgAdmin(u, orgId, userId);
    revalidatePath(orgPath(orgId));
    revalidatePath("/settings/organizations");
    return {};
  });
}

/* ---------- API keys ---------- */

/** Returns the full key once; it isn't stored. */
export async function createApiKey(orgId: string, input: { name: string; access: string }): Promise<Result<{ name: string; token: string }>> {
  return toResult(async () => {
    const r = await orgApi.createApiKey(await requireUser(), orgId, input);
    revalidatePath(orgPath(orgId));
    return { name: r.name, token: r.token };
  });
}

export async function revokeApiKey(orgId: string, keyId: string): Promise<Result> {
  return toResult(async () => {
    await orgApi.revokeApiKey(await requireUser(), orgId, keyId);
    revalidatePath(orgPath(orgId));
    return {};
  });
}

export async function makeOrgOwner(orgId: string, userId: string): Promise<Result> {
  return toResult(async () => {
    await orgs.makeOrgOwner(await requireUser(), orgId, userId);
    revalidatePath(orgPath(orgId));
    return {};
  });
}
