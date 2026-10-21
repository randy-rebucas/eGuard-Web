import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** The parent-care migrations only add: nothing existing is dropped, renamed or rewritten, so they're safe on production. */

const DIR = join(process.cwd(), "prisma", "migrations");
const careMigrations = readdirSync(DIR).filter((d) => d.includes("parent_care"));
const sql = (d: string) => readFileSync(join(DIR, d, "migration.sql"), "utf8").replace(/--.*$/gm, "");
const statements = (d: string) => sql(d).split(";").map((s) => s.trim()).filter(Boolean);

describe("parent-care migrations", () => {
  it("exist", () => {
    expect(careMigrations.length).toBeGreaterThanOrEqual(2);
  });

  it("only create new tables, indexes and keys, or add columns with defaults to their own tables", () => {
    for (const d of careMigrations) {
      for (const s of statements(d)) {
        const ok = /^CREATE TABLE "ParentCare\w+"/.test(s)
          || /^CREATE (UNIQUE )?INDEX "ParentCare\w+" ON "ParentCare\w+"/.test(s)
          || /^ALTER TABLE "ParentCare\w+" ADD CONSTRAINT "\w+" FOREIGN KEY/.test(s)
          || /^ALTER TABLE "ParentCare\w+" ADD COLUMN\s+"\w+" \w+ NOT NULL DEFAULT/.test(s);
        expect(ok, `${d}: ${s.slice(0, 120)}`).toBe(true);
        // "ON DELETE CASCADE" in a foreign key is fine: it's what removes a parent's rows with their account
        expect(s).not.toMatch(/\bDROP\b|\bTRUNCATE\b|(?<!ON )\bDELETE\b|\bRENAME\b/i);
      }
    }
  });

  it("have a rollback that drops only the parent-care tables", () => {
    const down = readFileSync(join(process.cwd(), "prisma", "rollbacks", "20261021121155_parent_care.down.sql"), "utf8").replace(/--.*$/gm, "");
    const drops = [...down.matchAll(/DROP TABLE IF EXISTS "(\w+)"/g)].map((m) => m[1]);
    expect(drops.length).toBe(9);
    expect(drops.every((t) => t.startsWith("ParentCare"))).toBe(true);
    for (const d of careMigrations) expect(down).toContain(d);
  });
});
