import { createHmac } from "node:crypto";
import type { PaymongoConfig, Subscription } from "../src/lib/paymongo";

/**
 * A stand-in for the PayMongo API: checkout sessions, customers, plans, subscriptions and payment
 * intents, with secret-key auth. Tests move payments along with pay(), activate() and setSub().
 */
export function fakePaymongo() {
  const cfg: PaymongoConfig = { secretKey: "sk_test_fake", publicKey: "pk_test_fake", livemode: false, webhookSecret: "whsk_fake" };
  const sessions = new Map<string, { status: string; paymentId: string | null; amount: number; reference: string }>();
  const subs = new Map<string, Subscription>();
  const intents = new Map<string, { status: string; client_key: string; amount: number }>();
  const plans: { id: string; attributes: Record<string, unknown> }[] = [];
  const customers: { id: string; attributes: { email: string } }[] = [];
  const calls: string[] = [];
  let n = 0;
  const id = (p: string) => `${p}_${++n}`;
  const ok = (data: unknown) => Response.json({ data });
  const res = <A,>(rid: string, type: string, attributes: A) => ({ id: rid, type, attributes });

  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url.pathname}${url.search}`);
    if ((init?.headers as Record<string, string>)?.authorization !== `Basic ${Buffer.from(`${cfg.secretKey}:`).toString("base64")}`) {
      return Response.json({ errors: [{ code: "unauthorized" }] }, { status: 401 });
    }
    const body = init?.body ? JSON.parse(String(init.body)).data.attributes : null;
    const path = url.pathname;
    let m: RegExpMatchArray | null;

    if (method === "POST" && path === "/v2/checkout_sessions") {
      const cs = id("cs");
      sessions.set(cs, { status: "active", paymentId: null, amount: body.line_items[0].amount, reference: body.reference_number });
      return ok(res(cs, "checkout_session", { checkout_url: `https://checkout.paymongo.test/${cs}` }));
    }
    if (method === "GET" && (m = path.match(/^\/v1\/checkout_sessions\/(.+)$/))) {
      const s = sessions.get(m[1]);
      if (!s) return Response.json({ errors: [{ code: "resource_not_found" }] }, { status: 404 });
      return ok(res(m[1], "checkout_session", {
        status: s.status, reference_number: s.reference,
        payments: s.paymentId ? [res(s.paymentId, "payment", { status: "paid", amount: s.amount })] : [],
      }));
    }
    if (path === "/v1/subscriptions/plans") {
      if (method === "GET") return ok(plans.filter((p) => !url.searchParams.get("name") || p.attributes.name === url.searchParams.get("name")));
      const p = res(id("plan"), "plan", body);
      plans.push(p);
      return ok(p);
    }
    if (path === "/v1/customers") {
      if (method === "GET") return ok(customers.filter((c) => c.attributes.email === url.searchParams.get("email")));
      if (!body.first_name || !body.last_name || !body.email || !body.default_device) return Response.json({ errors: [{ code: "parameter_required" }] }, { status: 400 });
      const c = res(id("cus"), "customer", body);
      customers.push(c);
      return ok(c);
    }
    if (method === "POST" && path === "/v1/subscriptions") {
      const pi = id("pi");
      intents.set(pi, { status: "awaiting_payment_method", client_key: `${pi}_client_x`, amount: Number(plans.find((p) => p.id === body.plan_id)?.attributes.amount) });
      const s = id("subs");
      subs.set(s, {
        status: "incomplete", customer_id: body.customer_id, next_billing_schedule: null, plan: { id: body.plan_id },
        latest_invoice: { id: id("inv"), status: "open", payment_intent: { id: pi, status: "awaiting_payment_method" } },
      });
      return ok(res(s, "subscription", subs.get(s)));
    }
    if ((m = path.match(/^\/v1\/subscriptions\/([^/]+)(\/cancel)?$/))) {
      const s = subs.get(m[1]);
      if (!s) return Response.json({ errors: [{ code: "resource_not_found" }] }, { status: 404 });
      if (method === "POST" && m[2]) s.status = "cancelled";
      return ok(res(m[1], "subscription", s));
    }
    if (method === "GET" && (m = path.match(/^\/v1\/payment_intents\/(.+)$/))) {
      const pi = intents.get(m[1]);
      return pi ? ok(res(m[1], "payment_intent", pi)) : Response.json({ errors: [{ code: "resource_not_found" }] }, { status: 404 });
    }
    return Response.json({ errors: [{ code: "not_found" }] }, { status: 404 });
  }) as typeof globalThis.fetch;

  return {
    cfg, fetch, sessions, subs, intents, plans, customers, calls,
    /** The parent pays the checkout. */
    pay(cs: string) { const s = sessions.get(cs)!; s.paymentId = id("pay"); return s.paymentId; },
    /** The first (or a renewal) invoice is paid; the next charge is on `nextBilling` (YYYY-MM-DD). */
    activate(sub: string, nextBilling: string) {
      const s = subs.get(sub)!;
      s.status = "active";
      s.next_billing_schedule = nextBilling;
      s.latest_invoice = { ...s.latest_invoice!, status: "paid", payment_intent: { ...s.latest_invoice!.payment_intent!, status: "succeeded" } };
    },
    setSub(sub: string, patch: Partial<Subscription>) { Object.assign(subs.get(sub)!, patch); },
    /** A webhook body and its Paymongo-Signature header, signed like PayMongo does in test mode. */
    webhook(type: string, resource: { id: string; type: string; attributes?: object }, o: { livemode?: boolean; t?: number } = {}) {
      const raw = JSON.stringify({ data: { id: id("evt"), type: "event", attributes: { type, livemode: !!o.livemode, data: { attributes: {}, ...resource } } } });
      const t = o.t ?? Math.floor(Date.now() / 1000);
      const sig = createHmac("sha256", cfg.webhookSecret!).update(`${t}.${raw}`).digest("hex");
      return { raw, header: o.livemode ? `t=${t},te=,li=${sig}` : `t=${t},te=${sig},li=` };
    },
  };
}
