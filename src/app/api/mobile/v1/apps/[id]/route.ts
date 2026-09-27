import { NextResponse } from "next/server";
import { z } from "zod";
import { APPROVAL_LABEL, setAppApproval, setAppLimit } from "@/lib/family-service";
import { invalid } from "@/lib/errors";
import { authed, body, clientLabel } from "@/lib/mobile-api";

const Body = z.object({
  approval: z.enum(["ALLOWED", "ALWAYS_ALLOWED", "FILTERED", "BLOCKED"]).optional(),
  /** null removes the limit */
  dailyLimitMinutes: z.number().int().min(1).max(1440).nullable().optional(),
});

/** Toggle an app, approve or decline a request (ALLOWED / BLOCKED), or set its daily limit. */
export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, Body);
  if (b.approval === undefined && b.dailyLimitMinutes === undefined) throw invalid("Send approval or dailyLimitMinutes.");
  let app = b.approval ? await setAppApproval(user, params.id, b.approval, clientLabel(req)) : null;
  if (b.dailyLimitMinutes !== undefined) app = await setAppLimit(user, params.id, b.dailyLimitMinutes);
  return NextResponse.json({ id: app!.id, name: app!.name, approval: app!.approval, approvalLabel: APPROVAL_LABEL[app!.approval], dailyLimitMinutes: app!.dailyLimitMinutes });
});
