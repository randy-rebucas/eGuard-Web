import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Full export of the family's data (no password hashes or tokens). */
export async function GET() {
  const u = await getUser();
  if (!u) return new Response("Unauthorized", { status: 401 });
  const family = await db.family.findUniqueOrThrow({
    where: { id: u.familyId },
    include: {
      users: { select: { name: true, email: true, role: true, createdAt: true } },
      children: {
        include: {
          policies: { select: { key: true, config: true, updatedAt: true } },
          apps: { select: { name: true, approval: true, dailyLimitMinutes: true, installedAt: true } },
          usage: { select: { date: true, minutes: true, deviceId: true } },
          appUsage: { select: { date: true, app: true, minutes: true } },
          changes: { select: { key: true, title: true, actor: true, fromValue: true, toValue: true, createdAt: true } },
          devices: {
            select: {
              id: true, name: true, model: true, platform: true, osVersion: true, lastSeenAt: true, createdAt: true,
              protections: { select: { key: true, status: true, reported: true, lastVerifiedAt: true } },
              location: { select: { sharing: true, lat: true, lng: true, placeLabel: true, updatedAt: true } },
            },
          },
        },
      },
      alerts: { select: { title: true, body: true, subject: true, severity: true, category: true, createdAt: true, resolvedAt: true } },
    },
  });
  await db.auditLog.create({ data: { familyId: u.familyId, actor: u.name, action: "data.exported" } });
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), family }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="eguard-family-export.json"` },
  });
}
