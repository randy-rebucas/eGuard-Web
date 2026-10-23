import "server-only";
import { z } from "zod";
import type { AppIdentifierKind, Platform } from "@prisma/client";
import { db } from "./db";

export const APP_ID_KINDS = ["STEAM", "EPIC", "RIOT", "BATTLENET", "EA", "UBISOFT", "GOG", "MSSTORE", "EXE", "PACKAGE", "BUNDLE"] as const satisfies readonly AppIdentifierKind[];

/**
 * Optional on an app a device reports: stable ids for it on that platform ("STEAM" "730", "EXE" "valve corporation|cs2").
 * The desktop agent sends them so "Counter-Strike 2" from Steam's manifest and the same game seen as a process are one
 * app on the child's list, and a renamed exe can't pass as a new app. Phones send none (yet).
 */
export const AppIds = z.array(z.object({ kind: z.enum(APP_ID_KINDS), value: z.string().trim().min(1).max(200) })).max(8).optional();
export type AppId = NonNullable<z.infer<typeof AppIds>>[number];

const idKey = (i: { kind: string; value: string }) => `${i.kind}:${i.value.toLowerCase()}`;

/**
 * For each reported app with ids: the name the child's list already has it under, when one of its ids is known there.
 * Apps without ids, or with ids not seen before, keep the name they were reported with.
 */
export async function canonicalNames(childId: string, platform: Platform, apps: { name: string; ids?: AppId[] }[]) {
  const ids = apps.flatMap((a) => a.ids ?? []);
  const names = new Map<string, string>();
  if (!ids.length) return names;
  const rows = await db.appIdentifier.findMany({
    where: { childId, platform, OR: ids.map((i) => ({ kind: i.kind, value: i.value.toLowerCase() })) },
    select: { kind: true, value: true, childApp: { select: { name: true } } },
  });
  const byId = new Map(rows.map((r) => [idKey(r), r.childApp.name]));
  for (const a of apps) {
    const known = (a.ids ?? []).map((i) => byId.get(idKey(i))).find(Boolean);
    if (known && known !== a.name) names.set(a.name, known);
  }
  return names;
}

/** Records the ids of apps now on the child's list (by name), so the next report under another name merges. */
export async function rememberIds(childId: string, platform: Platform, apps: { name: string; ids?: AppId[] }[]) {
  const withIds = apps.filter((a) => a.ids?.length);
  if (!withIds.length) return;
  const listed = await db.childApp.findMany({ where: { childId, name: { in: withIds.map((a) => a.name) } }, select: { id: true, name: true } });
  const idOf = new Map(listed.map((l) => [l.name, l.id]));
  const data = withIds.flatMap((a) => {
    const childAppId = idOf.get(a.name);
    return childAppId ? a.ids!.map((i) => ({ childAppId, childId, platform, kind: i.kind, value: i.value.toLowerCase() })) : [];
  });
  // An id already on another app stays there (first seen wins): skipDuplicates on (childId, platform, kind, value)
  if (data.length) await db.appIdentifier.createMany({ data, skipDuplicates: true });
}

/** Ids per app name for the device's platform, for /sync: the device matches what it sees against them. */
export async function idsByApp(childId: string, platform: Platform) {
  const rows = await db.appIdentifier.findMany({ where: { childId, platform }, select: { kind: true, value: true, childApp: { select: { name: true } } } });
  const out = new Map<string, AppId[]>();
  for (const r of rows) out.set(r.childApp.name, [...(out.get(r.childApp.name) ?? []), { kind: r.kind, value: r.value }]);
  return out;
}
