import { NextResponse } from "next/server";
import { z } from "zod";
import { authDevice, badRequest, readJson, TOO_LARGE, tooLarge, tooMany, unauthorized } from "@/lib/device-auth";
import { checkDevicePin } from "@/lib/device-pin";
import { audit } from "@/lib/family-service";

const Body = z.object({ pin: z.string().max(20) });

/**
 * "Parent settings" on a child's iPhone: checks the family's parent PIN (lib/device-pin). Online only, five tries per
 * 15 minutes per device. `200 { ok }`, `403` wrong PIN, `409` no PIN set yet (set it in the parent app), `429`.
 */
export async function POST(req: Request) {
  const device = await authDevice(req);
  if (!device) return unauthorized();
  const raw = await readJson(req);
  if (raw === TOO_LARGE) return tooLarge();
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return badRequest("pin: enter the parent PIN.");
  const r = await checkDevicePin(device, parsed.data.pin);
  switch (r.result) {
    case "limited":
      return tooMany("Too many tries. Wait a few minutes and try again.", r.retryAfter);
    case "not_set":
      return NextResponse.json({ error: "No parent PIN is set yet. A parent sets one in eGuard › Settings › Family." }, { status: 409 });
    case "wrong":
      await audit(device.familyId, device.name, "device_pin.wrong", `on ${device.name}`);
      return NextResponse.json({ error: "That PIN isn't right." }, { status: 403 });
    case "ok":
      // So parents can see when app rules on a child's phone were opened, and on which phone
      await audit(device.familyId, device.name, "device_pin.unlocked", `on ${device.name}`);
      return NextResponse.json({ ok: true });
  }
}
