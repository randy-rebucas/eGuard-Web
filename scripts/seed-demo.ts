/**
 * Creates (or refreshes) the store-review demo account in any database, production included.
 * Unlike prisma/seed.ts it never touches other families: it only deletes a previous demo family, and refuses
 * if the demo email belongs to anything else.
 *
 *   DATABASE_URL=... npx tsx scripts/seed-demo.ts            # dry run: shows what it would do
 *   DATABASE_URL=... npx tsx scripts/seed-demo.ts --apply    # does it
 *
 * DEMO_EMAIL (default review@eguard.family) and DEMO_PASSWORD (default: a new random one, printed once).
 * The demo devices don't sync in production, so they show as offline after about a day. Re-run with --apply
 * right before a review to refresh them.
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createDemoFamily } from "../prisma/demo-family";

const DEMO_FAMILY = "eGuard Demo Family";
const email = (process.env.DEMO_EMAIL || "review@eguard.family").trim().toLowerCase();
const apply = process.argv.includes("--apply");

function makePassword() {
  // 16 characters from an unambiguous alphabet, plus a symbol and digit so it passes any password rule
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return `${Array.from(randomBytes(14), (b) => abc[b % abc.length]).join("")}-7`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL to the target database.");
  const host = new URL(url).hostname;
  const db = new PrismaClient({ datasourceUrl: url });

  try {
    const existing = await db.user.findUnique({ where: { email }, include: { family: { include: { users: { select: { email: true } } } } } });
    if (existing) {
      const others = existing.family.users.filter((u) => u.email !== email);
      if (existing.family.name !== DEMO_FAMILY || others.length) {
        throw new Error(`${email} already belongs to "${existing.family.name}"${others.length ? ` with ${others.length} other parent(s)` : ""}. Refusing to touch it.`);
      }
    }

    console.log(`Target:  ${host}`);
    console.log(`Account: ${email}`);
    console.log(existing ? `Will replace the existing "${DEMO_FAMILY}" (${existing.familyId}).` : `Will create "${DEMO_FAMILY}".`);
    if (!apply) {
      console.log("\nDry run. Nothing changed. Re-run with --apply.");
      return;
    }

    const password = process.env.DEMO_PASSWORD || makePassword();
    if (password.length < 8) throw new Error("DEMO_PASSWORD must be at least 8 characters.");
    const passwordHash = await bcrypt.hash(password, 12);

    if (existing) await db.family.delete({ where: { id: existing.familyId } }); // cascades to its children, devices and history
    const family = await createDemoFamily(db, {
      familyName: DEMO_FAMILY,
      parents: [{ email, name: "Demo Parent", role: "FAMILY_ADMIN", passwordHash, notifyEmail: false }],
    });

    console.log(`\nDone. Family ${family.id} on Family Pro: Mia, Lucas and Sophie with 5 devices.`);
    console.log(`Sign in with ${email} / ${process.env.DEMO_PASSWORD ? "(DEMO_PASSWORD)" : password}`);
    if (!process.env.DEMO_PASSWORD) console.log("Save this password now; it isn't stored anywhere else.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
