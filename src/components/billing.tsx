"use client";

import { useState, useTransition } from "react";
import { Icon } from "./icon";
import { useFlow } from "./flow";
import { peso } from "@/lib/format";
import { buyPass, cancelAutoRenew, startAutoRenew } from "@/app/actions/billing";
import type { FirstPayment } from "@/lib/web-billing";

type Interval = "month" | "year";

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

export function BuyPlan({ prices, methods, payer, autoRenewBlocked }: {
  prices: Record<Interval, number>;
  methods: string;
  payer: { name: string; email: string };
  /** Why auto-renew can't start yet (paid time left), or null */
  autoRenewBlocked: string | null;
}) {
  const [interval, setPeriod] = useState<Interval>("month");
  const [paying, setPaying] = useState<"autorenew" | null>(null);
  const [method, setMethod] = useState<"card" | "paymaya">("card");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const price = prices[interval];
  const per = interval === "month" ? "month" : "year";
  const saving = Math.round((1 - prices.year / (prices.month * 12)) * 100);

  const pass = () => start(async () => {
    setError(null);
    const r = await buyPass(interval); // redirects to PayMongo on success
    if (r?.error) setError(r.error);
  });

  const autoRenew = (form: FormData) => start(async () => {
    setError(null);
    const r = await startAutoRenew(interval);
    if ("error" in r) { setError(r.error); return; }
    try {
      await payFirstInvoice(r.payment, method, Object.fromEntries([...form].map(([k, v]) => [k, String(v)])), payer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The payment didn't go through.");
    }
  });

  return (
    <div className="dash-col" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ fontSize: 16 }}>Get eGuard Family: up to 15 devices</h3>
        <div className="seg" role="group" aria-label="Billing period">
          <button type="button" aria-pressed={interval === "month"} onClick={() => setPeriod("month")}>Monthly</button>
          <button type="button" aria-pressed={interval === "year"} onClick={() => setPeriod("year")}>Yearly{saving > 0 ? ` · save ${saving}%` : ""}</button>
        </div>
      </div>
      {error ? <div className="form-error" role="alert"><Icon name="triangle-alert" />{error}</div> : null}

      {paying === "autorenew" ? (
        <form action={autoRenew} className="buy-option" style={{ gap: 14 }}>
          <div className="t-title">Auto-renew: {peso(price)} every {per}</div>
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
            <span>Your {method === "card" ? "card details go" : "payment goes"} straight to PayMongo; eGuard never sees them. You&apos;re charged {peso(price)} now and every {per} until you turn auto-renew off.</span>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost" onClick={() => { setPaying(null); setError(null); }}>Back</button>
            <button className="btn btn-primary" disabled={pending}>{pending ? "Processing…" : `Pay ${peso(price)} and turn on auto-renew`}</button>
          </div>
        </form>
      ) : (
        <div className="buy-grid">
          <div className="buy-option">
            <div className="row" style={{ gap: 8 }}><Icon name="refresh-cw" /><span className="t-title">Auto-renew</span></div>
            <div className="price">{peso(price)} <small>/ {per}</small></div>
            <p className="t-meta">Card or Maya. Renews every {per} until you turn it off.</p>
            {autoRenewBlocked ? <p className="t-meta">{autoRenewBlocked}</p> : null}
            <button type="button" className="btn btn-primary" disabled={pending || !!autoRenewBlocked} onClick={() => setPaying("autorenew")}><Icon name="credit-card" />Turn on auto-renew</button>
          </div>
          <div className="buy-option">
            <div className="row" style={{ gap: 8 }}><Icon name="wallet" /><span className="t-title">Pay once</span></div>
            <div className="price">{peso(price)} <small>for 1 {per}</small></div>
            <p className="t-meta">{methods}. Doesn&apos;t renew; we&apos;ll email you before it ends. Buying again adds another {per}.</p>
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={pass}>{pending ? "Opening checkout…" : `Pay ${peso(price)}`}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CancelAutoRenew({ endsOn }: { endsOn: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const { toast } = useFlow();
  if (!confirm) return <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(true)}>Turn off auto-renew</button>;
  return (
    <div className="row" role="alert" style={{ gap: 10, flexWrap: "wrap" }}>
      <span className="t-meta" style={{ color: "var(--ink-2)" }}>You keep eGuard Family until {endsOn}. After that your family goes back to eGuard Plus.</span>
      <span className="row" style={{ gap: 6 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Keep it on</button>
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => start(async () => {
          const r = await cancelAutoRenew();
          toast(r.error ?? `Auto-renew is off. eGuard Family stays until ${endsOn}.`);
          setConfirm(false);
        })}>Turn off</button>
      </span>
    </div>
  );
}
