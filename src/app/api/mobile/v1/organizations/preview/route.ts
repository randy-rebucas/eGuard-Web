import { NextResponse } from "next/server";
import { JoinCodeInput, joinNotice, previewJoin } from "@/lib/organizations";
import { authed, body } from "@/lib/mobile-api";

/**
 * Step 1 of joining: who a join code belongs to, so the family admin can confirm before joining. The code goes in
 * the body, not the URL, so it doesn't end up in logs. Wrong codes count toward a short per-parent limit (429).
 */
export const POST = authed(async ({ req, user }) => {
  const { code } = await body(req, JoinCodeInput);
  const p = await previewJoin(user, code);
  return NextResponse.json({ name: p.name, kind: p.kindKey, kindLabel: p.kind, alreadyJoined: p.alreadyJoined, message: joinNotice(p.name) });
});
