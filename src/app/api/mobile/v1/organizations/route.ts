import { NextResponse } from "next/server";
import { JoinCodeInput, ORG_PRIVACY, familyOrganizations, joinOrganization } from "@/lib/organizations";
import { authed, body } from "@/lib/mobile-api";

/**
 * Settings › Organizations: the schools, community groups and businesses this family joined. Joining shares
 * nothing about the family. Only the family admin can join or leave (`canManage`).
 */
export const GET = authed(async ({ user }) => NextResponse.json({
  organizations: await familyOrganizations(user.familyId),
  canManage: user.role === "FAMILY_ADMIN",
  privacy: ORG_PRIVACY,
}));

/** Joins with a join code, after POST /organizations/preview. Joining again is fine. Family admin only. */
export const POST = authed(async ({ req, user }) => {
  const { code } = await body(req, JoinCodeInput);
  const r = await joinOrganization(user, code);
  return NextResponse.json({ ok: true, name: r.name, organizations: await familyOrganizations(user.familyId) }, { status: 201 });
});
