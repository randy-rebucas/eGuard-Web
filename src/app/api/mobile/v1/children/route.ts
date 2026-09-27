import { NextResponse } from "next/server";
import { z } from "zod";
import { ChildSchema, createChild } from "@/lib/family-service";
import { getFamily } from "@/lib/queries";
import { authed, body } from "@/lib/mobile-api";
import { PROFILE_IDS } from "@/lib/profiles";
import { childrenJson, getFamilyGraph, refreshFamily } from "@/lib/mobile-views";

export const GET = authed(async ({ user }) => {
  await refreshFamily(user.familyId);
  const [family, graph] = await Promise.all([getFamily(user.familyId), getFamilyGraph(user.familyId)]);
  return NextResponse.json({ children: await childrenJson(graph, family.timezone) });
});

const Body = z.object({
  name: ChildSchema.shape.name,
  /** The app asks for age; birthYear is accepted too */
  age: z.number().int().min(0, "Enter a valid age.").max(17, "eGuard is for children under 18.").optional(),
  birthYear: z.number().int().optional(),
  profile: z.enum(PROFILE_IDS).optional(),
}).refine((b) => b.age != null || b.birthYear != null, { message: "Enter your child's age.", path: ["age"] });

/** Add Child. Starts with the chosen profile's policy (Protected if none). Add a photo with PUT /children/{id}/photo. */
export const POST = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  const parsed = ChildSchema.parse({ name: b.name, birthYear: b.birthYear ?? new Date().getFullYear() - b.age! });
  const child = await createChild(user, { ...parsed, profile: b.profile });
  const [family, graph] = await Promise.all([getFamily(user.familyId), getFamilyGraph(user.familyId)]);
  const json = (await childrenJson(graph, family.timezone)).find((c) => c.id === child.id);
  return NextResponse.json(json, { status: 201 });
});
