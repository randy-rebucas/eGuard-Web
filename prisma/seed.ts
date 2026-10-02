import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createDemoFamily } from "./demo-family";
import { createDemoOrganization } from "./demo-organization";

/**
 * Local development only: wipes every family and organization, then creates the demo family and the demo
 * organization. For production use scripts/seed-demo.ts.
 */
const db = new PrismaClient();

async function main() {
  await db.organization.deleteMany(); // not deleted with families
  await db.family.deleteMany();
  const pw = await bcrypt.hash("ChangeMe123!", 12);
  const family = await createDemoFamily(db, {
    familyName: "Cruz Family",
    parents: [
      // Two-step verification off: turning it on takes an authenticator secret (Settings › Privacy & security)
      { email: "randy@example.com", name: "Randy Cruz", role: "FAMILY_ADMIN", passwordHash: pw },
      { email: "ana@example.com", name: "Ana Cruz", role: "PARENT", passwordHash: pw },
    ],
  });
  const randy = await db.user.findUniqueOrThrow({ where: { email: "randy@example.com" } });
  const demo = await createDemoOrganization(db, {
    owner: { email: "school@example.com", name: "Maria Santos", passwordHash: pw },
    adminUserIds: [randy.id],
    joinedFamilyIds: [family.id],
    joinCode: "SCHL7K2P",
  });
  // A read-only API key, created by Randy (Family Pro includes API access). Fixed so local scripts can use it
  const apiKey = "egk_local-demo-key-san-isidro-elementary-school";
  await db.orgApiKey.create({
    data: { orgId: demo.org.id, name: "Demo script", access: "READ", prefix: apiKey.slice(0, 12), tokenHash: createHash("sha256").update(apiKey).digest("hex"), createdById: randy.id },
  });

  console.log("Seeded. Sign in with randy@example.com / ChangeMe123!");
  console.log(`Organization "${demo.org.name}": owner school@example.com / ChangeMe123!, join code SCHL-7K2P`);
  const fmt = (code: string) => code.match(/.{4}/g)!.join("-");
  console.log(`Organization API key (read only): ${apiKey}  e.g. curl localhost:3000/api/org/v1/organization -H "Authorization: Bearer ${apiKey}"`);
  console.log(`Unused sponsor codes: ${fmt(demo.availablePlusCode)} (eGuard Plus, 3 months), ${fmt(demo.availableProCode)} (Family Pro, 1 month)`);
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
