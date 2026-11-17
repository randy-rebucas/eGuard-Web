import { createPrivateKey, sign, type KeyObject } from "node:crypto";
import { ServiceError } from "../errors";
import type { NormalizedReview } from "./types";

/**
 * App Store reviews through the App Store Connect API (customerReviews, customerReviewResponses).
 *
 * Config (App Store Connect › Users and Access › Integrations › Team Keys, role "Customer Support" or higher):
 *   APP_STORE_CONNECT_ISSUER_ID     the issuer id shown above the keys
 *   APP_STORE_CONNECT_KEY_ID        the key's id
 *   APP_STORE_CONNECT_PRIVATE_KEY   the downloaded .p8 file's PEM ("\n" written as two characters is accepted)
 *   APP_STORE_APP_ID                the app's Apple ID (App Information › Apple ID), a number
 */

type Fetch = typeof fetch;
type Env = Record<string, string | undefined>;

const BASE = "https://api.appstoreconnect.apple.com";
const TIMEOUT_MS = 15_000;
/** Apple refuses tokens that live longer than 20 minutes */
const TOKEN_SECONDS = 1200;

export type AppStoreConfig = { issuerId: string; keyId: string; privateKey: KeyObject; appId: string };

export function appStoreConfig(env: Env = process.env): AppStoreConfig | null {
  const issuerId = env.APP_STORE_CONNECT_ISSUER_ID?.trim();
  const keyId = env.APP_STORE_CONNECT_KEY_ID?.trim();
  const pem = env.APP_STORE_CONNECT_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
  const appId = env.APP_STORE_APP_ID?.trim();
  if (!issuerId || !keyId || !pem || !appId) return null;
  try {
    return { issuerId, keyId, privateKey: createPrivateKey(pem), appId };
  } catch {
    console.error("APP_STORE_CONNECT_PRIVATE_KEY isn't a valid .p8 key: App Store reviews won't sync");
    return null;
  }
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const tokenCache = new Map<string, { token: string; until: number }>();

/** The bearer token App Store Connect takes: an ES256 JWT, reused until a few minutes before it ends */
export function ascToken(cfg: AppStoreConfig, now = Date.now()) {
  const hit = tokenCache.get(cfg.keyId);
  if (hit && hit.until > now) return hit.token;
  const iat = Math.floor(now / 1000);
  const input = `${b64({ alg: "ES256", kid: cfg.keyId, typ: "JWT" })}.${b64({ iss: cfg.issuerId, iat, exp: iat + TOKEN_SECONDS, aud: "appstoreconnect-v1" })}`;
  const sig = sign("sha256", Buffer.from(input), { key: cfg.privateKey, dsaEncoding: "ieee-p1363" });
  const token = `${input}.${sig.toString("base64url")}`;
  tokenCache.set(cfg.keyId, { token, until: now + (TOKEN_SECONDS - 300) * 1000 });
  return token;
}

const unreachable = () => new ServiceError(502, "Couldn't reach App Store Connect. Try again in a moment.", "store_unavailable");

async function call(cfg: AppStoreConfig, url: string, f: Fetch, init: RequestInit = {}) {
  let res: Response;
  try {
    res = await f(url, {
      ...init,
      headers: { authorization: `Bearer ${ascToken(cfg)}`, ...(init.body ? { "content-type": "application/json" } : {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error("[app-store]", e instanceof Error ? e.message : e);
    throw unreachable();
  }
  if (res.status === 401 || res.status === 403) {
    throw new ServiceError(503, "App Store Connect refused the API key: check APP_STORE_CONNECT_* and that the key's role can manage reviews.", "store_forbidden");
  }
  return res;
}

export type AscReview = {
  id: string;
  attributes?: { rating?: number; title?: string; body?: string; reviewerNickname?: string; createdDate?: string; territory?: string };
  relationships?: { response?: { data?: { id: string } | null } };
};
type AscResponse = { id: string; attributes?: { responseBody?: string; lastModifiedDate?: string } };
type ListResponse = { data?: AscReview[]; included?: (AscResponse & { type?: string })[]; links?: { next?: string } };

export function normalizeAscReview(raw: AscReview, included: AscResponse[] = []): NormalizedReview | null {
  const a = raw.attributes ?? {};
  const reviewedAt = a.createdDate ? new Date(a.createdDate) : null;
  if (!raw.id || !a.rating || a.rating < 1 || a.rating > 5 || !reviewedAt || Number.isNaN(reviewedAt.getTime())) return null;
  const replyId = raw.relationships?.response?.data?.id ?? null;
  const resp = replyId ? included.find((i) => i.id === replyId) : undefined;
  return {
    store: "APP_STORE",
    externalId: raw.id,
    rating: a.rating,
    reviewTitle: a.title?.trim() || null,
    text: (a.body ?? "").trim(),
    authorName: a.reviewerNickname?.trim() || null,
    language: null,
    territory: a.territory ?? null,
    appVersion: null,
    device: null,
    reviewedAt,
    reply: resp?.attributes?.responseBody?.trim()
      ? { text: resp.attributes.responseBody.trim(), at: resp.attributes.lastModifiedDate ? new Date(resp.attributes.lastModifiedDate) : null, id: resp.id }
      : null,
  };
}

/** One page of reviews, newest first, with their replies, and the next page's URL (null on the last) */
export async function listAscReviews(cfg: AppStoreConfig, page: { next?: string | null } = {}, f: Fetch = fetch) {
  const first = `${BASE}/v1/apps/${encodeURIComponent(cfg.appId)}/customerReviews?${new URLSearchParams({ sort: "-createdDate", limit: "200", include: "response" })}`;
  // Only ever follow links back to App Store Connect, whatever a response says
  const url = page.next?.startsWith(`${BASE}/`) ? page.next : first;
  const res = await call(cfg, url, f);
  if (!res.ok) throw unreachable();
  const body = (await res.json().catch(() => { throw unreachable(); })) as ListResponse;
  const included = (body.included ?? []).filter((i) => !i.type || i.type === "customerReviewResponses");
  return {
    reviews: (body.data ?? []).map((r) => normalizeAscReview(r, included)),
    next: body.links?.next ?? null,
  };
}

/** Creates the review's response, or replaces the one it has */
export async function respondAscReview(cfg: AppStoreConfig, reviewId: string, text: string, f: Fetch = fetch) {
  const res = await call(cfg, `${BASE}/v1/customerReviewResponses`, f, {
    method: "POST",
    body: JSON.stringify({
      data: { type: "customerReviewResponses", attributes: { responseBody: text }, relationships: { review: { data: { type: "customerReviews", id: reviewId } } } },
    }),
  });
  if (res.status === 409 || res.status === 422) throw new ServiceError(400, "App Store Connect didn't accept this reply.", "store_rejected");
  if (!res.ok) throw unreachable();
  const body = (await res.json().catch(() => ({}))) as { data?: AscResponse };
  return { id: body.data?.id ?? null, at: new Date() };
}
