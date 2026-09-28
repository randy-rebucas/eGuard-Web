import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Full export of the family's data (no password hashes, tokens or purchase tokens).
 * POST, since it writes to the audit log: a GET could be fired by a link or prefetch. The session cookie
 * is SameSite=Lax, so another site can't submit this for the parent.
 */
export async function POST() {
  const u = await getUser();
  if (!u) return new Response("Unauthorized", { status: 401 });
  const family = await db.family.findUniqueOrThrow({
    where: { id: u.familyId },
    include: {
      users: {
        select: {
          name: true, email: true, role: true, createdAt: true, emailVerifiedAt: true,
          identities: { select: { provider: true, email: true, createdAt: true } },
        },
      },
      children: {
        include: {
          policies: { select: { key: true, config: true, updatedAt: true } },
          apps: { select: { name: true, approval: true, dailyLimitMinutes: true, installedAt: true } },
          usage: { select: { date: true, minutes: true, deviceId: true } },
          appUsage: { select: { date: true, app: true, minutes: true, deviceId: true } },
          visits: { select: { deviceId: true, lat: true, lng: true, placeLabel: true, arrivedAt: true, lastSeenAt: true } },
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
      auditLogs: { select: { actor: true, action: true, detail: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      supportTickets: { select: { category: true, subject: true, message: true, status: true, createdAt: true } },
      purchases: { select: { store: true, productId: true, state: true, autoRenewing: true, expiresAt: true, createdAt: true } },
    },
  });
  await db.auditLog.create({ data: { familyId: u.familyId, actor: u.name, action: "data.exported" } });
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), family }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="eguard-family-export.json"` },
  });
}
