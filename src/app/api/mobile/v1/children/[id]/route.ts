import { NextResponse } from "next/server";
import { z } from "zod";
import { ChildSchema, deleteChild, updateChild } from "@/lib/family-service";
import { getFamily } from "@/lib/queries";
import { entitlementsFor } from "@/lib/plans";
import { ConfirmBody, authed, body } from "@/lib/mobile-api";
import { childOverview, getFamilyGraph, refreshFamily } from "@/lib/mobile-views";

/** Child Profile › Overview. */
export const GET = authed<{ id: string }>(async ({ user, params }) => {
  await refreshFamily(user.familyId);
  const [family, graph] = await Promise.all([getFamily(user.familyId), getFamilyGraph(user.familyId)]);
  return NextResponse.json(await childOverview(graph, params.id, family.timezone, entitlementsFor(family.plan)));
});

const Patch = z.object({
  name: ChildSchema.shape.name.optional(),
  age: z.number().int().min(0).max(17, "eGuard is for children under 18.").optional(),
  birthYear: z.number().int().optional(),
});

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, Patch);
  // Same rules as the web Profile form (family-service.updateChild); only the fields sent change
  await updateChild(user, params.id, { name: b.name, birthYear: b.birthYear ?? (b.age != null ? new Date().getFullYear() - b.age : undefined) });
  const [family, graph] = await Promise.all([getFamily(user.familyId), getFamilyGraph(user.familyId)]);
  return NextResponse.json(await childOverview(graph, params.id, family.timezone, entitlementsFor(family.plan)));
});

/**
 * Deletes the child and all their data. Family admin only; needs their password, or `confirm: "DELETE"` when the
 * account has none (Apple/Google sign-in, `hasPassword: false`).
 */
export const DELETE = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, ConfirmBody);
  await deleteChild(user, params.id, { password: b.password, phrase: b.confirm });
  return NextResponse.json({ ok: true });
});
