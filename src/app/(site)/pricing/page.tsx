import type { Metadata } from "next";
import Link from "next/link";
import { Check, ChevronDown, CreditCard, Minus, RefreshCw, Ticket } from "lucide-react";
import { SignedIn, StartLink } from "@/components/signed-in";
import { PLANS, webPrice, type Plan } from "@/lib/plans";
import { pageMetadata } from "@/lib/site";
import { supportEmail } from "@/lib/support";
import { PageHead } from "../page-head";
import "./pricing.css";

export const metadata: Metadata = pageMetadata({
  title: "Pricing: free parental controls, plans in pesos",
  path: "/pricing",
  description: "eGuard is free for one child. eGuard Plus and Family Pro add more children, devices, location sharing and reports. Pay monthly in pesos with GCash, Maya, QR Ph or card.",
});

const LOOK = {
  FREE: { cta: "Start free", style: "lp-btn-soft", featured: false },
  PLUS: { cta: "Get eGuard Plus", style: "lp-btn-primary", featured: true },
  PRO: { cta: "Get Family Pro", style: "lp-btn-outline", featured: false },
} as const;

const pesos = (p: Plan) => {
  if (p.id === "FREE") return "0";
  const c = webPrice(p.id);
  return c % 100 ? (c / 100).toFixed(2) : String(c / 100);
};

type Cell = string | boolean;
/** Comparison rows, read from each plan's entitlements so they always match what the server enforces. */
const ROWS: [string, string | null, (p: Plan) => Cell][] = [
  ["Children", null, (p) => `Up to ${p.entitlements.childLimit}`],
  ["Devices", "Phones, tablets and browsers each count as one", (p) => `Up to ${p.entitlements.deviceLimit}`],
  ["All 10 protections", null, () => true],
  ["Configuration Health and verification", "Every setting checked on the device, on every plan", () => true],
  ["Alerts in the app and by email", null, () => true],
  ["Website and app requests", null, () => true],
  ["Apps you can see and manage", null, (p) => p.entitlements.appMonitoringLimit === null ? "All apps" : `${p.entitlements.appMonitoringLimit} per child`],
  ["Location sharing and history", null, (p) => p.entitlements.locationSharing],
  ["Reports", null, (p) => p.entitlements.advancedReports ? "Today to 30 days, custom ranges, CSV export" : "Today and 7 days"],
  ["Push alerts", "Coming soon", (p) => p.entitlements.realtimeAlerts],
  ["API access for schools and organizations", "API keys for your organization", (p) => p.entitlements.apiAccess],
  ["Support", null, (p) => p.id === "FREE" ? "Email" : p.id === "PLUS" ? "Priority" : "Dedicated"],
];

const FAQS: [string, string][] = [
  ["What counts as a device?", "Each phone, tablet and browser you connect counts as one. A laptop with eGuard in both Chrome and Edge counts as two."],
  ["Is verification included on the Free plan?", "Yes. Every plan checks each protection on the device and shows you Configuration Health. Paying adds capacity and features, not honesty."],
  ["What's the difference between a pass and auto-renew?", "A pass is one month, paid once with GCash, Maya, QR Ph or a card. It never renews; we remind you 3 days before it ends, and buying another adds a month. Auto-renew charges a card or Maya every month until you turn it off."],
  ["What happens if I move to a smaller plan?", "Nothing is removed. Children and devices over the new limit stay protected; you just can't add more until you're under it. If location sharing ends, current locations are cleared and any history is hidden until you upgrade again."],
  ["Can I pay in the app?", "Plans are bought on the web, in Settings › Subscription. Only the family admin can buy or cancel. The app shows your plan as soon as it's paid."],
  ["Do you have plans for schools or organizations?", "Yes. Any parent can create an organization for a school, community group or business, share a join code with families, and buy sponsor codes that pay for families' plans. Family Pro adds API keys, so your own systems can read your codes and counts. Organizations only ever see counts, never a family's data."],
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
        lede="Start free with one child. Upgrade when your family needs more children, devices, location or reports. Every plan verifies every protection."
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
                <ul>{p.features.map((f) => <li key={f.key}><Check />{f.label}</li>)}</ul>
                <SignedIn signedIn={<PlanLink id={p.id} signedIn />} signedOut={<PlanLink id={p.id} signedIn={false} />} />
              </article>
            );
          })}
        </div>

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
              <h3>Monthly pass</h3>
              <p>Pay once for a month. Nothing renews by surprise.</p>
              <ul className="pc-methods"><li>GCash</li><li>Maya</li><li>QR Ph</li><li>Card</li></ul>
              <ul className="pc-points">
                <li><Check />We remind you 3 days before it ends</li>
                <li><Check />Buy another to add a month</li>
              </ul>
            </div>
            <div className="pc-way">
              <i><RefreshCw /></i>
              <h3>Auto-renew</h3>
              <p>Charged every month, so protection never lapses.</p>
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
            <p>One child, every setting verified. No card needed.</p>
          </div>
          <StartLink className="lp-btn lp-btn-white" />
        </div>
      </div>
    </>
  );
}
