import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ChildSchema, deleteChild } from "@/lib/family-service";
import { notFound } from "@/lib/errors";
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
  const data = ChildSchema.parse({
    name: b.name ?? current.name,
    birthYear: b.birthYear ?? (b.age != null ? new Date().getFullYear() - b.age : current.birthYear),
  });
  await db.child.update({ where: { id: current.id }, data });
  const [family, graph] = await Promise.all([getFamily(user.familyId), getFamilyGraph(user.familyId)]);
  return NextResponse.json(await childOverview(graph, params.id, family.timezone));
});

/** Deletes the child and all their data. Family admin only; needs their password. */
export const DELETE = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, z.object({ password: z.string().min(1, "Enter your password to confirm.") }));
  await deleteChild(user, params.id, b.password);
  return NextResponse.json({ ok: true });
});
