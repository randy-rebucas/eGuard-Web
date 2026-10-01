import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import {
  ArrowRight, BellRing, CalendarClock, ChartNoAxesColumnIncreasing, Check, ChevronDown, ChevronRight, CircleCheck,
  ClipboardCheck, Download, Globe, Laptop, Plus, Settings, ShieldCheck, Smartphone, Sparkles, Tablet, Users, type LucideIcon,
} from "lucide-react";
import { getUser } from "@/lib/auth";
import { LEGAL } from "@/lib/legal";
import { supportEmail } from "@/lib/support";
import { PLANS as PLAN_CATALOG, webPrice } from "@/lib/plans";
import { jsonLd, pageMetadata, siteUrl } from "@/lib/site";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { PhoneDashboard, PhoneScreenTime } from "@/components/landing-phones";
import { ChromeMark, EdgeMark, FirefoxMark, STORE_LINKS } from "@/components/brand-marks";
import "./landing.css";

import heroBackground from "../../public/landing/hero-background.jpg";
import heroFamily from "../../public/landing/hero-family.jpg";
import digitalHabits from "../../public/landing/digital-habits.jpg";
import familySunset from "../../public/landing/family-sunset.jpg";
import ctaFamily from "../../public/landing/cta-family.jpg";
import avatar1 from "../../public/landing/avatar-1.png";
import avatar2 from "../../public/landing/avatar-2.png";
import avatar3 from "../../public/landing/avatar-3.png";
import iconFamily from "../../public/landing/icon-family.png";
import iconSchool from "../../public/landing/icon-school.png";
import iconCommunity from "../../public/landing/icon-community.png";
import iconBusiness from "../../public/landing/icon-business.png";
import iconGuidedSetup from "../../public/landing/icon-guided-setup.png";
import iconProtection from "../../public/landing/icon-protection.png";
import iconScreenTime from "../../public/landing/icon-screen-time.png";
import iconApps from "../../public/landing/icon-apps.png";
import iconLocation from "../../public/landing/icon-location.png";
import iconAlerts from "../../public/landing/icon-alerts.png";

export const metadata: Metadata = pageMetadata({
  title: "eGuard · Parental controls you can verify, for families in the Philippines",
  absoluteTitle: true,
  path: "/",
  description: `Set screen time, bedtime, app and web rules on your child's Android phone or tablet, and see each one confirmed on the device. Free for 1 child; plans from ₱${webPrice("PLUS") / 100} a month.`,
  share: {
    title: "eGuard: parental controls you can verify",
    description: "Set screen time, bedtime and app rules on your child's phone, and see each one confirmed on the device. Free for 1 child.",
  },
});

const AVATARS = [avatar1, avatar2, avatar3];

const AUDIENCES: [StaticImageData, string, string][] = [
  [iconFamily, "Families", "Everyday parents"],
  [iconSchool, "Schools", "Educational institutions"],
  [iconCommunity, "Communities", "Local organizations"],
  [iconBusiness, "Businesses", "Workforce families"],
];

const FEATURES: [StaticImageData, string, string][] = [
  [iconGuidedSetup, "Guided Setup", "Step-by-step setup for Android, with iPhone coming soon"],
  [iconProtection, "Configuration Health", "Verify if protections are correctly applied"],
  [iconScreenTime, "Screen Time Management", "Set healthy device limits"],
  [iconApps, "App & Content Controls", "Manage and approve apps"],
  [iconLocation, "Location Guidance", "Set up location sharing with confidence"],
  // Alert emails go out with the maintenance run (every few minutes), so not "instant"
  [iconAlerts, "Alerts", "Email and in-app alerts when settings change"],
];

const HABITS: [LucideIcon, string, string, string][] = [
  [CalendarClock, "lp-t-blue", "Encourage balance", "Set daily limits and bedtime schedules."],
  [ShieldCheck, "lp-t-blue", "Reduce distractions", "Manage apps and content access."],
  [Sparkles, "lp-t-purple", "Support real-world activities", "Help them focus on learning, family, and play."],
];

const STEPS: [LucideIcon, string, string][] = [
  [Smartphone, "Create Your Account", "Set up your family and add your children."],
  [Settings, "Configure Protection", "Follow our guided setup for Android, with iPhone coming soon."],
  [ShieldCheck, "Verify & Monitor", "Check configuration health and get alerts when something changes."],
  [ChartNoAxesColumnIncreasing, "Build Healthy Habits", "Manage screen time, apps, and location settings."],
];

/** Names, perks and prices come from the plan catalogue, so this page always matches what's sold. */
const PLAN_LOOK = {
  FREE: { cta: "Get Started", style: "lp-btn-soft", featured: false },
  PLUS: { cta: "Get eGuard Plus", style: "lp-btn-primary", featured: true },
  PRO: { cta: "Get Family Pro", style: "lp-btn-outline", featured: false },
} as const;
const pesos = (centavos: number) => (centavos % 100 ? (centavos / 100).toFixed(2) : String(centavos / 100));
const PLANS = PLAN_CATALOG.map((p) => ({
  name: p.name, blurb: p.blurb, price: p.id === "FREE" ? "0" : pesos(webPrice(p.id)),
  perks: p.features.map((f) => f.label), ...PLAN_LOOK[p.id],
}));

/** Search engines' view of eGuard: who publishes it and what it costs. No aggregateRating until there are real reviews. */
function structuredData() {
  const site = siteUrl();
  const org = `${site}/#org`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": org, name: "eGuard", url: site, logo: `${site}/brand/logo-mark-512.png`,
        parentOrganization: { "@type": "Organization", name: LEGAL.entity },
        contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: supportEmail(), areaServed: "PH", availableLanguage: "en" } },
      { "@type": "WebSite", "@id": `${site}/#website`, name: "eGuard", url: site, inLanguage: "en-PH", publisher: { "@id": org } },
      { "@type": "WebApplication", name: "eGuard", url: site, applicationCategory: "LifestyleApplication", operatingSystem: "Web, Android", installUrl: PLAY_STORE_URL,
        description: "Parental controls for screen time, bedtime, apps, web and location, with every setting verified on the child's device.",
        publisher: { "@id": org },
        offers: PLANS.map((p) => ({ "@type": "Offer", name: p.name, price: p.price, priceCurrency: "PHP", url: `${site}/#pricing` })) },
    ],
  };
}

const FAQS = [
  ["How does eGuard work?",
    "You create a family account, add your children and their devices, then follow guided steps to switch on the protections you choose. eGuard keeps checking that each protection is still applied and alerts you if something changes."],
  ["Is eGuard available for both Android and iOS?",
    "The Android app is available now on Google Play, and the iOS app is coming soon to the App Store. Where a platform lets eGuard apply a setting directly it does; where it doesn't, you get a step-by-step guide and eGuard verifies the result."],
  ["Do you have a free plan?",
    "Yes. The Free plan covers one child with basic protection setup, screen time management and limited app monitoring. You can upgrade whenever your family needs more."],
  ["How is my family's data protected?",
    "eGuard only collects what it needs to verify your protections, and it does not sell your children's data. You can export or delete your account data at any time from Settings."],
  ["Can schools or organizations use eGuard?",
    "Yes. eGuard is built for schools, communities and employers as well as families. The Family Pro plan includes API access for schools and organizations."],
] as const;

const BROWSERS = [
  { name: "Chrome", Mark: ChromeMark, store: "Chrome Web Store", cta: "Add to Chrome", href: STORE_LINKS.chrome },
  { name: "Microsoft Edge", Mark: EdgeMark, store: "Microsoft Edge Add-ons", cta: "Add to Edge", href: STORE_LINKS.edge },
  // Still in Firefox Add-ons review: shown blurred, with no link, until it's published.
  { name: "Firefox", Mark: FirefoxMark, store: "Firefox Add-ons", cta: "Coming soon", href: STORE_LINKS.firefox },
] as const;

const BROWSER_PERKS = ["Blocks harmful sites and categories", "Forces SafeSearch", "Lets your child ask before opening a blocked site"];

function PlayDot() {
  return <span className="lp-play"><svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0v12l10-6z" fill="currentColor" /></svg></span>;
}

/** The shield on the hero's Family Protection card. */
function Shield() {
  return (
    <svg width="46" height="52" viewBox="0 0 46 52" aria-hidden="true">
      <defs>
        <linearGradient id="lp-shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5BC2FF" /><stop offset="1" stopColor="#1463E0" />
        </linearGradient>
      </defs>
      <path d="M23 2C17 5.3 10.4 7.2 3.5 8v14.5C3.5 35 11.7 44.4 23 49c11.3-4.6 19.5-14 19.5-26.5V8C35.6 7.2 29 5.3 23 2Z" fill="url(#lp-shield)" />
      <path d="m14.5 25.5 6 6 11-12" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Avatars() {
  return <div className="lp-avatars">{AVATARS.map((a, i) => <Image key={i} src={a} alt="" width={40} height={40} />)}</div>;
}

const PLAY_STORE_URL = STORE_LINKS.googlePlay;

/** Android is live on Google Play; the App Store badge stays disabled until the iOS app is published. */
function Stores() {
  return (
    <div className="lp-stores">
      <a className="lp-btn lp-btn-app" href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#00D7FE" d="M3.6 2.2c-.2.3-.4.7-.4 1.2v17.2c0 .5.2.9.4 1.2L13.3 12z" />
          <path fill="#FFCE00" d="M16.6 15.3 13.3 12l3.3-3.3 4 2.3c1.1.6 1.1 1.7 0 2.3z" />
          <path fill="#FF3A44" d="M16.6 15.3 13.3 12l-9.7 9.8c.4.4 1 .4 1.7 0z" />
          <path fill="#00F076" d="M16.6 8.7 5.3 2.2c-.7-.4-1.3-.4-1.7 0L13.3 12z" />
        </svg>
        Download the Android App<Download />
      </a>
      <span className="lp-stores-off" aria-disabled="true"><Smartphone />iOS coming soon</span>
    </div>
  );
}

export default async function Home() {
  const signedIn = Boolean(await getUser());
  const start = signedIn ? "/dashboard" : "/register";

  return (
    <div className="lp">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structuredData())} />
      <SiteHeader signedIn={signedIn} />

      <main>
        {/* ---------- Hero ---------- */}
        <section className="lp-hero">
          <div className="lp-hero-bg"><Image src={heroBackground} alt="" fill preload sizes="100vw" /></div>
          <div className="lp-wrap">
            <div className="lp-hero-copy">
              <span className="lp-eyebrow"><Users />Built for modern families</span>
              <h1>A Safer Digital World for Their <span className="lp-accent">Brighter Tomorrow</span></h1>
              <p className="lp-hero-lede">eGuard helps parents configure, manage, and verify digital safety protections for their children&apos;s devices — all in one place.</p>
              <ul className="lp-checks">
                <li><CircleCheck />Easy setup and configuration</li>
                <li><ShieldCheck />Verified protection</li>
                <li><BellRing />Email alerts when something changes</li>
                <li><CircleCheck />Peace of mind</li>
              </ul>
              <div className="lp-hero-actions">
                <Link href={start} className="lp-btn lp-btn-primary">{signedIn ? "Open Dashboard" : "Get Started Free"}<ArrowRight /></Link>
                <a href="#how-it-works" className="lp-btn lp-btn-outline"><PlayDot />See How It Works</a>
              </div>
              <Stores />
            </div>

            <div className="lp-hero-family"><Image src={heroFamily} alt="A smiling family looking at a tablet together" fill preload sizes="(max-width:1024px) 100vw, 64vw" /></div>

            <div className="lp-hero-cards">
              <div className="lp-float lp-hc lp-hc-protect">
                <div className="lp-hc-row">
                  <Shield />
                  <div>
                    <div className="lp-hc-title">Family Protection</div>
                    <div className="lp-hc-big num">8 / 10</div>
                    <div className="lp-hc-ok">Good Protection</div>
                  </div>
                </div>
                <div className="lp-meter" role="img" aria-label="Protection score 8 out of 10"><span /></div>
              </div>

              <div className="lp-float lp-hc lp-hc-children">
                <div className="lp-hc-row"><Avatars /><span className="lp-plus"><Plus /></span></div>
                <div className="lp-hc-row" style={{ marginTop: 10 }}>
                  <div><div className="lp-hc-title">3 Children</div><div className="lp-hc-sub">Protected</div></div>
                  <ChevronRight className="lucide lp-chev" />
                </div>
              </div>

              <div className="lp-float lp-hc lp-hc-devices">
                <div className="lp-hc-row">
                  <Smartphone className="lucide lp-dev-big" />
                  <div><div className="lp-hc-title">5 Devices</div><div className="lp-hc-sub">Connected</div></div>
                </div>
                <div className="lp-dev-row">
                  <Smartphone /><Tablet /><Laptop style={{ width: 30, height: 30 }} />
                  <span className="lp-chev-btn"><ChevronRight /></span>
                </div>
              </div>

              <div className="lp-float lp-hc lp-hc-trust">
                <Avatars />
                <div>
                  <div className="lp-hc-title">Free for 1 child</div>
                  <div className="lp-hc-sub">No card needed. Upgrade any time.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Trusted by ---------- */}
        <section className="lp-trust" id="communities">
          <div className="lp-wrap">
            <div>
              <h2>Built for Families, Schools<br />and Communities</h2>
              <p>eGuard helps families, schools, and organizations promote safer and healthier digital habits.</p>
            </div>
            <ul className="lp-audiences">
              {AUDIENCES.map(([icon, title, sub]) => (
                <li key={title}><Image src={icon} alt="" width={84} height={84} /><b>{title}</b><span>{sub}</span></li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section className="lp-features" id="features">
          <div className="lp-wrap">
            <div>
              <div className="lp-section-head">
                <h2>Everything You Need<br />for Your Child&apos;s Digital Safety</h2>
                <p>From setup to ongoing verification, eGuard makes it simple for parents to keep their children&apos;s devices properly protected.</p>
              </div>
              <div className="lp-feature-grid">
                {FEATURES.map(([icon, title, body]) => (
                  <article key={title} className="lp-feature">
                    <Image src={icon} alt="" width={60} height={60} />
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
              <Link href="/protections" className="lp-btn lp-btn-outline lp-how-more">See all 10 protections<ArrowRight /></Link>
            </div>
            <div className="lp-phones" role="region" aria-label="eGuard app screens" tabIndex={0}>
              <PhoneDashboard />
              <PhoneScreenTime />
            </div>
          </div>
        </section>

        {/* ---------- Healthy habits ---------- */}
        <section className="lp-habits" id="habits">
          <div className="lp-habits-img"><Image src={digitalHabits} alt="A mother and daughter using a laptop together" fill sizes="(max-width:1024px) 100vw, 62vw" /></div>
          <div className="lp-wrap">
            <div className="lp-habits-copy">
              <div className="lp-habits-tag"><i><span><ClipboardCheck /></span></i>Healthy digital habits</div>
              <h2>Build Healthier<br />Digital Habits</h2>
              <p>eGuard helps you set balanced screen time, manage apps, and create healthy routines — so your children can enjoy technology safely while focusing on what matters most.</p>
              <ul className="lp-habit-list">
                {HABITS.map(([Ico, tone, title, body]) => (
                  <li key={title}><i className={tone}><Ico /></i><div><b>{title}</b><span>{body}</span></div></li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="lp-how" id="how-it-works">
          <div className="lp-wrap">
            <h2>How eGuard Works</h2>
            <p>Get started in minutes and guide your family to a safer digital experience.</p>
            <ol className="lp-steps">
              {STEPS.map(([Ico, title, body], i) => (
                <li key={title} className="lp-step">
                  <div className="lp-step-top"><span className="lp-step-num">{i + 1}</span><span className="lp-step-ico"><Ico /></span></div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </li>
              ))}
            </ol>
            <Link href="/how-it-works" className="lp-btn lp-btn-outline lp-how-more">See the full walkthrough<ArrowRight /></Link>
          </div>
        </section>

        {/* ---------- Browser extension ---------- */}
        <section className="lp-browsers" id="browsers">
          <div className="lp-wrap">
            <div className="lp-browsers-head">
              <span className="lp-eyebrow"><Globe />Browser protection</span>
              <h2>Protect Their Browser Too</h2>
              <p>Add the eGuard Browser Protection extension to your child&apos;s computer. The rules you choose in eGuard reach the browser within 5 minutes.</p>
              <ul className="lp-browser-perks">{BROWSER_PERKS.map((perk) => <li key={perk}><Check />{perk}</li>)}</ul>
            </div>
            <ul className="lp-browser-grid">
              {BROWSERS.map(({ name, Mark, store, cta, href }) => href ? (
                <li key={name} className="lp-browser">
                  <span className="lp-browser-mark"><Mark /></span>
                  <h3>{name}</h3>
                  <p>{store}</p>
                  <a className="lp-btn lp-btn-outline" href={href} target="_blank" rel="noopener noreferrer">{cta}<ArrowRight /></a>
                </li>
              ) : (
                <li key={name} className="lp-browser lp-browser-soon">
                  <span className="lp-browser-soon-badge">Coming soon</span>
                  <div className="lp-browser-blur" aria-hidden="true">
                    <span className="lp-browser-mark"><Mark /></span>
                    <h3>{name}</h3>
                    <p>{store}</p>
                    <span className="lp-btn lp-btn-soft">{cta}</span>
                  </div>
                  <span className="sr-only">{name}: coming soon</span>
                </li>
              ))}
            </ul>
            <p className="lp-browsers-note">After installing, open your eGuard dashboard and choose <b>Add a browser</b> to get the code that connects it to your child.</p>
          </div>
        </section>

        {/* ---------- Purpose ---------- */}
        <section className="lp-purpose">
          <div className="lp-purpose-img"><Image src={familySunset} alt="A family sitting together looking out over mountains at sunset" fill sizes="100vw" /></div>
          <div className="lp-wrap">
            <div className="lp-float lp-purpose-card">
              <span className="lp-eyebrow"><Users />Our purpose</span>
              <h2>A Safer, Brighter Tomorrow for Every Child</h2>
              <p>We believe technology should open opportunities, not create risks. eGuard empowers parents, schools, and communities to work together for a safer, healthier digital future.</p>
            </div>
          </div>
        </section>

        {/* ---------- Pricing ---------- */}
        <section className="lp-pricing" id="pricing">
          <div className="lp-wrap">
            <span className="lp-eyebrow"><Users />Flexible for every family</span>
            <h2>Simple and Transparent Pricing</h2>
            <p>Choose the plan that fits your family&apos;s needs.</p>
            <div className="lp-plans">
              {PLANS.map((p) => (
                <article key={p.name} className={`lp-plan${p.featured ? " featured" : ""}`}>
                  {p.featured ? <span className="lp-plan-badge">Most Popular</span> : null}
                  <h3>{p.name}</h3>
                  <p>{p.blurb}</p>
                  <div className="lp-price"><b className="num"><sup>₱</sup>{p.price}</b><span>/ month</span></div>
                  <ul>{p.perks.map((perk) => <li key={perk}><Check />{perk}</li>)}</ul>
                  <Link href={start} className={`lp-btn ${p.style}`}>{p.cta}</Link>
                </article>
              ))}
            </div>
            <Link href="/pricing" className="lp-btn lp-btn-outline lp-how-more">Compare plans and ways to pay<ArrowRight /></Link>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="lp-faq" id="faq">
          <div className="lp-wrap">
            <div className="lp-faq-head">
              <span className="lp-eyebrow"><Users />Frequently asked questions</span>
              <h2>Got Questions?</h2>
              <p>Here are some of the most common questions about eGuard.</p>
            </div>
            <div className="lp-faq-list">
              {FAQS.map(([q, a]) => (
                <details key={q} name="lp-faq">
                  <summary>{q}<ChevronDown /></summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="lp-cta">
          <div className="lp-wrap">
            <div className="lp-cta-box">
              <div className="lp-cta-img"><Image src={ctaFamily} alt="" fill sizes="(max-width:1024px) 100vw, 56vw" /></div>
              <h2>Ready to Create a Safer Digital World for Your Family?</h2>
              <p>Free for one child. No card needed.</p>
              <div className="lp-hero-actions">
                <Link href={start} className="lp-btn lp-btn-white">{signedIn ? "Open Dashboard" : "Get Started Free"}<ArrowRight /></Link>
                <a href="#how-it-works" className="lp-btn lp-btn-ghost-light"><PlayDot />See How It Works</a>
              </div>
              <Stores />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
