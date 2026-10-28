"use client";

import { useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";

/** `appLimit`: apps shown per child, null for all */
export type FinderPlan = { id: string; name: string; price: string; children: number; devices: number; location: boolean; categoryLimits: boolean; appLimit: number | null };

/**
 * "Which plan fits?": the smallest plan whose limits cover the family. Limits come from the plan catalogue
 * (passed in by the server page), so the answer matches what the server enforces.
 */
export function PlanFinder({ plans, links, contact }: { plans: FinderPlan[]; links: Record<string, ReactNode>; contact: string }) {
  const [children, setChildren] = useState(1);
  const [phones, setPhones] = useState(1);
  const [browsers, setBrowsers] = useState(0);
  const [location, setLocation] = useState(false);
  const [gaming, setGaming] = useState(false);
  const [allApps, setAllApps] = useState(false);
  const devices = phones + browsers;
  const fit = plans.find((p) => p.children >= children && p.devices >= devices && (!location || p.location) && (!gaming || p.categoryLimits) && (!allApps || p.appLimit === null));
  // The smallest app limit any plan has, for the question's wording ("more than 5")
  const fewest = Math.min(...plans.map((p) => p.appLimit ?? Infinity));

  return (
    <div className="pf">
      <div className="pf-inputs">
        <Stepper label="Children" value={children} set={setChildren} min={1} max={20} />
        <Stepper label="Phones and tablets" value={phones} set={setPhones} min={0} max={40} />
        <Stepper label="Browsers on computers" hint="Chrome and Edge on one laptop count as two" value={browsers} set={setBrowsers} min={0} max={40} />
        <label className="pf-check"><input type="checkbox" checked={location} onChange={(e) => setLocation(e.target.checked)} />I want to see where my child&apos;s phone is</label>
        <label className="pf-check"><input type="checkbox" checked={gaming} onChange={(e) => setGaming(e.target.checked)} />I want one limit for all games together</label>
        {Number.isFinite(fewest) ? <label className="pf-check"><input type="checkbox" checked={allApps} onChange={(e) => setAllApps(e.target.checked)} />I want to see and manage more than {fewest} of my child&apos;s apps</label> : null}
      </div>
      <div className="pf-result" aria-live="polite">
        {fit ? (
          <>
            <span className="pf-kicker">Your family fits</span>
            <b className="pf-name">{fit.name}</b>
            <span className="pf-price num">₱{fit.price}<small> / month</small></span>
            <p>Up to {fit.children} {fit.children === 1 ? "child" : "children"} and {fit.devices} devices. You&apos;d use {children} {children === 1 ? "child" : "children"} and {devices} {devices === 1 ? "device" : "devices"}.</p>
            <div className="pf-cta">{links[fit.id]}</div>
          </>
        ) : (
          <>
            <span className="pf-kicker">Bigger than our family plans</span>
            <b className="pf-name">Let&apos;s talk</b>
            <p>For more than {plans.at(-1)!.children} children or {plans.at(-1)!.devices} devices, write to <a href={`mailto:${contact}`}>{contact}</a>. Schools and organizations can also sponsor families&apos; plans.</p>
          </>
        )}
      </div>
    </div>
  );
}

function Stepper({ label, hint, value, set, min, max }: { label: string; hint?: string; value: number; set: (n: number) => void; min: number; max: number }) {
  return (
    <div className="pf-row">
      <span className="pf-label">{label}{hint ? <small>{hint}</small> : null}</span>
      <div className="pf-step" role="group" aria-label={label}>
        <button type="button" onClick={() => set(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}><Minus /></button>
        <output className="num" aria-live="polite">{value}</output>
        <button type="button" onClick={() => set(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}><Plus /></button>
      </div>
    </div>
  );
}
