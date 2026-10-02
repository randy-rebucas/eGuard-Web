import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { removeDevice } from "@/lib/family-service";
import { notFound } from "@/lib/errors";
import { CAPABILITY_META, PROTECTIONS, describeConfig } from "@/lib/protections";
import { getFamily } from "@/lib/queries";
import { ConfirmBody, authed, body } from "@/lib/mobile-api";
import { deviceJson, getFamilyGraph } from "@/lib/mobile-views";

async function detail(familyId: string, deviceId: string) {
  const [family, graph] = await Promise.all([getFamily(familyId), getFamilyGraph(familyId)]);
  const d = graph.devices.find((x) => x.id === deviceId);
  if (!d) throw notFound("Device");
  return {
    ...deviceJson(d, graph, family.timezone),
    protections: PROTECTIONS.map((p) => {
      const row = d.protections.find((x) => x.key === p.key);
      const cap = p.caps[d.platform];
      return {
        key: p.key, name: p.name, icon: p.icon, capability: cap, capabilityLabel: CAPABILITY_META[cap].label,
        // Same wording as the web device page
        status: row?.status ?? "NOT_CONFIGURED",
        reportedLabel: !row ? "Unknown" : row.status === "UNSUPPORTED" ? "Not supported" : row.status === "NOT_CONFIGURED" ? "Not configured" : describeConfig(row.reported),
        message: row?.message ?? null, lastVerifiedAt: row?.lastVerifiedAt ?? null,
      };
    }),
  };
}

/** Device detail: every protection, its platform capability and when it was last verified. */
export const GET = authed<{ id: string }>(async ({ user, params }) => NextResponse.json(await detail(user.familyId, params.id)));

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, z.object({ name: z.string().trim().min(1, "Enter a device name.").max(60, "Use up to 60 characters.") }));
  const r = await db.device.updateMany({ where: { id: params.id, familyId: user.familyId }, data: { name: b.name } });
  if (!r.count) throw notFound("Device");
  return NextResponse.json(await detail(user.familyId, params.id));
});

/**
 * Removes the device from the family. Its token stops working immediately. Needs the parent's password,
 * and the family gets a "Device removed" alert (emailed), since eGuard stops verifying the device.
 */
export const DELETE = authed<{ id: string }>(async ({ req, user, params }) => {
  // A missing password gets 403 wrong_password (after the 404 check), like a wrong one
  const b = await body(req, ConfirmBody);
  await removeDevice(user, params.id, { password: b.password, phrase: b.confirm });
  return NextResponse.json({ ok: true });
});
