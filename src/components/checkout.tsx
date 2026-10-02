"use client";

/** The auto-renew payment form. Lazy-loaded by BuyPlan (see billing.tsx) when a parent chooses auto-renew. */

import { useState, useTransition } from "react";
import { Icon } from "./icon";
import { FAILED } from "./flow";
import { peso } from "@/lib/format";
import { startAutoRenew } from "@/app/actions/billing";
import type { FirstPayment } from "@/lib/web-billing";
import type { PlanCard } from "./billing";

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

export function AutoRenewCheckout({ plan, payer, onBack }: { plan: PlanCard; payer: { name: string; email: string }; onBack: () => void }) {
  const [method, setMethod] = useState<"card" | "paymaya">("card");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const autoRenew = (form: FormData) => start(async () => {
    setError(null);
    let r: Awaited<ReturnType<typeof startAutoRenew>>;
    try { r = await startAutoRenew(plan.id); } catch { setError(FAILED); return; }
    if ("error" in r) { setError(r.error); return; }
    try {
      await payFirstInvoice(r.payment, method, Object.fromEntries([...form].map(([k, v]) => [k, String(v)])), payer);
    } catch (e) {
      // A network failure reaching PayMongo is a TypeError with a browser-specific message
      setError(e instanceof Error && !(e instanceof TypeError) ? e.message : "Couldn't reach PayMongo. Check your connection; you haven't been charged.");
    }
  });

  return (
    <form action={autoRenew} className="buy-option" style={{ gap: 14 }}>
      {error ? <div className="form-error" role="alert"><Icon name="triangle-alert" />{error}</div> : null}
      <div className="t-title">Auto-renew {plan.name}: {peso(plan.price)} every month</div>
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
        <span>Your {method === "card" ? "card details go" : "payment goes"} straight to PayMongo; eGuard never sees them. You&apos;re charged {peso(plan.price)} now and every month until you turn auto-renew off.</span>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-ghost" disabled={pending} onClick={onBack}>Back</button>
        <button className="btn btn-primary" disabled={pending}>{pending ? <><Icon name="loader-circle" className="spin" />Processing…</> : `Pay ${peso(plan.price)} and turn on auto-renew`}</button>
      </div>
    </form>
  );
}
