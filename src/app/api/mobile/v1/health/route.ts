import { NextResponse } from "next/server";
import { z } from "zod";
import { isPassing } from "@/lib/health";
import { authed, query } from "@/lib/mobile-api";
import { childFromGraph, getFamilyGraph, healthLabel, refreshFamily } from "@/lib/mobile-views";

const Query = z.object({ childId: z.string().optional() });

/**
 * Configuration Health: 10 checks, each the worst status across devices. `?childId=` scopes it to one
 * child (onboarding). `toFix` feeds "Fix 2 settings": each item says which child and device to fix.
 */
export const GET = authed(async ({ req, user }) => {
  const q = query(req, Query);
  await refreshFamily(user.familyId);
  const graph = await getFamilyGraph(user.familyId);
  const h = q.childId ? childFromGraph(graph, q.childId).health : graph.familyHealth;
  const toFix = h.checks.filter((c) => !isPassing(c.status));
  return NextResponse.json({
    score: h.score, total: h.total, offline: h.offline, verified: h.verified, label: healthLabel(h.score, h.total, h.offline),
    checks: h.checks,
    toFix: toFix.map((c) => ({ key: c.key, name: c.name, status: c.status, detail: c.detail, childId: c.fixChildId ?? q.childId ?? null, deviceId: c.fixDeviceId ?? null })),
    children: q.childId ? undefined : graph.children.map((c) => ({ id: c.id, name: c.name, score: c.health.score, total: c.health.total, status: c.status })),
  });
});
