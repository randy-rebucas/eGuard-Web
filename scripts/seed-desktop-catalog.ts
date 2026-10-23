import { PrismaClient } from "@prisma/client";
import { DESKTOP_CATALOG } from "../src/lib/desktop-catalog";

/**
 * Puts the desktop agent's catalog (src/lib/desktop-catalog.ts) in the database, which GET /api/device/v1/catalog
 * serves. Safe to run again: it adds new entries and updates changed ones, and never deletes (remove a row by hand).
 * Run with `npx tsx scripts/seed-desktop-catalog.ts` (prisma/seed.ts also runs it).
 */
export async function seedDesktopCatalog(db: PrismaClient) {
  let changed = 0;
  for (const e of DESKTOP_CATALOG) {
    const where = { kind_matchType_match: { kind: e.kind, matchType: e.matchType, match: e.match } };
    const data = { displayName: e.displayName ?? null, category: e.category ?? null, trending: e.trending ?? false };
    const had = await db.desktopCatalogEntry.findUnique({ where });
    if (had && had.displayName === data.displayName && had.category === data.category && had.trending === data.trending) continue;
    // Only rows that changed get a new updatedAt, so agents download the catalog again only when something did
    await db.desktopCatalogEntry.upsert({ where, create: { kind: e.kind, matchType: e.matchType, match: e.match, ...data }, update: data });
    changed++;
  }
  return changed;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/seed-desktop-catalog.ts")) {
  const db = new PrismaClient();
  seedDesktopCatalog(db)
    .then((n) => console.log(`Desktop catalog: ${n} of ${DESKTOP_CATALOG.length} entries added or updated.`))
    .finally(() => db.$disconnect());
}
