import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";

/**
 * A computer's proof, for its browsers, that they're on it. The desktop agent gets one on every /sync and writes it
 * into the eGuard extension's managed policy (docs/desktop-agent-spec.md section 9). The extension sends it with
 * /browser/v1/pair, and a browser paired with a valid one is part of that computer: it takes no device slot, moves
 * with it to another child and is removed with it.
 *
 * `<deviceId>.<expires, unix ms>.<HMAC-SHA256(device token hash, "eguard.browser-link:<deviceId>:<expires>")>`. Keyed
 * with the device's token hash, which only the server has, so it can't be made without the server and stops working
 * once the computer is removed. Opaque to the agent and the extension.
 */
export const BROWSER_LINK_DAYS = 30;
/**
 * Browsers one computer can carry without slots. The link sits in a browser policy that anyone on the computer can
 * read, and copied elsewhere it would otherwise pair any number of browsers for free: Chrome, Edge, Firefox and a
 * couple more is what one computer really has. Past this, a browser pairs like any other and takes a slot.
 */
export const MAX_BROWSERS_PER_COMPUTER = 5;
/** What the extension reports as its OS (`runtime.getPlatformInfo().os`) on each computer platform */
const BROWSER_OS = { WINDOWS: "win", MACOS: "mac" } as const;

const mac = (tokenHash: string, deviceId: string, expires: number) =>
  createHmac("sha256", tokenHash).update(`eguard.browser-link:${deviceId}:${expires}`).digest("base64url");

/** A fresh link for a computer, or null when it has no token (a simulated device). */
export function browserLink(d: { id: string; tokenHash: string | null }, now = Date.now()) {
  if (!d.tokenHash) return null;
  const expires = now + BROWSER_LINK_DAYS * 864e5;
  return { value: `${d.id}.${expires}.${mac(d.tokenHash, d.id, expires)}`, expiresAt: new Date(expires).toISOString() };
}

/**
 * The computer a link names, when it's genuine, unexpired, the computer belongs to this child (the browser code's), the
 * browser runs on that kind of computer, and the computer has room (MAX_BROWSERS_PER_COMPUTER). Anything else is null:
 * the browser then pairs as an ordinary one and takes a slot.
 */
export async function computerFromLink(link: string | undefined, code: { familyId: string; childId: string }, browserOs: string, now = Date.now()) {
  const m = link?.match(/^([\w-]{1,64})\.(\d{10,16})\.([\w-]{43})$/);
  if (!m) return null;
  const [, deviceId, exp, sig] = m;
  if (Number(exp) < now) return null;
  const d = await db.device.findUnique({ where: { id: deviceId }, select: { id: true, name: true, kind: true, platform: true, familyId: true, childId: true, tokenHash: true, removalRequestedAt: true } });
  if (!d?.tokenHash || d.kind !== "COMPUTER" || d.familyId !== code.familyId || d.childId !== code.childId || d.removalRequestedAt) return null;
  if (BROWSER_OS[d.platform as keyof typeof BROWSER_OS] !== browserOs) return null;
  const want = Buffer.from(mac(d.tokenHash, d.id, Number(exp)));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return await db.browserInstallation.count({ where: { deviceId: d.id } }) < MAX_BROWSERS_PER_COMPUTER ? d : null;
}
