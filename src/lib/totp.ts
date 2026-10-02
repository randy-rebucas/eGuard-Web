import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt } from "node:crypto";

/**
 * Time-based one-time codes (RFC 6238, the 6-digit codes of Google Authenticator, 1Password, Authy…) and the
 * encryption of their secrets at rest. Pure functions; the account side is in two-factor.ts.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string) {
  const clean = s.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("Not base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** RFC 4226: the code for one counter value. */
export function hotp(secret: Buffer, counter: number, digits = DIGITS) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const stepAt = (ms: number) => Math.floor(ms / 1000 / STEP_SECONDS);

/**
 * The step `code` is valid for, allowing one step either side for a phone clock that's a little off; null when
 * it doesn't match. Callers refuse a step at or before the last one used, so a code works once.
 */
export function matchStep(secret: Buffer, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const s = stepAt(now);
  for (const step of [s, s - 1, s + 1]) if (hotp(secret, step) === code) return step;
  return null;
}

export const newSecret = () => randomBytes(20);

/** The link authenticator apps read from the QR code. */
export function otpauthUri(secret: Buffer, account: string, issuer = "eGuard") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${base32Encode(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/* ---------- Secrets at rest ---------- */

/** AES-256-GCM key from TWO_FACTOR_KEY (any long random string), or null when it isn't set. */
export function secretKey(env: Record<string, string | undefined> = process.env): Buffer | null {
  const raw = env.TWO_FACTOR_KEY?.trim();
  if (raw) return createHash("sha256").update(raw).digest();
  // Local development works without setting it up; production must set its own
  return env.NODE_ENV === "production" ? null : createHash("sha256").update("eguard-dev-two-factor-key").digest();
}

export function sealSecret(secret: Buffer, key: Buffer) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(secret), c.final()]);
  return `v1:${Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url")}`;
}

export function openSecret(sealed: string, key: Buffer) {
  if (!sealed.startsWith("v1:")) throw new Error("Unknown secret format");
  const buf = Buffer.from(sealed.slice(3), "base64url");
  const d = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]);
}

/* ---------- Recovery codes ---------- */

/** "k3m9-x2qa-7fpd": 60 random bits, without look-alike characters. */
export function newRecoveryCode() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const s = Array.from({ length: 12 }, () => chars[randomInt(chars.length)]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

/** What a parent typed, as stored: lowercase, without spaces or dashes. */
export const normalizeCode = (code: string) => code.trim().toLowerCase().replace(/[\s-]/g, "");
