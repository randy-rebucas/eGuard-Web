import "server-only";
import type { BrowserInstallation } from "@prisma/client";
import { db } from "./db";
import { confirmDestructive, newToken, sha256 } from "./auth";
import { audit } from "./audit";
import { refreshPurchases } from "./billing";
import { withDeviceSlot } from "./device-slots";
import { ServiceError, notFound } from "./errors";
import { OFFLINE_AFTER_MS } from "./health";
import { signRevocation } from "./browser-policy";
import type { Actor } from "./config-service";

/**
 * The eGuard browser extension (/api/browser/v1). A parent adds a browser with a one-time BROWSER pairing
 * code; the extension exchanges it for an installation. No parent credential ever reaches the child's browser.
 */

export const ACCESS_TOKEN_MS = 15 * 60_000;
/**
 * A refresh token that was just rotated out may be presented again once in this window: the extension's
 * previous refresh succeeded on the server but the response was lost. Later than that, it was copied.
 */
export const REFRESH_RETRY_GRACE_MS = 2 * 60_000;

export const browserLabel = (b: Pick<BrowserInstallation, "browser" | "deviceLabel">) => `${b.browser} on ${b.deviceLabel}`;

export type TokenGrant = { accessToken: string; accessTokenExpiresAt: string; refreshToken: string };

function newGrant() {
  const accessToken = newToken();
  const refreshToken = newToken();
  const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_MS);
  return {
    grant: { accessToken, refreshToken, accessTokenExpiresAt: accessTokenExpiresAt.toISOString() } satisfies TokenGrant,
    hashes: { accessTokenHash: sha256(accessToken), refreshTokenHash: sha256(refreshToken), accessTokenExpiresAt },
  };
}

export type PairInput = { code: string; browser: string; browserVersion: string | null; extensionVersion: string; platform: string };

const invalidCode = () => new ServiceError(400, "Pairing code is invalid or expired", "invalid_code");

/** Exchanges a BROWSER pairing code for an installation and its first tokens. */
export async function pairBrowser(input: PairInput) {
  const code = await db.pairingCode.findUnique({ where: { code: input.code } });
  if (!code || code.usedAt || code.expiresAt < new Date()) throw invalidCode();
  if (code.kind !== "BROWSER") {
    throw new ServiceError(400, "This code is for the eGuard phone app. In the parent dashboard, choose Add a browser to get a browser code.", "wrong_code_kind");
  }
  // Claim first, atomically: of two browsers racing with the same code, only one gets past here
  const claimed = await db.pairingCode.updateMany({ where: { id: code.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  if (!claimed.count) throw invalidCode();

  // Give the code back: after removing a device (limit reached), or after a failure here, the parent can use it again
  const release = () => db.pairingCode.update({ where: { id: code.id }, data: { usedAt: null } });
  // A store that can't be reached right now mustn't stop pairing (as for phones): the plan as last known decides
  await refreshPurchases(code.familyId).catch((e) => console.error("[browser pair] refreshing purchases failed", code.familyId, e));
  const { grant, hashes } = newGrant();
  let inst, family;
  try {
    family = await db.family.findUniqueOrThrow({ where: { id: code.familyId } });
    // Same slot lock as device pairing: a phone and a browser can't both take the last slot
    inst = await withDeviceSlot(code.familyId, family.deviceLimit, (tx) => tx.browserInstallation.create({
      data: {
        familyId: code.familyId, childId: code.childId, deviceLabel: code.deviceLabel ?? "Computer",
        browser: input.browser, browserVersion: input.browserVersion, extensionVersion: input.extensionVersion, platform: input.platform,
        ...hashes, lastSeenAt: new Date(),
      },
      include: { child: true },
    }));
  } catch (e) {
    await release().catch(() => {});
    throw e;
  }
  if (!inst) {
    await release();
    throw new ServiceError(409, "Device limit reached for this plan", "device_limit");
  }
  const label = `${inst.child.name}'s ${browserLabel(inst)}`;
  await audit(code.familyId, "eGuard browser extension", "browser.paired", label);
  await db.alert.create({
    data: {
      familyId: code.familyId, childId: code.childId, severity: "INFO", category: "DEVICES", icon: "globe",
      title: "Browser connected", subject: label,
      body: `${browserLabel(inst)} is now connected to eGuard for ${inst.child.name}.`,
    },
  });
  return { installationId: inst.id, familyName: family.name, childName: inst.child.name, deviceName: inst.deviceLabel, ...grant };
}

const unauthorized = () => new ServiceError(401, "This browser is no longer connected to eGuard.", "unauthorized");
/**
 * Final answers, with eGuard's signed revocation (signRevocation): the extension disconnects and lifts its rules
 * only on a revocation that verifies. A plain `unauthorized` never disconnects it. `installation_revoked` also
 * covers an id with no row: a removed browser's row is deleted.
 */
const withProof = (installationId: string) => {
  const proof = signRevocation(installationId);
  return proof ? { revocation: proof } : undefined;
};
const revoked = (installationId: string) =>
  new ServiceError(401, "This browser is no longer connected to eGuard.", "installation_revoked", withProof(installationId));
const reused = (installationId: string) =>
  new ServiceError(401, "eGuard disconnected this browser because its sign-in key was used from two places.", "token_reused", withProof(installationId));

/**
 * Rotates the refresh token and issues a new access token. A rotated-out token presented again after the
 * grace window, when the tokens that replaced it were already used, means someone copied it: the installation is
 * disconnected and the family told.
 */
export async function refreshBrowserTokens(installationId: string, refreshToken: string): Promise<TokenGrant> {
  const hash = sha256(refreshToken);
  const now = new Date();
  const { grant, hashes } = newGrant();

  // Normal rotation. The WHERE on the current hash makes concurrent refreshes with one token rotate once.
  const rotated = await db.browserInstallation.updateMany({
    where: { id: installationId, refreshTokenHash: hash, revokedAt: null },
    data: { ...hashes, prevRefreshTokenHash: hash, refreshRotatedAt: now, lastSeenAt: now },
  });
  if (rotated.count) return grant;

  const replayed = await db.browserInstallation.findFirst({
    where: { id: installationId, prevRefreshTokenHash: hash, revokedAt: null },
    include: { child: true },
  });
  if (!replayed) {
    const live = await db.browserInstallation.findFirst({ where: { id: installationId, revokedAt: null }, select: { id: true } });
    throw live ? unauthorized() : revoked(installationId);
  }

  const withinGrace = replayed.refreshRotatedAt && now.getTime() - replayed.refreshRotatedAt.getTime() < REFRESH_RETRY_GRACE_MS;
  // Nothing has used the tokens of the last rotation (authBrowser moves lastSeenAt past refreshRotatedAt): the
  // extension never got them (a slow server answered after it gave up, or the browser closed before saving them).
  // Then the old token is still its own, however late it comes back.
  const unused = replayed.refreshRotatedAt && replayed.lastSeenAt && replayed.lastSeenAt <= replayed.refreshRotatedAt;
  if (withinGrace || unused) {
    // Lost response: fresh tokens. A new rotation time with lastSeenAt equal to it, so they too count as unused
    // until something uses them; a copied token whose holder uses it is caught at the next replay.
    const retried = await db.browserInstallation.updateMany({
      where: { id: installationId, prevRefreshTokenHash: hash, revokedAt: null },
      data: { ...hashes, refreshRotatedAt: now, lastSeenAt: now },
    });
    if (retried.count) return grant;
    throw unauthorized();
  }

  await db.browserInstallation.update({
    where: { id: replayed.id },
    data: { revokedAt: now, refreshTokenHash: null, prevRefreshTokenHash: null, accessTokenHash: null, accessTokenExpiresAt: null },
  });
  const label = `${replayed.child.name}'s ${browserLabel(replayed)}`;
  await audit(replayed.familyId, "eGuard", "browser.token.reuse_detected", label);
  await db.alert.create({
    data: {
      familyId: replayed.familyId, childId: replayed.childId, severity: "ACTION_REQUIRED", category: "DEVICES", icon: "shield-alert",
      title: "Browser disconnected for security", subject: label, resolveKey: `BROWSER_REVOKED:${replayed.id}`,
      body: `eGuard saw ${browserLabel(replayed)}'s sign-in key used from two places, so it disconnected that browser. Remove it and add it again with a new code.`,
    },
  });
  throw reused(replayed.id);
}

/** Resolves `Authorization: Bearer <access token>` to a live installation. */
export async function authBrowser(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return null;
  const inst = await db.browserInstallation.findUnique({ where: { accessTokenHash: sha256(token) }, include: { child: true } });
  if (!inst || inst.revokedAt || !inst.accessTokenExpiresAt || inst.accessTokenExpiresAt < new Date()) return null;
  // Also the first use after a token rotation: that marks the new tokens as received (refreshBrowserTokens)
  const firstUse = inst.refreshRotatedAt && inst.lastSeenAt && inst.lastSeenAt <= inst.refreshRotatedAt;
  if (!inst.lastSeenAt || firstUse || Date.now() - inst.lastSeenAt.getTime() > 60_000) {
    await db.browserInstallation.update({ where: { id: inst.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  if (!inst.lastSeenAt || Date.now() - inst.lastSeenAt.getTime() > OFFLINE_AFTER_MS) {
    // Back after a long silence: verifiable again
    await db.alert.updateMany({ where: { familyId: inst.familyId, resolveKey: browserOfflineKey(inst.id), resolvedAt: null }, data: { resolvedAt: new Date() } });
  }
  return inst;
}

/** resolveKey of "eGuard may be off in this browser" (raised by the maintenance job after a day of silence). */
export const browserOfflineKey = (id: string) => `BROWSER_OFFLINE:${id}`;

/**
 * Removes a browser from the family. Its tokens stop working and the extension forgets the connection on its
 * next sync, which also ends verification, so it needs the parent's password and tells the family.
 */
export async function removeBrowser(actor: Actor, installationId: string, confirm: { password?: string; phrase?: string }) {
  const b = await db.browserInstallation.findFirst({ where: { id: installationId, familyId: actor.familyId }, include: { child: true } });
  if (!b) throw notFound("Browser");
  await confirmDestructive(actor.id, confirm);
  // deleteMany: another parent removing it at the same moment is a 404 here, not a Prisma error
  if (!(await db.browserInstallation.deleteMany({ where: { id: b.id } })).count) throw notFound("Browser");
  const label = `${b.child.name}'s ${browserLabel(b)}`;
  await audit(actor.familyId, actor.name, "browser.removed", label);
  // Its open alerts (disconnected for security, drift, private windows, offline…) no longer apply
  await db.alert.updateMany({
    where: { familyId: actor.familyId, resolvedAt: null, AND: [{ resolveKey: { startsWith: "BROWSER_" } }, { resolveKey: { endsWith: `:${b.id}` } }] },
    data: { resolvedAt: new Date() },
  });
  await db.alert.create({
    data: {
      familyId: actor.familyId, childId: b.childId, severity: "ATTENTION", category: "DEVICES", icon: "trash",
      title: "Browser removed", subject: label,
      body: `${actor.name} removed ${browserLabel(b)} from eGuard. eGuard no longer protects or verifies that browser.`,
    },
  });
  return b;
}

export function listBrowsers(familyId: string) {
  return db.browserInstallation.findMany({ where: { familyId }, include: { child: true }, orderBy: { createdAt: "asc" } });
}
