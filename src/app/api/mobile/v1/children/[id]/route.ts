import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ChildSchema, assertNameFree, deleteChild } from "@/lib/family-service";
import { notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { getFamily } from "@/lib/queries";
import { authed, body } from "@/lib/mobile-api";
import { childOverview, getFamilyGraph, refreshFamily } from "@/lib/mobile-views";

/** Child Profile › Overview. */
export const GET = authed<{ id: string }>(async ({ user, params }) => {
  await refreshFamily(user.familyId);
  const [family, graph] = await Promise.all([getFamily(user.familyId), getFamilyGraph(user.familyId)]);
  return NextResponse.json(await childOverview(graph, params.id, family.timezone));
});

const Patch = z.object({
  name: ChildSchema.shape.name.optional(),
  age: z.number().int().min(0).max(17, "eGuard is for children under 18.").optional(),
  birthYear: z.number().int().optional(),
});

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, Patch);
  const current = await db.child.findFirst({ where: { id: params.id, familyId: user.familyId } });
  if (!current) throw notFound("Child");
  const birthYear = b.birthYear ?? (b.age != null ? new Date().getFullYear() - b.age : current.birthYear);
  // A child who has since grown past the age range keeps their saved year; only a changed year is checked
  const data = birthYear === current.birthYear
    ? { ...ChildSchema.pick({ name: true }).parse({ name: b.name ?? current.name }), birthYear }
    : ChildSchema.parse({ name: b.name ?? current.name, birthYear });
  if (data.name !== current.name) await assertNameFree(user.familyId, data.name, current.id);
  await db.child.update({ where: { id: current.id }, data });
  // Same audit entry as the web profile form
  if (data.name !== current.name || data.birthYear !== current.birthYear) {
    await audit(user.familyId, user.name, "child.updated", data.name === current.name ? current.name : `${current.name} → ${data.name}`);
  }
  const [family, graph] = await Promise.all([getFamily(user.familyId), getFamilyGraph(user.familyId)]);
  return NextResponse.json(await childOverview(graph, params.id, family.timezone));
});

/** Deletes the child and all their data. Family admin only; needs their password. */
export const DELETE = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, z.object({ password: z.string().min(1, "Enter your password to confirm.") }));
  await deleteChild(user, params.id, b.password);
  return NextResponse.json({ ok: true });
});
