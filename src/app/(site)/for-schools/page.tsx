import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, Briefcase, Check, ChevronDown, EyeOff, Gift, GraduationCap, Hash, KeyRound, Landmark, Mail, Share2, X, type LucideIcon,
} from "lucide-react";
import { discountSummary } from "@/lib/batch-discount";
import { CODE_MONTHS, MAX_CODES_PER_BATCH } from "@/lib/organizations";
import { PLANS, webPrice } from "@/lib/plans";
import { pageMetadata } from "@/lib/site";
import { supportEmail } from "@/lib/support";
import { SignedIn } from "@/components/signed-in";
import { PageHead } from "../page-head";
import { SponsorEstimator } from "./estimator";
import "./schools.css";

export const metadata: Metadata = pageMetadata({
  title: "eGuard for schools, barangays and employers",
  path: "/for-schools",
  description: `Invite families with a join code and sponsor their eGuard plans with prepaid codes, ${discountSummary()}. Organizations see counts only, never a family's data.`,
});

const WHO: [LucideIcon, string, string][] = [
  [GraduationCap, "Schools", "Recommend eGuard to parents at orientation or PTA meetings, and sponsor plans for families who need help."],
  [Landmark, "Barangays and community groups", "Fund protection for families in your community, and hand out codes at a seminar or a home visit."],
  [Briefcase, "Employers", "Offer eGuard as a benefit for working parents, OFW families included, without ever seeing their data."],
];

const STEPS: [LucideIcon, string, React.ReactNode][] = [
  [Hash, "Create your organization", <>Free, from any eGuard parent account with a verified email, in Settings › Organizations. Add co-workers as admins by email.</>],
  [Share2, "Share your join code", <>Families enter your code to join. They can leave whenever they like, and joining never shares anything about them.</>],
  [Gift, "Sponsor plans, if you'd like", <>Buy a batch of sponsor codes: eGuard Plus or eGuard Family, for 1, 3, 6 or 12 months. Pay once with GCash, Maya, QR Ph or a card.</>],
  [KeyRound, "Hand out codes, see the counts", <>A family redeems a code in Settings › Subscription and gets the plan straight away. You see which codes are used and how many families joined.</>],
];

const SEES = ["How many families joined", "Which sponsor codes have been redeemed", "Your batches, payments and receipts"];
const NEVER = ["Families' names or email addresses", "Children, devices or settings", "Screen time, apps, alerts or locations", "Who redeemed which code"];

/** From docs/organizations.md (rules and limits, how codes become a plan) */
const FAQS: [string, React.ReactNode][] = [
  ["Do families pay anything?", <>Not for the months a code covers. Every family can also use eGuard&apos;s Free plan on its own, sponsored or not.</>],
  ["What happens when a sponsored plan ends?", <>The family gets a reminder 3 days before. Then they move to the Free plan unless they buy their own, or you give them another code. Their children and devices stay protected; <Link href="/pricing#pc-faq">see what changes on a smaller plan</Link>.</>],
  ["What if a family already pays for eGuard?", <>A code for the plan they already have adds its months on the end. They can&apos;t redeem a code for a different plan while paid time is left, or while auto-renew or Google Play billing is on.</>],
  ["Do unused codes expire?", <>Codes can be redeemed for 12 months after you buy them. You can see each code&apos;s status, download them as a list, and cancel one that hasn&apos;t been used.</>],
  ["Can our own systems read the numbers?", <>Yes, on eGuard Family: organization admins can create API keys that read your codes, batches and counts, never a family&apos;s data.</>],
  ["How much does it cost to set up?", <>Nothing. Creating an organization and sharing a join code is free. You only pay for sponsor codes, if you buy any.</>],
];

export default function ForSchoolsPage() {
  const plus = webPrice("PLUS");
  const email = supportEmail();
  const contact = `mailto:${email}?subject=${encodeURIComponent("eGuard for our organization")}`;
  return (
    <>
      <PageHead
        eyebrow="For schools and organizations"
        title={<>Help every family you serve <span className="lp-accent">set up protection</span></>}
        lede="Schools, barangays, community groups and employers use eGuard to bring parental controls to the families they work with: invite them with a code, and sponsor their plans if you want to. You'll see how many families joined, never what's in their accounts."
      >
        <div className="sc-actions">
          <SignedIn
            signedIn={<Link href="/settings/organizations" className="lp-btn lp-btn-primary">Create an organization<ArrowRight /></Link>}
            signedOut={<Link href="/register" className="lp-btn lp-btn-primary">Create a free account<ArrowRight /></Link>}
          />
          <a href={contact} className="lp-btn lp-btn-outline"><Mail />Talk to us</a>
        </div>
        <ul className="sc-facts">
          <li><b>Free</b> to create and invite families</li>
          <li><b>Counts only</b>, never a family&apos;s data</li>
          <li>Sponsor from <b className="num">{peso(plus)}</b> a family a month</li>
        </ul>
      </PageHead>

      <div className="lp-wrap st-about">
        <div className="st-block">
          <h2>Who it&apos;s for</h2>
          <ul className="st-values">
            {WHO.map(([Ico, title, body]) => <li key={title}><i><Ico /></i><h3>{title}</h3><p>{body}</p></li>)}
          </ul>
        </div>

        <div className="st-block">
          <h2>How it works</h2>
          <ol className="sc-steps">
            {STEPS.map(([Ico, title, body], i) => (
              <li key={title}>
                <div className="sc-step-top"><i><Ico /></i><span className="sc-num">{i + 1}</span></div>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="st-block" id="cost">
          <h2>What would sponsoring cost?</h2>
          <p>Each sponsor code is a prepaid plan for one family. It costs the plan&apos;s monthly price for each month it covers, {discountSummary()}.</p>
          <SponsorEstimator
            plans={PLANS.filter((p) => p.id !== "FREE").map((p) => ({ id: p.id, name: p.name, monthly: webPrice(p.id as "PLUS" | "PRO") }))}
            months={CODE_MONTHS}
            maxCodes={MAX_CODES_PER_BATCH}
          />
        </div>

        <div className="st-block">
          <h2>Families keep their privacy</h2>
          <p>Each family keeps its own account and its own data. That&apos;s good for them, and it keeps your organization clear of handling children&apos;s data under the Data Privacy Act. See <Link href="/security">how eGuard protects data</Link>.</p>
          <div className="sc-privacy">
            <div className="sc-priv sees">
              <h3><i><Check /></i>What your organization sees</h3>
              <ul>{SEES.map((s) => <li key={s}><Check />{s}</li>)}</ul>
            </div>
            <div className="sc-priv never">
              <h3><i><EyeOff /></i>What it never sees</h3>
              <ul>{NEVER.map((s) => <li key={s}><X />{s}</li>)}</ul>
            </div>
          </div>
        </div>

        <div className="st-block">
          <h2>Questions organizers ask</h2>
          <div className="lp-faq-list sc-faq">
            {FAQS.map(([q, a]) => <details key={q} name="sc-faq"><summary>{q}<ChevronDown /></summary><p>{a}</p></details>)}
          </div>
        </div>

        <div className="st-cta">
          <div>
            <h2>Start your organization today</h2>
            <p>Free to create. Planning a program or a large batch? <a href={contact}>Write to {email}</a>.</p>
          </div>
          <SignedIn
            signedIn={<Link href="/settings/organizations" className="lp-btn lp-btn-white">Create an organization<ArrowRight /></Link>}
            signedOut={<Link href="/register" className="lp-btn lp-btn-white">Create a free account<ArrowRight /></Link>}
          />
        </div>
      </div>
    </>
  );
}

const peso = (centavos: number) => `₱${centavos % 100 ? (centavos / 100).toFixed(2) : centavos / 100}`;
