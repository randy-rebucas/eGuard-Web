import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { newToken, sha256 } from "@/lib/auth";
import { badRequest, readJson } from "@/lib/device-auth";
import { refreshPurchases } from "@/lib/billing";
import { LIMITS, clientIpFrom, hit, ipKey } from "@/lib/rate-limit";
import { withDeviceSlot } from "@/lib/device-slots";

const Body = z.object({
  // Parents may type "ABCD-2345" or "abcd 2345" (same as the browser extension)
  code: z.string().transform((s) => s.replace(/[\s-]/g, "").toUpperCase()).pipe(z.string().min(6).max(12)),
  platform: z.enum(["ANDROID", "IOS"]),
  name: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  kind: z.enum(["PHONE", "TABLET"]).default("PHONE"),
  osVersion: z.string().trim().min(1).max(40),
  appVersion: z.string().trim().max(20).optional(),
});

/** Exchange a one-time pairing code (shown in the parent dashboard) for a device token. */
export async function POST(req: Request) {
  if ((await hit(ipKey("pair", clientIpFrom(req.headers)), LIMITS.pairIp)).limited) {
    return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
  }
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const b = parsed.data;
  const invalidCode = () => NextResponse.json({ error: "Pairing code is invalid or expired" }, { status: 400 });
  const code = await db.pairingCode.findUnique({ where: { code: b.code } });
  if (!code || code.usedAt || code.expiresAt < new Date()) return invalidCode();
  if (code.kind !== "DEVICE") {
    return NextResponse.json({ error: "This code is for the eGuard browser extension. In the parent dashboard, choose Pair a device to get a code for this app." }, { status: 400 });
  }
  // Claim the code first, atomically: of two devices racing with the same code, only one gets past here
  const claimed = await db.pairingCode.updateMany({ where: { id: code.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  if (!claimed.count) return invalidCode();
  // Give the code back: after removing a device (limit reached), or after a failure here, the parent can use it again
  const release = () => db.pairingCode.update({ where: { id: code.id }, data: { usedAt: null } });
  // A store that can't be reached right now mustn't stop pairing: the plan as last known decides the limit
  await refreshPurchases(code.familyId).catch((e) => console.error("[pair] refreshing purchases failed", code.familyId, e));
  const token = newToken();
  let device;
  try {
    const family = await db.family.findUniqueOrThrow({ where: { id: code.familyId } });
    // The slot lock also serializes the primary check, so two devices pairing at once can't both be primary
    device = await withDeviceSlot(code.familyId, family.deviceLimit, async (tx) => {
      const hasPrimary = await tx.device.count({ where: { childId: code.childId, isPrimary: true } });
      return tx.device.create({
        data: {
          familyId: code.familyId, childId: code.childId, name: b.name, model: b.model, kind: b.kind, platform: b.platform,
          osVersion: b.osVersion, appVersion: b.appVersion, tokenHash: sha256(token), lastSeenAt: new Date(), isPrimary: !hasPrimary,
        },
        include: { child: true },
      });
    });
  } catch (e) {
    await release().catch(() => {});
    throw e;
  }
  if (!device) {
    await release();
    return NextResponse.json({ error: "Device limit reached for this plan" }, { status: 409 });
  }
  await db.alert.create({
    data: {
      familyId: code.familyId, childId: code.childId, deviceId: device.id, severity: "INFO", category: "DEVICES", icon: "refresh-cw",
      title: "New device synchronized", body: `${device.name} joined your family. eGuard will verify its protections on first sync.`,
      subject: `${device.child.name}'s ${device.name}`,
    },
  });
  // Ask the new device for a full report so health is known right away
  await db.device.update({ where: { id: device.id }, data: { checkRequestedAt: new Date() } });
  return NextResponse.json({ deviceId: device.id, token, childName: device.child.name }, { status: 201 });
}
