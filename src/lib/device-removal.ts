import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import type { DeviceKind } from "@prisma/client";
import { signPolicy } from "./browser-policy";

/**
 * A computer can't be uninstalled on the computer itself: the eGuard desktop agent refuses unless eGuard tells it to.
 * So removing one from the dashboard doesn't delete it right away. It waits (removalRequestedAt) until the agent picks
 * up the signed uninstall command on /sync, removes itself and confirms with UNINSTALL_ACK, or until the parent types an
 * offline removal code into the agent, or finishes the removal without waiting. Phones are removed at once, as before.
 */
export const removalWaits = (d: { kind: DeviceKind }) => d.kind === "COMPUTER";

/** Made at pairing and sent to the agent once: the key for offline removal codes. */
export const newRemovalSecret = () => randomBytes(32).toString("base64url");

/** Codes change every window. The agent accepts the current window and the one before, so a code lasts 15 to 30 minutes. */
export const REMOVAL_CODE_WINDOW_MS = 15 * 60_000;
/** Same letters as pairing codes: no 0/O or 1/I to mix up. 32 of them, so a byte maps without bias. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * The offline removal code for a window: the first 8 bytes of HMAC-SHA256(secret, "eguard.device.remove:<deviceId>:<window>")
 * in ALPHABET. `window` is floor(unix ms / REMOVAL_CODE_WINDOW_MS). The agent computes the same with the secret it got
 * at pairing (docs/desktop-agent-spec.md).
 */
export function removalCode(secret: string, deviceId: string, at = Date.now()) {
  const window = Math.floor(at / REMOVAL_CODE_WINDOW_MS);
  const mac = createHmac("sha256", Buffer.from(secret, "base64url")).update(`eguard.device.remove:${deviceId}:${window}`).digest();
  const code = Array.from(mac.subarray(0, 8), (b) => ALPHABET[b % 32]).join("");
  return { code, expiresAt: new Date((window + 2) * REMOVAL_CODE_WINDOW_MS) };
}

/**
 * eGuard's signed word that a parent removed this computer, sent on /sync while the removal waits. The agent removes
 * itself only with this (checked against the key built into it): a 401 or a missing device could come from anyone
 * between the computer and eGuard, and must never switch protection off. Same key and signature as the browser
 * policy (signPolicy); `type` keeps it from passing as anything else. Null when signing isn't configured: the
 * computer then stays protected, and the parent can use a removal code.
 */
export function signUninstall(deviceId: string, requestedAt: Date) {
  try {
    const command = { type: "eguard.device.uninstall", deviceId, requestedAt: requestedAt.toISOString(), at: new Date().toISOString() };
    return { command, ...signPolicy(command) };
  } catch (e) {
    console.error("[device] can't sign an uninstall command", e);
    return null;
  }
}
