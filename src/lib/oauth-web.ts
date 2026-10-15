import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ServiceError } from "./errors";
import { appUrl } from "./email-verification";
import { safeNext } from "./return-to";
import { verifyIdToken, type Identity } from "./social-auth";
import { secretKey } from "./totp";

/**
 * "Continue with Google / LinkedIn" on the website: the OAuth authorization-code flow. /auth/<provider> sends the
 * browser to the provider with a one-time state (and, for Google, a PKCE verifier and nonce) kept in an httpOnly
 * cookie; /auth/<provider>/callback checks the state, swaps the code for the parent's identity, and hands it to
 * signInWithIdentity like the app's Apple/Google sign-in. A provider shows only when its client id and secret are set
 * (and, in production, TWO_FACTOR_KEY, which signs the cookie).
 */
export type WebProvider = "google" | "linkedin";

type Config = {
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  /** LinkedIn doesn't accept PKCE from web apps; it relies on the client secret and state */
  pkce: boolean;
  idEnv: string;
  secretEnv: string;
};

const PROVIDERS: Record<WebProvider, Config> = {
  google: {
    label: "Google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    pkce: true,
    idEnv: "GOOGLE_WEB_CLIENT_ID",
    secretEnv: "GOOGLE_WEB_CLIENT_SECRET",
  },
  linkedin: {
    label: "LinkedIn",
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scope: "openid profile email",
    pkce: false,
    idEnv: "LINKEDIN_CLIENT_ID",
    secretEnv: "LINKEDIN_CLIENT_SECRET",
  },
};

const LINKEDIN_USERINFO = "https://api.linkedin.com/v2/userinfo";
const FETCH_TIMEOUT_MS = 8_000;

export const isWebProvider = (p: string): p is WebProvider => p === "google" || p === "linkedin";
export const providerLabel = (p: string) => (isWebProvider(p) ? PROVIDERS[p].label : p === "apple" ? "Apple" : p);

/**
 * Signs the flow cookie, so a browser can't write its own (an "already confirmed" link, another page to return to).
 * Derived from TWO_FACTOR_KEY, which production must set for these sign-ins to show.
 */
function flowKey() {
  const k = secretKey();
  return k ? createHmac("sha256", k).update("eguard oauth flow v1").digest() : null;
}

const credentials = (p: WebProvider) => {
  const id = process.env[PROVIDERS[p].idEnv]?.trim();
  const secret = process.env[PROVIDERS[p].secretEnv]?.trim();
  return id && secret && flowKey() ? { id, secret } : null;
};

/** The providers set up on this server, in the order their buttons show. */
export const enabledWebProviders = (): WebProvider[] => (["google", "linkedin"] as const).filter((p) => credentials(p));

export const redirectUri = (p: WebProvider) => `${appUrl()}/auth/${p}/callback`;

/* ---------- The flow cookie ---------- */

export const FLOW_COOKIE = "eg_oauth";
export const FLOW_MINUTES = 10;

/**
 * What sign-in started: "login" and "register" sign in (creating a family only with the guardian confirmation), "link"
 * adds the provider to the signed-in parent's account (Settings › Security).
 */
export type Intent = "login" | "register" | "link";

export type Flow = {
  provider: WebProvider;
  state: string;
  nonce: string;
  verifier: string | null;
  intent: Intent;
  next: string | null;
  guardian: boolean;
  /** "link": the account that confirmed it. The callback links only while that account is the one signed in. */
  userId?: string | null;
};

const mac = (body: string, key: Buffer) => createHmac("sha256", key).update(body).digest("base64url");

/** `<payload>.<signature>`. Throws without a key (begin() refuses first, so it isn't reached). */
export function encodeFlow(f: Flow) {
  const key = flowKey();
  if (!key) throw new Error("TWO_FACTOR_KEY is not set");
  const body = Buffer.from(JSON.stringify(f)).toString("base64url");
  return `${body}.${mac(body, key)}`;
}

/** The flow this browser started, or null when the cookie is missing, unsigned, tampered with or malformed. */
export function decodeFlow(raw: string | undefined): Flow | null {
  const key = flowKey();
  if (!raw || !key) return null;
  const [body, sig, extra] = raw.split(".");
  if (!body || !sig || extra !== undefined || !stateMatches(mac(body, key), sig)) return null;
  try {
    const f = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<Flow>;
    if (!f || typeof f.state !== "string" || typeof f.nonce !== "string" || !isWebProvider(String(f.provider))) return null;
    if (f.intent !== "login" && f.intent !== "register" && f.intent !== "link") return null;
    return {
      provider: f.provider as WebProvider, state: f.state, nonce: f.nonce, intent: f.intent,
      verifier: typeof f.verifier === "string" ? f.verifier : null,
      next: safeNext(f.next),
      guardian: f.guardian === true,
      userId: typeof f.userId === "string" ? f.userId : null,
    };
  } catch {
    return null;
  }
}

export function stateMatches(expected: string, got: string | null) {
  if (!got) return false;
  const a = Buffer.from(expected), b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

const random = () => randomBytes(32).toString("base64url");

/** Starts a sign-in: the provider's consent page to send the browser to, and the flow to keep in the cookie. */
export function begin(p: WebProvider, opts: { intent: Intent; next: string | null; guardian: boolean; userId?: string | null }) {
  const creds = credentials(p);
  if (!creds) throw notConfigured(p);
  const cfg = PROVIDERS[p];
  const flow: Flow = { provider: p, state: random(), nonce: random(), verifier: cfg.pkce ? random() : null, ...opts };
  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", creds.id);
  url.searchParams.set("redirect_uri", redirectUri(p));
  url.searchParams.set("scope", cfg.scope);
  url.searchParams.set("state", flow.state);
  if (p === "google") {
    url.searchParams.set("nonce", flow.nonce);
    // Lets a parent with several Google accounts pick the right one instead of being signed in with the last used
    url.searchParams.set("prompt", "select_account");
  }
  if (flow.verifier) {
    url.searchParams.set("code_challenge", createHash("sha256").update(flow.verifier).digest("base64url"));
    url.searchParams.set("code_challenge_method", "S256");
  }
  return { url: url.toString(), flow };
}

/* ---------- The callback ---------- */

const notConfigured = (p: WebProvider) =>
  new ServiceError(501, `Sign in with ${PROVIDERS[p].label} isn't set up on this server.`, "provider_not_configured");
const unavailable = () => new ServiceError(502, "Couldn't reach the sign-in provider. Try again.", "provider_unavailable");
const bad = () => new ServiceError(401, "That sign-in didn't work. Try again.", "invalid_token");

async function postForm(url: string, form: Record<string, string>) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams(form),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw unavailable();
  }
  // 4xx: the code was used, expired or doesn't belong to us. 5xx: the provider's problem
  if (res.status >= 500) throw unavailable();
  if (!res.ok) throw bad();
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

/** Swaps the authorization code for the parent's identity at the provider. */
export async function finish(flow: Flow, code: string): Promise<Identity> {
  const p = flow.provider;
  const creds = credentials(p);
  if (!creds) throw notConfigured(p);
  const tokens = await postForm(PROVIDERS[p].tokenUrl, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(p),
    client_id: creds.id,
    client_secret: creds.secret,
    ...(flow.verifier ? { code_verifier: flow.verifier } : {}),
  });

  if (p === "google") {
    if (typeof tokens.id_token !== "string") throw bad();
    // Checked like the app's tokens: Google's signature, our client id as the audience, and this sign-in's nonce
    return verifyIdToken("google", tokens.id_token, { audiences: [creds.id], nonce: flow.nonce });
  }

  // LinkedIn: the access token we were just given reads the member's OpenID profile
  if (typeof tokens.access_token !== "string") throw bad();
  let res: Response;
  try {
    res = await fetch(LINKEDIN_USERINFO, { headers: { authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch {
    throw unavailable();
  }
  if (!res.ok) throw res.status >= 500 ? unavailable() : bad();
  return linkedInIdentity(await res.json().catch(() => null));
}

/** LinkedIn's userinfo answer as an Identity. Exported for tests. */
export function linkedInIdentity(info: unknown): Identity {
  const u = (info ?? {}) as Record<string, unknown>;
  if (typeof u.sub !== "string" || !u.sub) throw bad();
  const name = typeof u.name === "string" && u.name.trim()
    ? u.name.trim()
    : [u.given_name, u.family_name].filter((s): s is string => typeof s === "string" && !!s.trim()).join(" ") || null;
  return {
    provider: "linkedin",
    subject: u.sub,
    email: typeof u.email === "string" ? u.email.toLowerCase() : null,
    emailVerified: u.email_verified === true || u.email_verified === "true",
    name,
  };
}
