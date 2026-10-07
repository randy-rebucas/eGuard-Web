import "server-only";
import { db } from "./db";

/**
 * Full export of the family's data, including browsers, browser protection and organizations joined
 * (no password hashes, tokens or purchase tokens). Shared by the web (Settings › Export) and the mobile API.
 * Writes to the audit log, so callers expose it as POST.
 */
export async function exportFamily(user: { familyId: string; name: string }) {
  const family = await db.family.findUniqueOrThrow({
    where: { id: user.familyId },
    include: {
      users: {
        select: {
          name: true, email: true, role: true, createdAt: true, emailVerifiedAt: true, twoFactor: true,
          identities: { select: { provider: true, email: true, createdAt: true } },
        },
      },
      children: {
        include: {
          policies: { select: { key: true, config: true, updatedAt: true } },
          apps: { select: { name: true, approval: true, dailyLimitMinutes: true, category: true, installedAt: true } },
          categoryLimits: { select: { category: true, dailyLimitMinutes: true, updatedAt: true } },
          usage: { select: { date: true, minutes: true, deviceId: true } },
          appUsage: { select: { date: true, app: true, minutes: true, deviceId: true } },
          visits: { select: { deviceId: true, lat: true, lng: true, placeLabel: true, arrivedAt: true, lastSeenAt: true } },
          changes: { select: { key: true, title: true, actor: true, fromValue: true, toValue: true, createdAt: true } },
          browserPolicy: {
            select: {
              version: true, safeBrowsing: true, safeSearch: true, blockedCategories: true, blockedDomains: true, allowedDomains: true,
              unknownSitesPolicy: true, schedule: true, temporaryAllows: true, updatedBy: true, updatedAt: true,
            },
          },
          accessRequests: { select: { domain: true, reason: true, status: true, duration: true, expiresAt: true, decidedBy: true, decidedAt: true, createdAt: true } },
          devices: {
            select: {
              id: true, name: true, model: true, platform: true, osVersion: true, lastSeenAt: true, createdAt: true,
              protections: { select: { key: true, status: true, reported: true, lastVerifiedAt: true } },
              // locatedAt: when the position was taken (updatedAt also moves when sharing is turned on or off)
              location: { select: { sharing: true, lat: true, lng: true, accuracyM: true, placeLabel: true, locatedAt: true, updatedAt: true } },
            },
          },
        },
      },
      alerts: { select: { title: true, body: true, subject: true, severity: true, category: true, createdAt: true, resolvedAt: true } },
      auditLogs: { select: { actor: true, action: true, detail: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      supportTickets: { select: { category: true, subject: true, message: true, status: true, createdAt: true } },
      purchases: { select: { store: true, productId: true, state: true, autoRenewing: true, expiresAt: true, createdAt: true } },
      // The eGuard browser extension on the children's computers (never its tokens)
      browsers: {
        select: {
          childId: true, deviceLabel: true, browser: true, browserVersion: true, extensionVersion: true, platform: true,
          lastSeenAt: true, revokedAt: true, protectionState: true, appliedPolicyVersion: true, createdAt: true,
          dailyEvents: { select: { date: true, category: true, blockedCount: true } },
        },
      },
      orgMemberships: { select: { joinedAt: true, org: { select: { name: true, kind: true } } } },
      places: { select: { name: true, lat: true, lng: true, radiusM: true, notifyArrive: true, notifyLeave: true, createdAt: true } },
    },
  });
  await db.auditLog.create({ data: { familyId: user.familyId, actor: user.name, action: "data.exported" } });
  return { exportedAt: new Date().toISOString(), family };
}

export const EXPORT_FILENAME = "eguard-family-export.json";
