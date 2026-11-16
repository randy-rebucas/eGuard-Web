import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/family-service";
import { authed, body, requireAdminUser } from "@/lib/mobile-api";
import { DevicePin, devicePinState, setDevicePin } from "@/lib/device-pin";

/** Settings › Family › Child device PIN: whether one is set (never the PIN). Any parent may ask. */
export const GET = authed(async ({ user }) => NextResponse.json(await devicePinState(user.familyId)));

const Body = z.object({ pin: DevicePin.nullable() });

/** Sets (`{ pin: "1234" }`) or clears (`{ pin: null }`) the PIN that opens "Parent settings" on a child's iPhone. Admin only. */
export const PUT = authed(async ({ req, user }) => {
  requireAdminUser(user);
  const b = await body(req, Body);
  const state = await setDevicePin(user.familyId, b.pin);
  await audit(user.familyId, user.name, b.pin ? "device_pin.set" : "device_pin.cleared", "");
  return NextResponse.json(state);
});
