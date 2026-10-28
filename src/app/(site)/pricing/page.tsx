import type { Metadata } from "next";
import Link from "next/link";
import { Check, ChevronDown, CreditCard, Minus, RefreshCw, Ticket } from "lucide-react";
import { SignedIn, StartLink } from "@/components/signed-in";
import { FREE_CHILDREN, LEGACY_LIMITS, PLANS, planById, webPrice, type PaidPlanId, type Plan } from "@/lib/plans";
import { discountSummary } from "@/lib/batch-discount";
import { pageMetadata } from "@/lib/site";
import { supportEmail } from "@/lib/support";
import { PageHead } from "../page-head";
import { PlanFinder } from "./plan-finder";
import "./pricing.css";

export const metadata: Metadata = pageMetadata({
  title: "Pricing: free parental controls, plans in pesos",
  path: "/pricing",
  description: `eGuard is free for ${FREE_CHILDREN}. ${planById("PLUS").name} and ${planById("PRO").name} add more children and devices, alerts when a setting changes, location sharing and reports. Pay monthly or yearly in pesos with GCash, Maya, QR Ph or card.`,
});

const LOOK = {
  FREE: { cta: "Start free", style: "lp-btn-soft", featured: false },
  PLUS: { cta: `Get ${planById("PLUS").name}`, style: "lp-btn-primary", featured: true },
  PRO: { cta: `Get ${planById("PRO").name}`, style: "lp-btn-outline", featured: false },
} as const;

const money = (c: number) => (c % 100 ? (c / 100).toFixed(2) : (c / 100).toLocaleString("en-PH"));
const pesos = (p: Plan) => (p.id === "FREE" ? "0" : money(webPrice(p.id)));
/** "₱1,490 a year, 2 months free": the yearly price, and what it saves, from the prices themselves */
/** Months a year costs, from eGuard Plus's prices (the same ratio for every plan by default) */
const yearlyAnswer = () => {
  const months = Math.round(webPrice("PLUS", process.env, "year") / webPrice("PLUS"));
  return months < 12 ? `Yes. A year costs the same as ${months} months, as a pass or with auto-renew.` : "A year costs the same as paying monthly, as a pass or with auto-renew, and you pay once.";
};
const yearlyNote = (p: Plan) => {
  if (p.id === "FREE") return null;
  const year = webPrice(p.id, process.env, "year"), months = Math.round((webPrice(p.id) * 12 - year) / webPrice(p.id));
  return `or ₱${money(year)} a year${months > 0 ? `, ${months} month${months === 1 ? "" : "s"} free` : ""}`;
};

/** "eGuard Plus 5 children and 10 devices": what a family subscribed before 2026-10-28 keeps */
const legacyLine = (id: PaidPlanId) => `${planById(id).name} ${LEGACY_LIMITS[id].childLimit} children and ${LEGACY_LIMITS[id].deviceLimit} devices`;

type Cell = string | boolean;
/** Comparison rows, read from each plan's entitlements so they always match what the server enforces. */
const ROWS: [string, string | null, (p: Plan) => Cell][] = [
  ["Children", null, (p) => `Up to ${p.entitlements.childLimit}`],
  ["Devices", "Phones, tablets and browsers each count as one", (p) => `Up to ${p.entitlements.deviceLimit}`],
  ["All 10 protections", null, () => true],
  ["Configuration Health", "Each protection's status, from the device. Run a check any time", () => true],
  ["Alerts when a setting changes", "A protection changed on the device and no longer matches yours", (p) => p.entitlements.driftAlerts],
  ["Alerts if eGuard is removed or tampered with", "In the app and by email", () => true],
  ["Website and app requests", null, () => true],
  ["Apps you can see and manage", null, (p) => p.entitlements.appMonitoringLimit === null ? "All apps" : `${p.entitlements.appMonitoringLimit} per child`],
  ["Daily limits per app", null, () => true],
  ["Limits for a kind of app", "Like gaming time or social media", (p) => p.entitlements.categoryLimits],
  ["Location sharing and history", null, (p) => p.entitlements.locationSharing],
  ["Reports", null, (p) => p.entitlements.advancedReports ? "Today to 30 days, custom ranges up to a year, CSV export" : "Today, 7 days, custom ranges up to a week"],
  ["Push alerts", "On your phone, with the eGuard parent app", (p) => p.entitlements.realtimeAlerts ? "Every alert" : "Security alerts: eGuard removed, tampered with or turned off"],
  ["API access for schools and organizations", "API keys for your organization", (p) => p.entitlements.apiAccess],
  ["Support", "By email. Paid plans are answered first", (p) => p.id === "FREE" ? "Email" : p.id === "PLUS" ? "Priority" : "Top priority"],
];

const FAQS: [string, React.ReactNode][] = [
  ["What counts as a device?", "Each phone, tablet and browser you connect counts as one. A laptop with eGuard in both Chrome and Edge counts as two."],
  ["What does Free check?", `Free shows each protection's status on your child's device in Configuration Health, and you can run a check any time. It tells you if eGuard is removed or tampered with. ${planById("PLUS").name} and ${planById("PRO").name} also alert you when a setting changes on the device and no longer matches yours, so you know without checking.`],
  ["I subscribed before the new limits. Do mine change?", `No. Families subscribed before October 28, 2026 keep the limits they bought (${legacyLine("PLUS")}, ${legacyLine("PRO")}) for as long as they stay subscribed, including when they move up a plan.`],
  ["What's the difference between a pass and auto-renew?", "A pass is one month or one year, paid once with GCash, Maya, QR Ph or a card. It never renews; we remind you 3 days before it ends, and buying another adds to it. Auto-renew charges a card or Maya every month or every year until you turn it off."],
  ["Is paying yearly cheaper?", yearlyAnswer()],
  ["What happens if I move to a smaller plan?", "Nothing is removed. Children and devices over the new limit stay protected; you just can't add more until you're under it. If location sharing ends, current locations are cleared and any history is hidden until you upgrade again."],
  ["Can I pay in the app?", "Plans are bought on the web, in Settings › Subscription. Only the family admin can buy or cancel. The app shows your plan as soon as it's paid."],
  ["Do you have plans for schools or organizations?", <>Yes. Any parent can create an organization for a school, community group or business, share a join code with families, and buy sponsor codes that pay for families&apos; plans, with {discountSummary()}. {planById("PRO").name} adds API keys, so your own systems can read your codes and counts. Organizations only ever see counts, never a family&apos;s data. <Link href="/for-schools">How it works for organizations</Link>.</>],
];

function Mark({ value }: { value: Cell }) {
  if (value === true) return <span className="pc-yes"><Check aria-label="Included" /></span>;
  if (value === false) return <span className="pc-no"><Minus aria-label="Not included" /></span>;
  return <span>{value}</span>;
}

function PlanLink({ id, signedIn }: { id: Plan["id"]; signedIn: boolean }) {
  const look = LOOK[id];
  const href = signedIn ? (id === "FREE" ? "/dashboard" : "/settings/subscription") : "/register";
  return <Link href={href} className={`lp-btn ${look.style}`}>{signedIn && id === "FREE" ? "Open dashboard" : look.cta}</Link>;
}

export default function PricingPage() {
  return (
    <>
      <PageHead
        eyebrow="Pricing"
        title="Simple plans, priced in pesos"
        lede={`Start free with ${FREE_CHILDREN}. Upgrade when your family needs more children and devices, or wants to hear the moment a setting changes. Every plan verifies every protection.`}
      />

      <div className="pc">
        <div className="lp-plans pc-plans">
          {PLANS.map((p) => {
            const look = LOOK[p.id];
            return (
              <article key={p.id} className={`lp-plan${look.featured ? " featured" : ""}`}>
                {look.featured ? <span className="lp-plan-badge">Most Popular</span> : null}
                <h2 className="pc-plan-name">{p.name}</h2>
                <p>{p.blurb}</p>
                <div className="lp-price"><b className="num"><sup>₱</sup>{pesos(p)}</b><span>/ month</span></div>
                {yearlyNote(p) ? <p className="t-meta num">{yearlyNote(p)}</p> : null}
                <ul>{p.features.map((f) => <li key={f.key}><Check />{f.label}</li>)}</ul>
                <SignedIn signedIn={<PlanLink id={p.id} signedIn />} signedOut={<PlanLink id={p.id} signedIn={false} />} />
              </article>
            );
          })}
        </div>

        <section className="pc-sec" aria-labelledby="pc-finder">
          <h2 id="pc-finder">Which plan fits your family?</h2>
          <p className="pc-lede">Count every phone, tablet and browser your children use. Every plan verifies every protection.</p>
          <PlanFinder
            contact={supportEmail()}
            links={Object.fromEntries(PLANS.map((p) => [p.id, <SignedIn key={p.id} signedIn={<PlanLink id={p.id} signedIn />} signedOut={<PlanLink id={p.id} signedIn={false} />} />]))}
            plans={PLANS.map((p) => ({
              id: p.id, name: p.name, price: pesos(p), children: p.entitlements.childLimit, devices: p.entitlements.deviceLimit,
              location: p.entitlements.locationSharing, categoryLimits: p.entitlements.categoryLimits, appLimit: p.entitlements.appMonitoringLimit,
            }))}
          />
        </section>

        <section className="pc-sec" aria-labelledby="pc-compare">
          <h2 id="pc-compare">Compare plans</h2>
          <div className="pc-table" role="region" aria-labelledby="pc-compare" tabIndex={0}>
            <table>
              <thead>
                <tr><th scope="col"><span className="sr-only">Feature</span></th>{PLANS.map((p) => <th key={p.id} scope="col">{p.name}<small className="num">₱{pesos(p)}/mo</small></th>)}</tr>
              </thead>
              <tbody>
                {ROWS.map(([label, note, get]) => (
                  <tr key={label}>
                    <th scope="row">{label}{note ? <small>{note}</small> : null}</th>
                    {PLANS.map((p) => <td key={p.id}><Mark value={get(p)} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="pc-sec" aria-labelledby="pc-pay">
          <h2 id="pc-pay">Two ways to pay</h2>
          <p className="pc-lede">Same price either way. Pay on the web, in Settings › Subscription.</p>
          <div className="pc-ways">
            <div className="pc-way">
              <i><Ticket /></i>
              <h3>Pass</h3>
              <p>Pay once for a month or a year. Nothing renews by surprise.</p>
              <ul className="pc-methods"><li>GCash</li><li>Maya</li><li>QR Ph</li><li>Card</li></ul>
              <ul className="pc-points">
                <li><Check />We remind you 3 days before it ends</li>
                <li><Check />Buy another to add a month or a year</li>
              </ul>
            </div>
            <div className="pc-way">
              <i><RefreshCw /></i>
              <h3>Auto-renew</h3>
              <p>Charged every month or every year, so protection never lapses.</p>
              <ul className="pc-methods"><li>Visa</li><li>Mastercard</li><li>Maya</li></ul>
              <ul className="pc-points">
                <li><Check />Turn it off any time</li>
                <li><Check />Payments handled securely by PayMongo</li>
              </ul>
            </div>
          </div>
          <p className="pc-note"><CreditCard />eGuard never sees your card details. Payments go through PayMongo, and we confirm each one with PayMongo directly.</p>
        </section>

        <section className="pc-sec" aria-labelledby="pc-faq">
          <h2 id="pc-faq">Questions about plans</h2>
          <div className="lp-faq-list pc-faq">
            {FAQS.map(([q, a]) => (
              <details key={q} name="pc-faq"><summary>{q}<ChevronDown /></summary><p>{a}</p></details>
            ))}
          </div>
          <p className="pc-lede">Something else? Write to <a href={`mailto:${supportEmail()}`}>{supportEmail()}</a>.</p>
        </section>

        <div className="st-cta">
          <div>
            <h2>Start free, upgrade when you&apos;re ready</h2>
            <p>Free for {FREE_CHILDREN}, every setting verified. No card needed.</p>
          </div>
          <StartLink className="lp-btn lp-btn-white" />
        </div>
      </div>
    </>
  );
}
