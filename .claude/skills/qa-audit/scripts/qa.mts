/**
 * QA helpers for the dev database (never production). Run from the repo root:
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts session <email>
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts fixture [plan] [childName]
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts cleanup
 * Sessions last an hour and are marked userAgent "qa-audit"; fixture families are named "QA Audit Fixture".
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

const FIXTURE = "QA Audit Fixture";
const MARK = "qa-audit";
const db = new PrismaClient();

if (/prod/i.test(process.env.NODE_ENV ?? "") || /prod/i.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refusing to run against what looks like a production database.");
  process.exit(1);
}

async function session(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { userId, tokenHash: createHash("sha256").update(token).digest("hex"), userAgent: MARK, expiresAt: new Date(Date.now() + 3600e3) },
  });
  return token;
}

const [cmd, a, b] = process.argv.slice(2);
try {
  if (cmd === "session") {
    const u = await db.user.findUniqueOrThrow({ where: { email: a ?? "randy@example.com" } });
    console.log(`TOKEN=${await session(u.id)}`);
  } else if (cmd === "fixture") {
    const plan = a ?? "Free";
    const deviceLimit = plan === "Family Pro" ? 20 : plan === "eGuard Plus" ? 10 : 2;
    const f = await db.family.create({
      data: {
        name: FIXTURE, plan, deviceLimit,
        users: { create: { email: `qa-${Date.now()}@example.invalid`, name: "QA Parent", passwordHash: "x", role: "FAMILY_ADMIN", emailVerifiedAt: new Date() } },
        ...(b ? { children: { create: { name: b, birthYear: new Date().getFullYear() - 10 } } } : {}),
      },
      include: { users: true, children: true },
    });
    console.log(`TOKEN=${await session(f.users[0].id)} FAMILY=${f.id}${f.children[0] ? ` CHILD=${f.children[0].id}` : ""}`);
  } else if (cmd === "cleanup") {
    const families = await db.family.deleteMany({ where: { name: FIXTURE } });
    const sessions = await db.session.deleteMany({ where: { userAgent: MARK } });
    console.log(`deleted families=${families.count} sessions=${sessions.count}`);
  } else {
    console.error("usage: qa.mts session <email> | fixture [plan] [childName] | cleanup");
    process.exitCode = 1;
  }
} finally {
  await db.$disconnect();
}
