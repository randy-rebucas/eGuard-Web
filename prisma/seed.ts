import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createDemoFamily } from "./demo-family";

/** Local development only: wipes every family, then creates the demo family. For production use scripts/seed-demo.ts. */
const db = new PrismaClient();

async function main() {
  await db.family.deleteMany();
  const pw = await bcrypt.hash("ChangeMe123!", 12);
  await createDemoFamily(db, {
    familyName: "Cruz Family",
    parents: [
      { email: "randy@example.com", name: "Randy Cruz", role: "FAMILY_ADMIN", passwordHash: pw, twoFactor: true },
      { email: "ana@example.com", name: "Ana Cruz", role: "PARENT", passwordHash: pw },
    ],
  });
  console.log("Seeded. Sign in with randy@example.com / ChangeMe123!");
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
