import { NextResponse } from "next/server";
import { removeParent } from "@/lib/family-service";
import { authed } from "@/lib/mobile-api";

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  await removeParent(user, params.id);
  return NextResponse.json({ ok: true });
});
