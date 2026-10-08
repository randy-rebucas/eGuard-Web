import { createHash, createSign } from "node:crypto";
import { ServiceError } from "./errors";

/**
 * Google Play Billing: verifies subscription purchase tokens with the Play Developer API
 * (purchases.subscriptionsv2) using a service account, and acknowledges new purchases.
 *
 * Config:
 *   GOOGLE_PLAY_PACKAGE_NAME      the Android app id, e.g. app.eguard.android
 *   GOOGLE_PLAY_SERVICE_ACCOUNT   the service account JSON key (needs "View financial data" and
 *                                 "Manage orders and subscriptions" in Play Console)
 */

type Fetch = typeof fetch;
export type ServiceAccount = { client_email: string; private_key: string; private_key_id?: string; token_uri?: string };

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

export function googlePlayConfig(env: Record<string, string | undefined> = process.env) {
  const packageName = env.GOOGLE_PLAY_PACKAGE_NAME?.trim();
  const raw = env.GOOGLE_PLAY_SERVICE_ACCOUNT?.trim();
  if (!packageName || !raw) return null;
  try {
    const account = JSON.parse(raw) as ServiceAccount;
    if (!account.client_email || !account.private_key) return null;
    return { packageName, account };
  } catch {
    return null;
  }
}

export type GooglePlayConfig = NonNullable<ReturnType<typeof googlePlayConfig>>;

/** The id the app must pass to BillingFlowParams.setObfuscatedAccountId, so a purchase can't be claimed by another family. */
export const obfuscatedAccountId = (familyId: string) => createHash("sha256").update(`eguard-family:${familyId}`).digest("hex");

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

const TIMEOUT_MS = 15_000;
const unreachable = () => new ServiceError(502, "Couldn't reach Google Play. Try again in a moment.", "store_unavailable");

/** A request that can't reach Google (network down, timeout) fails like a 5xx, not as a crash. */
async function reach(f: Fetch, url: string, init: RequestInit = {}) {
  try {
    return await f(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    console.error("[google-play]", new URL(url).host, e instanceof Error ? e.message : e);
    throw unreachable();
  }
}

const tokenCache = new Map<string, { token: string; until: number }>();

/**
 * OAuth access token for the service account (JWT bearer grant), cached until shortly before it expires.
 * `scope` defaults to the Play Developer API; push (lib/push) asks for Firebase Cloud Messaging.
 */
export async function accessToken(account: ServiceAccount, f: Fetch = fetch, now = Date.now(), scope = SCOPE) {
  const cacheKey = `${account.client_email} ${scope}`;
  const hit = tokenCache.get(cacheKey);
  if (hit && hit.until > now) return hit.token;
  const aud = account.token_uri ?? "https://oauth2.googleapis.com/token";
  const iat = Math.floor(now / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", ...(account.private_key_id ? { kid: account.private_key_id } : {}) }));
  const claims = b64url(JSON.stringify({ iss: account.client_email, scope, aud, iat, exp: iat + 3600 }));
  const sig = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(account.private_key).toString("base64url");
  const res = await reach(f, aud, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${sig}` }),
  });
  if (!res.ok) throw unreachable();
  const body = (await res.json().catch(() => { throw unreachable(); })) as { access_token: string; expires_in: number };
  tokenCache.set(cacheKey, { token: body.access_token, until: now + (body.expires_in - 60) * 1000 });
  return body.access_token;
}

/** The fields of SubscriptionPurchaseV2 that eGuard uses. */
export type PlaySubscription = {
  subscriptionState: string;
  acknowledgementState?: string;
  linkedPurchaseToken?: string;
  testPurchase?: object;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  lineItems: { productId: string; expiryTime?: string; autoRenewingPlan?: { autoRenewEnabled?: boolean } }[];
};

/** States in which the subscriber keeps access (CANCELED = auto-renew off, still paid until expiry). */
export const ENTITLED_STATES = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"];

export function summarize(sub: PlaySubscription, productId: string, now = Date.now()) {
  const item = sub.lineItems.find((l) => l.productId === productId);
  const expiresAt = item?.expiryTime ? new Date(item.expiryTime) : null;
  return {
    state: sub.subscriptionState,
    productMatches: !!item,
    expiresAt,
    autoRenewing: !!item?.autoRenewingPlan?.autoRenewEnabled,
    entitled: !!item && ENTITLED_STATES.includes(sub.subscriptionState) && !!expiresAt && expiresAt.getTime() > now,
    needsAcknowledge: sub.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING",
    accountId: sub.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    linkedPurchaseToken: sub.linkedPurchaseToken ?? null,
    test: !!sub.testPurchase,
  };
}

export async function getSubscription(cfg: GooglePlayConfig, purchaseToken: string, f: Fetch = fetch): Promise<PlaySubscription> {
  const token = await accessToken(cfg.account, f);
  const res = await reach(f, `${API}/${encodeURIComponent(cfg.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 404 || res.status === 400 || res.status === 410) {
    throw new ServiceError(400, "Google Play didn't recognize this purchase.", "invalid_purchase");
  }
  if (!res.ok) throw unreachable();
  return (await res.json().catch(() => { throw unreachable(); })) as PlaySubscription;
}

/** Unacknowledged purchases are refunded by Google after 3 days, so acknowledge once eGuard has granted access. */
export async function acknowledge(cfg: GooglePlayConfig, productId: string, purchaseToken: string, f: Fetch = fetch) {
  const token = await accessToken(cfg.account, f);
  const url = `${API}/${encodeURIComponent(cfg.packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  const res = await reach(f, url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}" });
  if (!res.ok) throw new ServiceError(502, "Couldn't confirm the purchase with Google Play. Try again in a moment.", "store_unavailable");
}
