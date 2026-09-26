import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authDevice, badRequest, readJson, unauthorized } from "@/lib/device-auth";

const Body = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(100000).optional(),
  placeLabel: z.string().max(80).optional(),
});

/** Current location only. eGuard overwrites the previous value and keeps no trail. */
export async function POST(req: Request) {
  const device = await authDevice(req);
  if (!device) return unauthorized();
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const b = parsed.data;
  await db.deviceLocation.upsert({
    where: { deviceId: device.id },
    create: { deviceId: device.id, sharing: true, locatedAt: new Date(), ...b },
    update: { sharing: true, locatedAt: new Date(), ...b },
  });
  await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
