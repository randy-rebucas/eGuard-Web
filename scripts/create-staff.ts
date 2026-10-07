/**
 * Creates a staff account for the console (console.eguard.family, docs/console.md), or resets one. There is no
 * sign-up page: this script is the only way in.
 *
 *   npx tsx scripts/create-staff.ts ana@eguard.family "Ana Reyes"   # create, or reset password and authenticator
 *   npx tsx scripts/create-staff.ts ana@eguard.family --deactivate   # can't sign in any more; signed out everywhere
 *
 * Prints a new password and an authenticator QR code, once. Resetting also reactivates the account and signs it
 * out everywhere. Uses DATABASE_URL and TWO_FACTOR_KEY from the environment (or .env): TWO_FACTOR_KEY must be the
 * same as the server's, or the codes won't work there.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { newSecret, otpauthUri, sealSecret, secretKey } from "../src/lib/totp";

function makePassword() {
  // 20 characters from an unambiguous alphabet: meant for a password manager, not memory
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(randomBytes(20), (b) => abc[b % abc.length]).join("");
}

async function main() {
  const [rawEmail, second] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !second) {
    throw new Error('Usage: npx tsx scripts/create-staff.ts <email> "<name>"   or   <email> --deactivate');
  }
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to the target database.");
  const db = new PrismaClient();
  try {
    if (second === "--deactivate") {
      const staff = await db.staffUser.findUnique({ where: { email } });
      if (!staff) throw new Error(`No staff account for ${email}.`);
      await db.$transaction([
        db.staffUser.update({ where: { id: staff.id }, data: { active: false } }),
        db.staffSession.deleteMany({ where: { staffId: staff.id } }),
      ]);
      console.log(`${email} is deactivated and signed out everywhere.`);
      return;
    }

    if (!process.env.TWO_FACTOR_KEY?.trim()) {
      console.warn("TWO_FACTOR_KEY isn't set: using the development key. This account's codes only work on a server without TWO_FACTOR_KEY (local development).\n");
    }
    const key = secretKey({ ...process.env, NODE_ENV: "development" })!;
    const name = second.trim().slice(0, 100);
    const password = makePassword();
    const secret = newSecret();
    const data = { name, passwordHash: await bcrypt.hash(password, 12), totpSecret: sealSecret(secret, key), totpLastStep: null, active: true };
    const existing = await db.staffUser.findUnique({ where: { email } });
    if (existing) {
      await db.$transaction([
        db.staffUser.update({ where: { id: existing.id }, data }),
        db.staffSession.deleteMany({ where: { staffId: existing.id } }),
      ]);
    } else {
      await db.staffUser.create({ data: { email, ...data } });
    }

    const uri = otpauthUri(secret, email, "eGuard Console");
    console.log(`${existing ? "Reset" : "Created"} staff account ${email} (${name}).\n`);
    console.log(`Password (shown once, save it in a password manager):\n  ${password}\n`);
    console.log("Scan this with an authenticator app (1Password, Google Authenticator, Authy…):\n");
    console.log(await QRCode.toString(uri, { type: "terminal", small: true }));
    console.log(`Or enter this setup key by hand: ${uri.match(/secret=([A-Z2-7]+)/)![1]}\n`);
    console.log("Sign in at https://console.eguard.family (http://console.localhost:3000 in development).");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
