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

/** `price`: centavos per month; `yearly`: centavos per year (two months free) */
export type PlanCard = { id: "FREE" | "PLUS" | "PRO"; name: string; blurb: string; price: number; yearly: number; features: string[] };
export type Period = "month" | "year";

export function BuyPlan({ plans, current, methods, payer, autoRenewBlocked, passOnly }: {
  /** Free first, then the paid plans */
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
  const [period, setPeriod] = useState<Period>("month");
  const yearly = period === "year";
  // Months a year saves, from the prices themselves (they come from env), so the label can't promise more than they give
  const paid = plans.find((p) => p.price > 0);
  const freeMonths = paid ? Math.round((paid.price * 12 - paid.yearly) / paid.price) : 0;
  const [busyWith, setBusyWith] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const pass = (plan: PlanCard) => start(async () => {
    setError(null); setBusyWith(plan.id);
    try {
      const r = await buyPass(plan.id, period); // redirects to PayMongo on success
      if (r?.error) setError(r.error);
    } catch {
      setError(FAILED);
    }
  });

  if (paying) return <AutoRenewCheckout plan={paying} period={period} payer={payer} onBack={() => setPaying(null)} />;

  return (
    <div className="dash-col" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ fontSize: 16 }}>Plans</h3>
        <div className="seg" role="group" aria-label="Billing period">
          <button type="button" aria-pressed={!yearly} onClick={() => setPeriod("month")}>Monthly</button>
          <button type="button" aria-pressed={yearly} onClick={() => setPeriod("year")}>Yearly{freeMonths > 0 ? ` · ${freeMonths} month${freeMonths === 1 ? "" : "s"} free` : ""}</button>
        </div>
      </div>
      <span className="t-meta">{methods} for {yearly ? "one-year" : "one-month"} passes; card or Maya for auto-renew.</span>
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
              <div className="price">{p.price ? peso(yearly ? p.yearly : p.price) : "Free"}{p.price ? <small> / {period}</small> : null}</div>
              {/* What a year saves against twelve months, from the prices themselves */}
              {p.price && yearly && p.price * 12 > p.yearly ? <span className="t-meta">{peso(Math.round(p.yearly / 12))} a month · save {peso(p.price * 12 - p.yearly)}</span> : null}
              <p className="t-meta">{p.blurb}</p>
              <ul>{p.features.map((f) => <li key={f}><Icon name="check" />{f}</li>)}</ul>
              {p.id === "FREE" ? null : (
                <div className="dash-col" style={{ gap: 8, marginTop: "auto" }}>
                  <button type="button" className="btn btn-primary" disabled={pending || !!autoRenewBlocked || locked} onPointerEnter={preloadCheckout} onFocus={preloadCheckout} onClick={() => { setError(null); setPaying(p); }}>
                    <Icon name="refresh-cw" />Auto-renew {yearly ? "yearly" : "monthly"}
                  </button>
                  <button type="button" className="btn btn-secondary" disabled={pending || locked} onClick={() => pass(p)}>
                    {pending && busyWith === p.id ? <><Icon name="loader-circle" className="spin" />Opening checkout…</> : isCurrent ? `Add a ${period}` : `Pay for 1 ${period}`}
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

/**
 * `losing`: what the family loses back on Free, e.g. "1 child, 2 devices, no location sharing".
 * `endsOn` null: the last renewal failed, so the plan only runs on while it's retried and ends as soon as it's off.
 */
export function CancelAutoRenew({ plan, endsOn, losing }: { plan: string; endsOn: string | null; losing: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, run] = useAction();
  if (!confirm) return <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(true)}>Turn off auto-renew</button>;
  return (
    <div className="row" role="alert" style={{ gap: 10, flexWrap: "wrap" }}>
      <span className="t-meta" style={{ color: "var(--ink-2)" }}>
        {endsOn ? `You keep ${plan} until ${endsOn}. After that your family goes back to Free` : `The last renewal wasn't paid, so ${plan} ends now and your family goes back to Free`}: {losing}. Children and devices already added stay protected.
      </span>
      <span className="row" style={{ gap: 6 }}>
        <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setConfirm(false)}>Keep it on</button>
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(cancelAutoRenew, {
          ok: endsOn ? `Auto-renew is off. ${plan} stays until ${endsOn}.` : `Auto-renew is off. Your family is back on Free.`,
          onOk: () => setConfirm(false),
        })}>{pending ? <><Icon name="loader-circle" className="spin" />Turning off…</> : "Turn off"}</button>
      </span>
    </div>
  );
}
