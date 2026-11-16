import "server-only";
import { db } from "./db";
import { sha256 } from "./auth";
import { removalCode } from "./device-removal";

/**
 * A computer whose removal was finished without it (a parent's "Remove without waiting", or QUIET_REMOVAL_DAYS of
 * silence) still has eGuard on it, and eGuard there refuses to be uninstalled without eGuard's word or a removal code.
 * Its device row is gone, so for this long a RemovedComputer keeps what's needed to still let it go: its token gets
 * the signed uninstall command (on /sync's 401), its UNINSTALL_ACK is taken, and the device list shows its code.
 */
export const REMOVED_COMPUTER_DAYS = 30;

type Tx = Pick<typeof db, "removedComputer">;

/** Kept when a computer is deleted without its own confirmation. Nothing for a computer without a token or secret. */
export async function rememberRemovedComputer(
  tx: Tx,
  d: { id: string; familyId: string; tokenHash: string | null; removalSecret: string | null },
  label: string,
  now = new Date(),
) {
  if (!d.tokenHash || !d.removalSecret) return;
  const data = {
    familyId: d.familyId, label, tokenHash: d.tokenHash, removalSecret: d.removalSecret, removedAt: now,
    expiresAt: new Date(now.getTime() + REMOVED_COMPUTER_DAYS * 864e5),
  };
  await tx.removedComputer.upsert({ where: { deviceId: d.id }, create: { deviceId: d.id, ...data }, update: data });
}

/** The removed computer a request's device token belongs to, while it's kept. */
export async function removedComputerFor(req: Request, now = new Date()) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return null;
  const r = await db.removedComputer.findUnique({ where: { tokenHash: sha256(token) } });
  return r && r.expiresAt > now ? r : null;
}

/** The computer confirmed it uninstalled eGuard: nothing more to keep. */
export async function forgetRemovedComputer(id: string) {
  await db.removedComputer.deleteMany({ where: { id } });
}

/**
 * A removed phone or tablet. Its device row is gone and its token stops working at once, as before; for
 * REMOVED_COMPUTER_DAYS its 401 also carries eGuard's signed uninstall command, because the iPhone app no longer
 * lifts protection on a bare 401 (a proxy between the phone and eGuard could send one). Nothing without a token.
 */
export async function rememberRemovedPhone(
  tx: Tx,
  d: { id: string; familyId: string; tokenHash: string | null },
  label: string,
  now = new Date(),
) {
  if (!d.tokenHash) return;
  const data = { familyId: d.familyId, label, tokenHash: d.tokenHash, removalSecret: null, removedAt: now, expiresAt: new Date(now.getTime() + REMOVED_COMPUTER_DAYS * 864e5) };
  await tx.removedComputer.upsert({ where: { deviceId: d.id }, create: { deviceId: d.id, ...data }, update: data });
}

/** A family's removed computers that may still have eGuard on them, each with its current offline removal code. */
export async function removedComputers(familyId: string, now = new Date()) {
  const rows = await db.removedComputer.findMany({
    // Phones are kept without a removal secret: there's no code to show for them
    where: { familyId, expiresAt: { gt: now }, removalSecret: { not: null } },
    orderBy: { removedAt: "desc" },
    take: 20,
  });
  return rows.flatMap((r) => r.removalSecret
    ? [{ id: r.id, label: r.label, removedAt: r.removedAt, expiresAt: r.expiresAt, removal: removalCode(r.removalSecret, r.deviceId, now.getTime()) }]
    : []);
}

/** Maintenance: what's past REMOVED_COMPUTER_DAYS goes (its token and secret with it). */
export async function forgetExpiredRemovedComputers(now = new Date()) {
  return (await db.removedComputer.deleteMany({ where: { expiresAt: { lte: now } } })).count;
}
