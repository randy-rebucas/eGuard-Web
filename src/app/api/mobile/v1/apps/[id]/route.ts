import { NextResponse } from "next/server";
import { z } from "zod";
import { APPROVAL_LABEL, setAppApproval, setAppCategory, setAppLimit } from "@/lib/family-service";
import { CATEGORY_BY_KEY, CATEGORY_KEYS, categoryOf } from "@/lib/app-categories";
import { invalid } from "@/lib/errors";
import { authed, body, clientLabel } from "@/lib/mobile-api";

const Body = z.object({
  approval: z.enum(["ALLOWED", "ALWAYS_ALLOWED", "FILTERED", "BLOCKED"]).optional(),
  /** null removes the limit */
  dailyLimitMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  /** null goes back to eGuard's guess from the app's name */
  category: z.enum(CATEGORY_KEYS).nullable().optional(),
});

/** Toggle an app, approve or decline a request (ALLOWED / BLOCKED), set its daily limit, or its category. */
export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, Body);
  if (b.approval === undefined && b.dailyLimitMinutes === undefined && b.category === undefined) throw invalid("Send approval, dailyLimitMinutes or category.");
  let app = b.approval ? await setAppApproval(user, params.id, b.approval, clientLabel(req)) : null;
  if (b.dailyLimitMinutes !== undefined) app = await setAppLimit(user, params.id, b.dailyLimitMinutes, clientLabel(req));
  if (b.category !== undefined) app = await setAppCategory(user, params.id, b.category, clientLabel(req));
  const c = categoryOf(app!);
  return NextResponse.json({
    id: app!.id, name: app!.name, approval: app!.approval, approvalLabel: APPROVAL_LABEL[app!.approval], dailyLimitMinutes: app!.dailyLimitMinutes,
    category: c.category, categoryLabel: CATEGORY_BY_KEY[c.category].label, categoryAuto: c.auto,
  });
});
