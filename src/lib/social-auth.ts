import { createPublicKey, verify, type JsonWebKey } from "node:crypto";
import { ServiceError } from "./errors";

/**
 * Verifies "Sign in with Apple" and Google identity tokens (RS256 JWTs) against the
 * provider's published keys. Client IDs come from APPLE_CLIENT_IDS / GOOGLE_CLIENT_IDS
 * (comma-separated: the iOS bundle id, web service id, Android/iOS OAuth client ids).
 */
export type Provider = "apple" | "google";

type Jwk = JsonWebKey & { kid?: string; alg?: string };
export type Identity = { provider: Provider; subject: string; email: string | null; emailVerified: boolean; name: string | null };

const PROVIDERS: Record<Provider, { issuers: string[]; jwksUrl: string; audienceEnv: string }> = {
  apple: { issuers: ["https://appleid.apple.com"], jwksUrl: "https://appleid.apple.com/auth/keys", audienceEnv: "APPLE_CLIENT_IDS" },
  google: { issuers: ["https://accounts.google.com", "accounts.google.com"], jwksUrl: "https://www.googleapis.com/oauth2/v3/certs", audienceEnv: "GOOGLE_CLIENT_IDS" },
};

const jwksCache = new Map<string, { keys: Jwk[]; until: number }>();

async function fetchJwks(url: string): Promise<Jwk[]> {
  const hit = jwksCache.get(url);
  if (hit && hit.until > Date.now()) return hit.keys;
  const res = await fetch(url);
  if (!res.ok) throw new ServiceError(502, "Couldn't reach the sign-in provider. Try again.", "provider_unavailable");
  const keys = ((await res.json()) as { keys: Jwk[] }).keys;
  jwksCache.set(url, { keys, until: Date.now() + 3600_000 });
  return keys;
}

export const audiencesFor = (provider: Provider) =>
  (process.env[PROVIDERS[provider].audienceEnv] ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const b64json = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
const bad = () => new ServiceError(401, "That sign-in didn't work. Try again.", "invalid_token");

export async function verifyIdToken(
  provider: Provider,
  idToken: string,
  opts: { audiences?: string[]; getKeys?: (url: string) => Promise<Jwk[]>; now?: number } = {},
): Promise<Identity> {
  const cfg = PROVIDERS[provider];
  const audiences = opts.audiences ?? audiencesFor(provider);
  if (!audiences.length) throw new ServiceError(501, `Sign in with ${provider === "apple" ? "Apple" : "Google"} isn't set up on this server.`, "provider_not_configured");

  const parts = idToken.split(".");
  if (parts.length !== 3) throw bad();
  let header: { alg?: string; kid?: string }, payload: Record<string, unknown>;
  try { header = b64json(parts[0]); payload = b64json(parts[1]); } catch { throw bad(); }
  if (header.alg !== "RS256" || !header.kid) throw bad();

  const keys = await (opts.getKeys ?? fetchJwks)(cfg.jwksUrl);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw bad();
  const ok = verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"));
  if (!ok) throw bad();

  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!cfg.issuers.includes(String(payload.iss))) throw bad();
  if (!aud.some((a) => audiences.includes(String(a)))) throw bad();
  if (typeof payload.exp !== "number" || payload.exp < now - 60) throw bad();
  if (typeof payload.sub !== "string" || !payload.sub) throw bad();

  // Apple sends email_verified as a string, Google as a boolean
  const verified = payload.email_verified === true || payload.email_verified === "true";
  return {
    provider,
    subject: payload.sub,
    email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
    emailVerified: verified,
    name: typeof payload.name === "string" ? payload.name : null,
  };
}
