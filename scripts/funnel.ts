/**
 * Counts the sign-up funnel from the database, so measuring it needs no third-party tracking.
 * Each step counts families (one per sign-up) created in the window, leaving out the store-review demo family.
 *
 *   DATABASE_URL=... npx tsx scripts/funnel.ts            # families created in the last 30 days
 *   DATABASE_URL=... npx tsx scripts/funnel.ts --days 7
 *   DATABASE_URL=... npx tsx scripts/funnel.ts --days 0   # all time
 *
 * It shows where families stand now: a child or device that was later removed no longer counts.
 */
import { PrismaClient } from "@prisma/client";

const DEMO_FAMILY = "eGuard Demo Family";

function days() {
  const i = process.argv.indexOf("--days");
  const n = i === -1 ? 30 : Number(process.argv[i + 1]);
  if (!Number.isInteger(n) || n < 0) throw new Error("--days takes a whole number (0 for all time).");
  return n;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL to the target database.");
  const db = new PrismaClient({ datasourceUrl: url });
  const n = days();
  const since = n ? new Date(Date.now() - n * 864e5) : undefined;
  const base = { name: { not: DEMO_FAMILY }, ...(since ? { createdAt: { gte: since } } : {}) };

  try {
    const steps: [string, number][] = [
      ["Created account", await db.family.count({ where: base })],
      ["Verified email", await db.family.count({ where: { ...base, users: { some: { emailVerifiedAt: { not: null } } } } })],
      ["Added a child", await db.family.count({ where: { ...base, children: { some: {} } } })],
      ["Paired a device", await db.family.count({ where: { ...base, devices: { some: { tokenHash: { not: null }, simulated: false } } } })],
      ["Upgraded", await db.family.count({ where: { ...base, plan: { not: "Free" } } })],
    ];

    console.log(`Target: ${new URL(url).hostname}`);
    console.log(since ? `Families created since ${since.toISOString().slice(0, 10)} (${n} days)\n` : "All families\n");
    const width = Math.max(...steps.map(([label]) => label.length));
    steps.forEach(([label, count], i) => {
      const prev = i ? steps[i - 1][1] : 0;
      const step = i ? (prev ? `${Math.round((count / prev) * 100)}% of previous step` : "n/a") : "";
      console.log(`${label.padEnd(width)}  ${String(count).padStart(6)}  ${step}`);
    });
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
