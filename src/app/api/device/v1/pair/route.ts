import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { newToken, sha256 } from "@/lib/auth";
import { badRequest, readJson } from "@/lib/device-auth";

const Body = z.object({
  code: z.string().trim().min(6).max(12),
  platform: z.enum(["ANDROID", "IOS"]),
  name: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  kind: z.enum(["PHONE", "TABLET"]).default("PHONE"),
  osVersion: z.string().trim().min(1).max(40),
  appVersion: z.string().trim().max(20).optional(),
});

/** Exchange a one-time pairing code (shown in the parent dashboard) for a device token. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const b = parsed.data;
  const code = await db.pairingCode.findUnique({ where: { code: b.code.toUpperCase() }, include: { family: true } });
  if (!code || code.usedAt || code.expiresAt < new Date()) return NextResponse.json({ error: "Pairing code is invalid or expired" }, { status: 400 });
  const count = await db.device.count({ where: { familyId: code.familyId } });
  if (count >= code.family.deviceLimit) return NextResponse.json({ error: "Device limit reached for this plan" }, { status: 409 });

  const token = newToken();
  const hasPrimary = await db.device.count({ where: { childId: code.childId, isPrimary: true } });
  const device = await db.device.create({
    data: {
      familyId: code.familyId, childId: code.childId, name: b.name, model: b.model, kind: b.kind, platform: b.platform,
      osVersion: b.osVersion, appVersion: b.appVersion, tokenHash: sha256(token), lastSeenAt: new Date(), isPrimary: !hasPrimary,
    },
    include: { child: true },
  });
  await db.pairingCode.update({ where: { id: code.id }, data: { usedAt: new Date() } });
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
