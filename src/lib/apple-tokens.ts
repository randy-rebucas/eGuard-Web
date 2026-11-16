import "server-only";
import { createPrivateKey, sign, type KeyObject } from "node:crypto";
import { db } from "./db";
import { ServiceError } from "./errors";
import { openSecret, sealSecret, secretKey } from "./totp";

/**
 * Sign in with Apple tokens, so deleting an account (or unlinking Apple) can revoke the app's access at Apple, as
 * App Store guideline 5.1.1(v) asks. The app sends the credential's one-time `authorizationCode` with its sign-in;
 * we exchange it at Apple for a refresh token and keep that, sealed with TWO_FACTOR_KEY, on the OAuthIdentity row.
 * Everything here is best-effort: a sign-in or a deletion never fails because Apple can't be reached or the server
 * isn't set up for it (APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY).
 */

const TOKEN_URL = "https://appleid.apple.com/auth/token";
const REVOKE_URL = "https://appleid.apple.com/auth/revoke";
const AUDIENCE = "https://appleid.apple.com";
const FETCH_TIMEOUT_MS = 5_000;
/** The client secret is made per request, so it only needs to outlive that request. */
const SECRET_SECONDS = 300;

export type AppleCredentials = { teamId: string; keyId: string; privateKey: KeyObject };
type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

/**
 * The Sign in with Apple key (Certificates, IDs & Profiles › Keys) and its team, or null when any part is missing
 * or the key doesn't load. APPLE_PRIVATE_KEY is the .p8 file's PEM; "\n" written as two characters is accepted, since
 * hosts often keep variables on one line.
 */
export function appleCredentials(env: Env = process.env): AppleCredentials | null {
  const teamId = env.APPLE_TEAM_ID?.trim();
  const keyId = env.APPLE_KEY_ID?.trim();
  const pem = env.APPLE_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
  if (!teamId || !keyId || !pem) return null;
  try {
    return { teamId, keyId, privateKey: createPrivateKey(pem) };
  } catch {
    console.error("APPLE_PRIVATE_KEY isn't a valid .p8 key: Apple tokens won't be kept or revoked");
    return null;
  }
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** The `client_secret` Apple's token endpoints take: an ES256 JWT signed with the team's Sign in with Apple key. */
export function appleClientSecret(creds: AppleCredentials, clientId: string, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const input = `${b64({ alg: "ES256", kid: creds.keyId })}.${b64({ iss: creds.teamId, iat, exp: iat + SECRET_SECONDS, aud: AUDIENCE, sub: clientId })}`;
  const sig = sign("sha256", Buffer.from(input), { key: creds.privateKey, dsaEncoding: "ieee-p1363" });
  return `${input}.${sig.toString("base64url")}`;
}

/**
 * The client id an (already verified) Apple identity token was issued to: the app's bundle id. An authorization
 * code can only be exchanged, and its refresh token revoked, under that same client id.
 */
export function audienceOf(idToken: string): string | null {
  try {
    const aud = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")).aud;
    const first = Array.isArray(aud) ? aud[0] : aud;
    return typeof first === "string" && first ? first : null;
  } catch {
    return null;
  }
}

const unavailable = () => new ServiceError(502, "Couldn't reach Apple. Try again.", "apple_unavailable");

async function post(url: string, form: Record<string, string>, fetchImpl: Fetch) {
  try {
    return await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    // Network error or timeout
    throw unavailable();
  }
}

/**
 * Exchanges the app's authorization code for a refresh token. Returns the token and the Apple user it belongs to
 * (from the id_token in Apple's answer, which came straight from Apple over TLS).
 */
export async function exchangeAppleCode(
  code: string,
  clientId: string,
  opts: { creds?: AppleCredentials; fetch?: Fetch; now?: number } = {},
): Promise<{ refreshToken: string; subject: string | null }> {
  const creds = opts.creds ?? appleCredentials();
  if (!creds) throw new ServiceError(501, "Sign in with Apple tokens aren't set up on this server.", "provider_not_configured");
  const res = await post(TOKEN_URL, {
    client_id: clientId,
    client_secret: appleClientSecret(creds, clientId, opts.now),
    code,
    grant_type: "authorization_code",
  }, opts.fetch ?? fetch);
  let json: { refresh_token?: unknown; id_token?: unknown; error?: unknown };
  try { json = await res.json(); } catch { throw unavailable(); }
  if (!res.ok) {
    // invalid_grant: the code expired, was used already, or belongs to another client
    if (res.status === 400) throw new ServiceError(400, "Apple didn't accept that authorization code.", typeof json.error === "string" ? json.error : "invalid_grant");
    throw unavailable();
  }
  if (typeof json.refresh_token !== "string" || !json.refresh_token) throw unavailable();
  let subject: string | null = null;
  if (typeof json.id_token === "string") {
    try { subject = JSON.parse(Buffer.from(json.id_token.split(".")[1] ?? "", "base64url").toString("utf8")).sub ?? null; } catch { subject = null; }
  }
  return { refreshToken: json.refresh_token, subject };
}

/** Revokes a refresh token at Apple, which signs the app out of the parent's "Sign in with Apple" list. */
export async function revokeAppleToken(refreshToken: string, clientId: string, opts: { creds?: AppleCredentials; fetch?: Fetch; now?: number } = {}) {
  const creds = opts.creds ?? appleCredentials();
  if (!creds) throw new ServiceError(501, "Sign in with Apple tokens aren't set up on this server.", "provider_not_configured");
  const res = await post(REVOKE_URL, {
    client_id: clientId,
    client_secret: appleClientSecret(creds, clientId, opts.now),
    token: refreshToken,
    token_type_hint: "refresh_token",
  }, opts.fetch ?? fetch);
  if (!res.ok) throw unavailable();
}

/* ---------- At rest ---------- */

type Stored = { t: string; c: string };

/** The token and its client id, sealed like two-step secrets. Null without a key: never kept in the clear. */
export function sealAppleToken(refreshToken: string, clientId: string, env: Env = process.env) {
  const key = secretKey(env);
  if (!key) return null;
  return sealSecret(Buffer.from(JSON.stringify({ t: refreshToken, c: clientId } satisfies Stored)), key);
}

export function openAppleToken(sealed: string, env: Env = process.env): { refreshToken: string; clientId: string } | null {
  const key = secretKey(env);
  if (!key) return null;
  try {
    const s = JSON.parse(openSecret(sealed, key).toString("utf8")) as Partial<Stored>;
    return typeof s.t === "string" && typeof s.c === "string" ? { refreshToken: s.t, clientId: s.c } : null;
  } catch {
    // Sealed under another TWO_FACTOR_KEY
    return null;
  }
}

/* ---------- Sign-in and removal ---------- */

/**
 * After an Apple sign-in: exchanges the app's authorization code and keeps the refresh token on that identity.
 * Never throws: the parent is already signed in, and a missing token only means nothing to revoke later.
 */
export async function rememberAppleToken(
  identity: { subject: string; idToken: string; authorizationCode: string },
  opts: { creds?: AppleCredentials | null; fetch?: Fetch; env?: Env } = {},
) {
  try {
    const creds = opts.creds === undefined ? appleCredentials(opts.env) : opts.creds;
    if (!creds) return false;
    const clientId = audienceOf(identity.idToken);
    if (!clientId) return false;
    const r = await exchangeAppleCode(identity.authorizationCode, clientId, { creds, fetch: opts.fetch });
    // A code from another Apple user's sign-in must not be kept on this one's row
    if (r.subject && r.subject !== identity.subject) {
      console.error("Apple authorization code belongs to another Apple account: not kept");
      return false;
    }
    const sealed = sealAppleToken(r.refreshToken, clientId, opts.env);
    if (!sealed) {
      console.error("TWO_FACTOR_KEY isn't set: the Apple refresh token isn't kept, so it can't be revoked later");
      return false;
    }
    const u = await db.oAuthIdentity.updateMany({ where: { provider: "apple", subject: identity.subject }, data: { appleRefreshToken: sealed } });
    return u.count > 0;
  } catch (e) {
    console.error("Couldn't keep the Apple refresh token (sign-in continues):", e instanceof ServiceError ? `${e.code}: ${e.message}` : e);
    return false;
  }
}

/** The sealed Apple tokens of these parents, read before their rows are deleted. */
export async function appleTokensOf(userIds: string[]) {
  if (!userIds.length) return [];
  const rows = await db.oAuthIdentity.findMany({
    where: { userId: { in: userIds }, provider: "apple", appleRefreshToken: { not: null } },
    select: { appleRefreshToken: true },
  });
  return rows.map((r) => r.appleRefreshToken).filter((t): t is string => !!t);
}

/**
 * Revokes these sealed tokens at Apple, once the account or sign-in is gone. Never throws: Apple being down or the
 * server not being set up mustn't undo or fail a deletion. Returns how many Apple accepted.
 */
export async function revokeAppleTokens(sealed: string[], opts: { creds?: AppleCredentials | null; fetch?: Fetch; env?: Env } = {}) {
  if (!sealed.length) return 0;
  const creds = opts.creds === undefined ? appleCredentials(opts.env) : opts.creds;
  if (!creds) {
    console.error("Apple sign-in key isn't set up: Apple tokens of a removed account weren't revoked");
    return 0;
  }
  const results = await Promise.allSettled(sealed.map(async (s) => {
    const t = openAppleToken(s, opts.env);
    if (!t) throw new Error("Apple token can't be opened: was TWO_FACTOR_KEY changed?");
    await revokeAppleToken(t.refreshToken, t.clientId, { creds, fetch: opts.fetch });
  }));
  for (const r of results) if (r.status === "rejected") console.error("Couldn't revoke an Apple token:", r.reason instanceof Error ? r.reason.message : r.reason);
  return results.filter((r) => r.status === "fulfilled").length;
}
