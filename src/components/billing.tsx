"use client";

import { useState, useTransition } from "react";
import { Icon } from "./icon";
import { FAILED, useAction } from "./flow";
import { peso } from "@/lib/format";
import { buyPass, cancelAutoRenew, startAutoRenew } from "@/app/actions/billing";
import type { FirstPayment } from "@/lib/web-billing";

/** Calls PayMongo from the browser with the public key, so card details never pass through eGuard. */
async function paymongo(path: string, publicKey: string, attributes: unknown) {
  const res = await fetch(`https://api.paymongo.com/v1/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${btoa(`${publicKey}:`)}` },
    body: JSON.stringify({ data: { attributes } }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.errors?.[0]?.detail ?? "PayMongo couldn't take this payment. Check the details and try again.");
  return json.data as { id: string; attributes: Record<string, unknown> };
}

/** Attaches a card or Maya to the first invoice's payment intent, then goes where PayMongo says (3DS, Maya, or back). */
async function payFirstInvoice(p: FirstPayment, method: "card" | "paymaya", card: Record<string, string>, payer: { name: string; email: string }) {
  const [mm, yy] = card.expiry.split("/").map((s) => s.trim());
  const pm = await paymongo("payment_methods", p.publicKey, method === "card"
    ? { type: "card", details: { card_number: card.number.replace(/\s+/g, ""), exp_month: Number(mm), exp_year: Number(yy?.length === 2 ? `20${yy}` : yy), cvc: card.cvc }, billing: { name: card.name || payer.name, email: payer.email } }
    : { type: "paymaya", billing: { name: payer.name, email: payer.email } });
  const intent = await paymongo(`payment_intents/${p.paymentIntentId}/attach`, p.publicKey, { payment_method: pm.id, client_key: p.clientKey, return_url: p.returnUrl });
  const a = intent.attributes as { status: string; next_action?: { redirect?: { url?: string } }; last_payment_error?: { failed_message?: string } };
  if (a.status === "awaiting_next_action" && a.next_action?.redirect?.url) window.location.assign(a.next_action.redirect.url);
  else if (a.status === "succeeded" || a.status === "processing") window.location.assign(p.returnUrl);
  else throw new Error(a.last_payment_error?.failed_message ?? "The payment didn't go through. Check the details or use another card.");
}

export type PlanCard = { id: "FREE" | "PLUS" | "PRO"; name: string; blurb: string; price: number; features: string[] };

export function BuyPlan({ plans, current, methods, payer, autoRenewBlocked, passOnly }: {
  /** Free first, then the paid plans; price in centavos per month */
  plans: PlanCard[];
  current: PlanCard["id"];
  methods: string;
  payer: { name: string; email: string };
  /** Why auto-renew can't start yet (paid time left), or null */
  autoRenewBlocked: string | null;
  /** While a pass runs, only more of the same plan can be bought: that plan, and why */
  passOnly: { plan: PlanCard["id"]; reason: string } | null;
}) {
  const [paying, setPaying] = useState<PlanCard | null>(null);
  const [busyWith, setBusyWith] = useState<string | null>(null);
  const [method, setMethod] = useState<"card" | "paymaya">("card");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const pass = (plan: PlanCard) => start(async () => {
    setError(null); setBusyWith(plan.id);
    try {
      const r = await buyPass(plan.id); // redirects to PayMongo on success
      if (r?.error) setError(r.error);
    } catch {
      setError(FAILED);
    }
  });

  const autoRenew = (form: FormData) => start(async () => {
    if (!paying) return;
    setError(null);
    let r: Awaited<ReturnType<typeof startAutoRenew>>;
    try { r = await startAutoRenew(paying.id); } catch { setError(FAILED); return; }
    if ("error" in r) { setError(r.error); return; }
    try {
      await payFirstInvoice(r.payment, method, Object.fromEntries([...form].map(([k, v]) => [k, String(v)])), payer);
    } catch (e) {
      // A network failure reaching PayMongo is a TypeError with a browser-specific message
      setError(e instanceof Error && !(e instanceof TypeError) ? e.message : "Couldn't reach PayMongo. Check your connection; you haven't been charged.");
    }
  });

  if (paying) {
    return (
      <form action={autoRenew} className="buy-option" style={{ gap: 14 }}>
        {error ? <div className="form-error" role="alert"><Icon name="triangle-alert" />{error}</div> : null}
        <div className="t-title">Auto-renew {paying.name}: {peso(paying.price)} every month</div>
        <div className="seg" role="group" aria-label="Pay with">
          <button type="button" aria-pressed={method === "card"} onClick={() => setMethod("card")}>Card</button>
          <button type="button" aria-pressed={method === "paymaya"} onClick={() => setMethod("paymaya")}>Maya</button>
        </div>
        {method === "card" ? (
          <div className="form-grid">
            <div className="field"><label htmlFor="cc-num">Card number</label><input className="input" id="cc-num" name="number" inputMode="numeric" autoComplete="cc-number" required placeholder="1234 5678 9012 3456" /></div>
            <div className="field"><label htmlFor="cc-exp">Expiry (MM/YY)</label><input className="input" id="cc-exp" name="expiry" autoComplete="cc-exp" required pattern="\s*\d{1,2}\s*/\s*\d{2,4}\s*" placeholder="12/29" /></div>
            <div className="field"><label htmlFor="cc-cvc">CVC</label><input className="input" id="cc-cvc" name="cvc" inputMode="numeric" autoComplete="cc-csc" required maxLength={4} /></div>
            <div className="field"><label htmlFor="cc-name">Name on card</label><input className="input" id="cc-name" name="name" autoComplete="cc-name" defaultValue={payer.name} /></div>
          </div>
        ) : <p className="t-meta">You&apos;ll sign in to Maya to approve this payment and future renewals.</p>}
        <div className="row t-meta" style={{ gap: 8, alignItems: "flex-start" }}>
          <Icon name="lock" size={14} style={{ flex: "none", marginTop: 3 }} />
          <span>Your {method === "card" ? "card details go" : "payment goes"} straight to PayMongo; eGuard never sees them. You&apos;re charged {peso(paying.price)} now and every month until you turn auto-renew off.</span>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => { setPaying(null); setError(null); }}>Back</button>
          <button className="btn btn-primary" disabled={pending}>{pending ? <><Icon name="loader-circle" className="spin" />Processing…</> : `Pay ${peso(paying.price)} and turn on auto-renew`}</button>
        </div>
      </form>
    );
  }

  return (
    <div className="dash-col" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ fontSize: 16 }}>Plans</h3>
        <span className="t-meta">Billed monthly. {methods} for one-month passes; card or Maya for auto-renew.</span>
      </div>
      {error ? <div className="form-error" role="alert"><Icon name="triangle-alert" />{error}</div> : null}
      {passOnly ? <p className="t-meta">{passOnly.reason}</p> : null}
      <div className="plan-grid">
        {plans.map((p) => {
          const isCurrent = p.id === current;
          const locked = !!passOnly && passOnly.plan !== p.id;
          return (
            <article key={p.id} className="plan-option" aria-current={isCurrent ? "true" : undefined}>
              <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                <span className="t-title">{p.name}</span>
                {isCurrent ? <span className="pill tone-accent">Current plan</span> : null}
              </div>
              <div className="price">{p.price ? peso(p.price) : "Free"}{p.price ? <small> / month</small> : null}</div>
              <p className="t-meta">{p.blurb}</p>
              <ul>{p.features.map((f) => <li key={f}><Icon name="check" />{f}</li>)}</ul>
              {p.id === "FREE" ? null : (
                <div className="dash-col" style={{ gap: 8, marginTop: "auto" }}>
                  <button type="button" className="btn btn-primary" disabled={pending || !!autoRenewBlocked || locked} onClick={() => { setError(null); setPaying(p); }}>
                    <Icon name="refresh-cw" />Auto-renew monthly
                  </button>
                  <button type="button" className="btn btn-secondary" disabled={pending || locked} onClick={() => pass(p)}>
                    {pending && busyWith === p.id ? <><Icon name="loader-circle" className="spin" />Opening checkout…</> : isCurrent ? "Add a month" : "Pay for 1 month"}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {autoRenewBlocked ? <p className="t-meta">Auto-renew: {autoRenewBlocked}</p> : null}
    </div>
  );
}

export function CancelAutoRenew({ plan, endsOn }: { plan: string; endsOn: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, run] = useAction();
  if (!confirm) return <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(true)}>Turn off auto-renew</button>;
  return (
    <div className="row" role="alert" style={{ gap: 10, flexWrap: "wrap" }}>
      <span className="t-meta" style={{ color: "var(--ink-2)" }}>You keep {plan} until {endsOn}. After that your family goes back to Free: 1 child, no location sharing. Children and devices already added stay protected.</span>
      <span className="row" style={{ gap: 6 }}>
        <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setConfirm(false)}>Keep it on</button>
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(cancelAutoRenew, {
          ok: `Auto-renew is off. ${plan} stays until ${endsOn}.`,
          onOk: () => setConfirm(false),
        })}>{pending ? <><Icon name="loader-circle" className="spin" />Turning off…</> : "Turn off"}</button>
      </span>
    </div>
  );
}
