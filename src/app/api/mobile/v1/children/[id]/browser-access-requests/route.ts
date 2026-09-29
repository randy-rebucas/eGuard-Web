import { NextResponse } from "next/server";
import { requestJson, requestsForChild } from "@/lib/browser-access";
import { authed } from "@/lib/mobile-api";

/** Sites the child asked to open from a browser block page: open requests first, then recent answers. */
export const GET = authed<{ id: string }>(async ({ user, params }) => {
  const { pending, recent } = await requestsForChild(user, params.id);
  return NextResponse.json({ pending: pending.map(requestJson), recent: recent.map(requestJson) });
});