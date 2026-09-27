import { generateKeyPairSync, verify } from "node:crypto";
import type { PlaySubscription } from "../src/lib/google-play";

/**
 * A stand-in for Google's OAuth and Play Developer APIs. It checks the service-account JWT
 * signature like Google does, serves subscriptions from `subs`, and records acknowledgements.
 */
export function fakeGooglePlay(packageName = "app.eguard.android") {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const account = {
    client_email: `billing-${Math.random().toString(36).slice(2)}@eguard.iam.gserviceaccount.com`,
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    private_key_id: "key1",
  };
  const subs = new Map<string, PlaySubscription>();
  const acknowledged: string[] = [];
  const calls: string[] = [];

  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (url === "https://oauth2.googleapis.com/token") {
      const assertion = new URLSearchParams(String(init?.body)).get("assertion") ?? "";
      const [h, c, s] = assertion.split(".");
      const ok = verify("RSA-SHA256", Buffer.from(`${h}.${c}`), publicKey, Buffer.from(s, "base64url"));
      const claims = JSON.parse(Buffer.from(c, "base64url").toString());
      if (!ok || claims.iss !== account.client_email || claims.scope !== "https://www.googleapis.com/auth/androidpublisher") {
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      }
      return Response.json({ access_token: "ya29.fake", expires_in: 3600 });
    }
    const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/`;
    if (!url.startsWith(base)) return new Response("not found", { status: 404 });
    if ((init?.headers as Record<string, string>)?.authorization !== "Bearer ya29.fake") return new Response("unauthorized", { status: 401 });
    const get = url.match(/subscriptionsv2\/tokens\/([^/]+)$/);
    if (get) {
      const sub = subs.get(decodeURIComponent(get[1]));
      return sub ? Response.json(sub) : Response.json({ error: { code: 404 } }, { status: 404 });
    }
    const ack = url.match(/subscriptions\/[^/]+\/tokens\/([^/:]+):acknowledge$/);
    if (ack && init?.method === "POST") {
      const token = decodeURIComponent(ack[1]);
      acknowledged.push(token);
      const sub = subs.get(token);
      if (sub) sub.acknowledgementState = "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
      return Response.json({});
    }
    return new Response("not found", { status: 404 });
  }) as typeof globalThis.fetch;

  return { cfg: { packageName, account }, fetch, subs, acknowledged, calls, publicKey };
}

export function playSub(o: { productId?: string; state?: string; expiresInMs?: number; accountId?: string; ack?: boolean; linked?: string; autoRenew?: boolean }): PlaySubscription {
  return {
    subscriptionState: o.state ?? "SUBSCRIPTION_STATE_ACTIVE",
    acknowledgementState: o.ack ? "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" : "ACKNOWLEDGEMENT_STATE_PENDING",
    ...(o.linked ? { linkedPurchaseToken: o.linked } : {}),
    externalAccountIdentifiers: o.accountId ? { obfuscatedExternalAccountId: o.accountId } : undefined,
    lineItems: [{
      productId: o.productId ?? "eguard_family",
      expiryTime: new Date(Date.now() + (o.expiresInMs ?? 30 * 864e5)).toISOString(),
      autoRenewingPlan: { autoRenewEnabled: o.autoRenew ?? true },
    }],
  };
}
