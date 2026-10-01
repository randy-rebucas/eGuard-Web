import { NextResponse } from "next/server";
import { z } from "zod";
import type { BrowserPolicy } from "@prisma/client";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { BrowserPolicyInput, CATEGORY_META, WEB_CATEGORIES, getOrCreateBrowserPolicy, updateBrowserPolicy } from "@/lib/browser-policy";
import { authed, body, clientLabel } from "@/lib/mobile-api";

const json = (p: BrowserPolicy) => ({
  version: p.version,
  safeBrowsing: p.safeBrowsing,
  safeSearch: p.safeSearch,
  blockedCategories: p.blockedCategories,
  blockedDomains: p.blockedDomains,
  allowedDomains: p.allowedDomains,
  unknownSitesPolicy: p.unknownSitesPolicy,
  schedule: p.schedule,
  updatedBy: p.updatedBy,
  updatedAt: p.updatedAt,
  categories: WEB_CATEGORIES.map((key) => ({ key, ...CATEGORY_META[key] })),
});

async function childOf(familyId: string, id: string) {
  const c = await db.child.findFirst({ where: { id, familyId }, select: { id: true } });
  if (!c) throw notFound("Child");
  return c;
}

/** Browser protection for one child: what the eGuard browser extension enforces on all their browsers. */
export const GET = authed<{ id: string }>(async ({ user, params }) => {
  await childOf(user.familyId, params.id);
  return NextResponse.json(json(await getOrCreateBrowserPolicy(params.id)));
});

/**
 * Replaces the whole policy (send every field). Browsers apply it on their next sync, within 5 minutes.
 * `baseVersion` (optional, the `version` the app showed) refuses the save with 409 `stale_version` if the policy
 * changed since, so an approved access request or another parent's edit isn't silently undone.
 */
export const PUT = authed<{ id: string }>(async ({ req, user, params }) => {
  const raw = await body(req, z.looseObject({ baseVersion: z.number().int().positive().optional() }));
  const input = BrowserPolicyInput.parse(raw);
  return NextResponse.json(json(await updateBrowserPolicy(user, params.id, input, clientLabel(req), raw.baseVersion)));
});
