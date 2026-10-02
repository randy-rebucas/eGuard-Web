"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Icon } from "./icon";
import { Loading } from "./skeleton";
import { FAILED, useAction } from "./flow";
import { peso } from "@/lib/format";
import { buyPass, cancelAutoRenew } from "@/app/actions/billing";

// The payment form and PayMongo calls only download once a parent heads for auto-renew
const loadCheckout = () => import("./checkout");
const preloadCheckout = () => { void loadCheckout().catch(() => {}); };
const AutoRenewCheckout = dynamic(() => loadCheckout().then((m) => m.AutoRenewCheckout), {
  ssr: false,
  loading: () => <Loading height={320} radius={14} label="Loading payment form" />,
});

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

  if (paying) return <AutoRenewCheckout plan={paying} payer={payer} onBack={() => setPaying(null)} />;

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
                  <button type="button" className="btn btn-primary" disabled={pending || !!autoRenewBlocked || locked} onPointerEnter={preloadCheckout} onFocus={preloadCheckout} onClick={() => { setError(null); setPaying(p); }}>
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
