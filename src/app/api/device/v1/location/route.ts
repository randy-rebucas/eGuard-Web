import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { recordLocation } from "@/lib/location";
import { authDevice, badRequest, readJson, unauthorized } from "@/lib/device-auth";

const Body = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(100000).optional(),
  placeLabel: z.string().max(80).optional(),
});

/**
 * Current location. eGuard overwrites the previous value; it only keeps a trail of visits
 * when the family has turned on location history in Privacy settings.
 */
export async function POST(req: Request) {
  const device = await authDevice(req);
  if (!device) return unauthorized();
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  await recordLocation(device, parsed.data);
  await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
