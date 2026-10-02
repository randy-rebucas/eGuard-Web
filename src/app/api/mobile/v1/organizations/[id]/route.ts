import { NextResponse } from "next/server";
import { leaveOrganization } from "@/lib/organizations";
import { authed } from "@/lib/mobile-api";

/** Leaves an organization. Family admin only; the other parents get an alert, as on the website. */
export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  const r = await leaveOrganization(user, params.id);
  return NextResponse.json({ ok: true, name: r.name });
});
