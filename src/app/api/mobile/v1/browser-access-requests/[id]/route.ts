import { NextResponse } from "next/server";
import { Decision, decideAccessRequest, requestJson } from "@/lib/browser-access";
import { authed, body, clientLabel } from "@/lib/mobile-api";

/**
 * Answer a request: `{ decision: "APPROVE", duration: "15M" | "1H" | "TODAY" | "ALWAYS" }` or `{ decision: "DENY" }`.
 * Approval becomes a new browser policy version (ALWAYS adds the site to the allowed list). `409` if already answered.
 */
export const POST = authed<{ id: string }>(async ({ req, user, params }) =>
  NextResponse.json({ request: requestJson(await decideAccessRequest(user, params.id, await body(req, Decision), clientLabel(req))) }));