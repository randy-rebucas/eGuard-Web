"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { BATCH_DISCOUNTS, batchDiscount, discountedCodePrice } from "@/lib/batch-discount";

/**
 * "What would it cost?": the same arithmetic as the checkout (lib/batch-discount, months × the plan's monthly web
 * price × codes, less the volume discount), so the estimate is the price. `monthly` comes from the server in
 * centavos, since prices can change without a release.
 */
export function SponsorEstimator({ plans, months, maxCodes }: {
  plans: { id: string; name: string; monthly: number }[]; months: readonly number[]; maxCodes: number;
}) {
  const [plan, setPlan] = useState(plans[0].id);
  const [term, setTerm] = useState(12);
  const [codes, setCodes] = useState(50);
  // What's in the box while typing: clearing it to type a new number mustn't snap it to 1 first ("50" → "150")
  const [typed, setTyped] = useState<string | null>(null);
  const monthly = plans.find((p) => p.id === plan)!.monthly;
  const each = discountedCodePrice(monthly * term, codes);
  const total = each * codes;
  const off = batchDiscount(codes);
  const next = [...BATCH_DISCOUNTS].reverse().find((t) => t.minQuantity > codes);
  const set = (n: number) => { setTyped(null); setCodes(Math.max(1, Math.min(maxCodes, Math.round(n) || 1))); };
  const type = (v: string) => {
    setTyped(v);
    const n = Number(v);
    if (v.trim() && Number.isFinite(n)) setCodes(Math.max(1, Math.min(maxCodes, Math.round(n) || 1)));
  };

  return (
    <div className="se">
      <div className="se-inputs">
        <fieldset>
          <legend>Plan</legend>
          <div className="se-seg">
            {plans.map((p) => <label key={p.id}><input type="radio" name="se-plan" checked={plan === p.id} onChange={() => setPlan(p.id)} /><span>{p.name}</span></label>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>Months per family</legend>
          <div className="se-seg">
            {months.map((m) => <label key={m}><input type="radio" name="se-months" checked={term === m} onChange={() => setTerm(m)} /><span>{m}</span></label>)}
          </div>
        </fieldset>
        <div className="se-codes">
          <label htmlFor="se-codes">Families (one code each)</label>
          <div className="se-step">
            <button type="button" onClick={() => set(codes - 10)} disabled={codes <= 1} aria-label="10 fewer"><Minus /></button>
            <input id="se-codes" type="number" inputMode="numeric" min={1} max={maxCodes} value={typed ?? codes} onChange={(e) => type(e.target.value)} onBlur={() => setTyped(null)} />
            <button type="button" onClick={() => set(codes + 10)} disabled={codes >= maxCodes} aria-label="10 more"><Plus /></button>
          </div>
          <small>Up to {maxCodes} codes in one batch; buy another batch for more.</small>
        </div>
      </div>
      <div className="se-result" aria-live="polite">
        <span className="se-kicker">Estimated total</span>
        <b className="num">{peso(total)}</b>
        <p>{peso(each)} per family for {term} {term === 1 ? "month" : "months"}{off ? <>, after <strong>{off}% off</strong></> : null}.</p>
        {next ? <p className="se-hint">Add {next.minQuantity - codes} more {next.minQuantity - codes === 1 ? "code" : "codes"} for {next.percent}% off.</p> : null}
        <p className="se-fine">Paid once by GCash, Maya, QR Ph or card. Codes can be redeemed for 12 months after you buy them.</p>
      </div>
    </div>
  );
}

const peso = (centavos: number) => `₱${(centavos / 100).toLocaleString("en-US", { minimumFractionDigits: centavos % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
