import { createHmac, timingSafeEqual } from "node:crypto";
import { ServiceError } from "./errors";

/**
 * PayMongo API client for web payments: hosted Checkout (one-time passes, any payment method) and
 * Subscriptions (auto-renew on card or Maya). https://docs.paymongo.com
 *
 * Config:
 *   PAYMONGO_SECRET_KEY      sk_test_… / sk_live_… (server only)
 *   PAYMONGO_PUBLIC_KEY      pk_test_… / pk_live_… (the browser uses it to send card details straight to PayMongo)
 *   PAYMONGO_WEBHOOK_SECRET  the webhook endpoint's secret key (whsk_…)
 */

type Fetch = typeof fetch;

const API = "https://api.paymongo.com";

export function paymongoConfig(env: Record<string, string | undefined> = process.env) {
  const secretKey = env.PAYMONGO_SECRET_KEY?.trim();
  const publicKey = env.PAYMONGO_PUBLIC_KEY?.trim();
  if (!secretKey || !publicKey) return null;
  const livemode = secretKey.startsWith("sk_live_");
  if (livemode !== publicKey.startsWith("pk_live_")) return null; // test and live keys mixed up
  return { secretKey, publicKey, livemode, webhookSecret: env.PAYMONGO_WEBHOOK_SECRET?.trim() || null };
}

export type PaymongoConfig = NonNullable<ReturnType<typeof paymongoConfig>>;

/** PayMongo's JSON:API resource shape. */
export type Resource<A> = { id: string; type: string; attributes: A };

async function call<A>(cfg: PaymongoConfig, method: string, path: string, body: unknown, f: Fetch): Promise<Resource<A>> {
  const res = await f(`${API}${path}`, {
    method,
    headers: {
      authorization: `Basic ${Buffer.from(`${cfg.secretKey}:`).toString("base64")}`,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify({ data: { attributes: body } }) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { data?: unknown; errors?: { code?: string; detail?: string }[] };
  if (!res.ok) {
    const err = json.errors?.[0];
    console.error("[paymongo]", method, path, res.status, err?.code, err?.detail);
    if (res.status === 404) throw new ServiceError(404, "PayMongo doesn't know this payment.", "payment_not_found");
    if (res.status >= 500 || res.status === 429) throw new ServiceError(502, "Couldn't reach PayMongo. Try again in a moment.", "payment_unavailable");
    throw new ServiceError(502, "PayMongo refused the request. Try again, or contact support if it keeps happening.", "payment_rejected");
  }
  return json.data as Resource<A>;
}

/* ---------- Checkout (prepaid passes) ---------- */

export type CheckoutSession = {
  checkout_url: string;
  status?: string; // active | expired
  reference_number?: string;
  payments?: Resource<{ status: string; amount: number; payment_intent_id?: string }>[];
  payment_intent?: Resource<{ status: string }> | null;
};

/** One line item; `amount` is per unit, in centavos (quantity defaults to 1). */
export function createCheckoutSession(cfg: PaymongoConfig, o: {
  name: string; description: string; amount: number; quantity?: number; methods: string[]; email: string; reference: string;
  successUrl: string; cancelUrl: string; metadata: Record<string, string>;
}, f: Fetch = fetch) {
  return call<CheckoutSession>(cfg, "POST", "/v2/checkout_sessions", {
    line_items: [{ name: o.name, description: o.description, amount: o.amount, currency: "PHP", quantity: o.quantity ?? 1 }],
    payment_method_types: o.methods,
    description: o.description,
    customer_email: o.email,
    reference_number: o.reference,
    send_email_receipt: true,
    show_description: true,
    show_line_items: true,
    success_url: o.successUrl,
    cancel_url: o.cancelUrl,
    metadata: o.metadata,
  }, f);
}

export const getCheckoutSession = (cfg: PaymongoConfig, id: string, f: Fetch = fetch) =>
  call<CheckoutSession>(cfg, "GET", `/v1/checkout_sessions/${encodeURIComponent(id)}`, undefined, f);

/** The paid payment of a checkout session, if any. */
export const paidPayment = (cs: CheckoutSession) => cs.payments?.find((p) => p.attributes.status === "paid") ?? null;

/* ---------- Subscriptions (auto-renew) ---------- */

export type Subscription = {
  status: string; // incomplete | incomplete_cancelled | active | past_due | unpaid | cancelled
  customer_id: string;
  next_billing_schedule: string | null; // YYYY-MM-DD
  latest_invoice: { id: string; status: string; payment_intent: { id: string; status: string } | null } | null;
  plan: { id: string } | null;
};

type Plan = { name: string; amount: number; currency: string; interval: string; interval_count: number };
type Customer = { email: string };

const planCache = new Map<string, string>();

/** The PayMongo plan for this price, created on first use, so changing the price in env needs no dashboard work. */
export async function planFor(cfg: PaymongoConfig, planName: string, amount: number, f: Fetch = fetch) {
  const name = `${planName} monthly ${(amount / 100).toFixed(2)} PHP`;
  const key = `${cfg.secretKey.slice(-8)}:${name}`;
  const hit = planCache.get(key);
  if (hit) return hit;
  const list = (await callList<Plan>(cfg, `/v1/subscriptions/plans?name=${encodeURIComponent(name)}&limit=100`, f))
    .find((p) => p.attributes.name === name && p.attributes.amount === amount && p.attributes.interval_count === 1);
  const plan = list ?? await call<Plan>(cfg, "POST", "/v1/subscriptions/plans", {
    name, description: `${planName}, billed every month`,
    amount, currency: "PHP", interval: "monthly", interval_count: 1,
  }, f);
  planCache.set(key, plan.id);
  return plan.id;
}

async function callList<A>(cfg: PaymongoConfig, path: string, f: Fetch) {
  const res = await f(`${API}${path}`, { headers: { authorization: `Basic ${Buffer.from(`${cfg.secretKey}:`).toString("base64")}` } });
  if (!res.ok) throw new ServiceError(502, "Couldn't reach PayMongo. Try again in a moment.", "payment_unavailable");
  const json = (await res.json()) as { data?: Resource<A>[] };
  return json.data ?? [];
}

/** Reuses the customer PayMongo already has for this email (emails are unique there), or creates one. */
export async function customerFor(cfg: PaymongoConfig, o: { name: string; email: string }, f: Fetch = fetch) {
  const existing = (await callList<Customer>(cfg, `/v1/customers?email=${encodeURIComponent(o.email)}`, f)).find((c) => c.attributes.email === o.email);
  if (existing) return existing.id;
  const [first, ...rest] = o.name.trim().split(/\s+/);
  const c = await call<Customer>(cfg, "POST", "/v1/customers", {
    first_name: first || o.email, last_name: rest.join(" ") || first || o.email, email: o.email, default_device: "email",
  }, f);
  return c.id;
}

export const createSubscription = (cfg: PaymongoConfig, customerId: string, planId: string, f: Fetch = fetch) =>
  call<Subscription>(cfg, "POST", "/v1/subscriptions", { customer_id: customerId, plan_id: planId }, f);

export const getSubscription = (cfg: PaymongoConfig, id: string, f: Fetch = fetch) =>
  call<Subscription>(cfg, "GET", `/v1/subscriptions/${encodeURIComponent(id)}`, undefined, f);

export const cancelSubscription = (cfg: PaymongoConfig, id: string, f: Fetch = fetch) =>
  call<Subscription>(cfg, "POST", `/v1/subscriptions/${encodeURIComponent(id)}/cancel`, { cancellation_reason: "other" }, f);

/** The client key lets the browser attach a card or Maya to this payment intent with the public key. */
export const getPaymentIntent = (cfg: PaymongoConfig, id: string, f: Fetch = fetch) =>
  call<{ status: string; client_key: string; amount: number }>(cfg, "GET", `/v1/payment_intents/${encodeURIComponent(id)}`, undefined, f);

/**
 * Paid-through date of a subscription billing date (YYYY-MM-DD). PayMongo bills on Philippine dates;
 * access runs to the end of that day.
 */
export const endOfBillingDay = (date: string) => new Date(`${date}T23:59:59+08:00`);

/* ---------- Webhooks ---------- */

/**
 * Checks the Paymongo-Signature header: "t=<unix>,te=<test sig>,li=<live sig>", where each signature is
 * HMAC-SHA256(secret, `${t}.${rawBody}`) in hex. Only the signature for the key's mode counts.
 */
export function verifyWebhookSignature(header: string | null, rawBody: string, secret: string, livemode: boolean) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => { const i = p.indexOf("="); return [p.slice(0, i).trim(), p.slice(i + 1).trim()]; }));
  const given = livemode ? parts.li : parts.te;
  if (!parts.t || !given) return false;
  const want = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  return given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want));
}

/** A webhook delivery: { data: { id: evt_…, attributes: { type, livemode, data: <resource> } } } */
export type WebhookEvent = { id: string; type: string; livemode: boolean; resource: Resource<Record<string, unknown>> | null };

export function parseWebhookEvent(rawBody: string): WebhookEvent | null {
  try {
    const d = JSON.parse(rawBody)?.data;
    const a = d?.attributes;
    if (typeof d?.id !== "string" || typeof a?.type !== "string") return null;
    const r = a.data;
    return { id: d.id, type: a.type, livemode: !!a.livemode, resource: r && typeof r.id === "string" ? { id: r.id, type: String(r.type ?? ""), attributes: r.attributes ?? {} } : null };
  } catch {
    return null;
  }
}
