import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import {
  ArrowRight, BellRing, CalendarClock, ChartNoAxesColumnIncreasing, Check, ChevronDown, ChevronRight, CircleCheck,
  ClipboardCheck, Laptop, Menu, Plus, Settings, ShieldCheck, Smartphone, Sparkles, Star, Tablet, Users, type LucideIcon,
} from "lucide-react";
import { getUser } from "@/lib/auth";
import { PLANS as PLAN_CATALOG, webPrice } from "@/lib/plans";
import { LogoMark } from "@/components/logo";
import { PhoneDashboard, PhoneScreenTime } from "@/components/landing-phones";
import "./landing.css";

import heroBackground from "../../public/landing/hero-background.jpg";
import heroFamily from "../../public/landing/hero-family.jpg";
import digitalHabits from "../../public/landing/digital-habits.jpg";
import familySunset from "../../public/landing/family-sunset.jpg";
import ctaFamily from "../../public/landing/cta-family.jpg";
import appStore from "../../public/landing/app-store.png";
import googlePlay from "../../public/landing/google-play.png";
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

export const metadata: Metadata = {
  title: { absolute: "eGuard · A Safer Digital World for Their Brighter Tomorrow" },
  description: "eGuard helps parents configure, manage, and verify digital safety protections for their children's devices, all in one place.",
};

const NAV = [
  ["Features", "#features"], ["How It Works", "#how-it-works"], ["For Parents", "#habits"],
  ["For Schools", "#communities"], ["Pricing", "#pricing"], ["Resources", "#faq"],
] as const;

const AVATARS = [avatar1, avatar2, avatar3];

const AUDIENCES: [StaticImageData, string, string][] = [
  [iconFamily, "Families", "Everyday parents"],
  [iconSchool, "Schools", "Educational institutions"],
  [iconCommunity, "Communities", "Local organizations"],
  [iconBusiness, "Businesses", "Workforce families"],
];

const FEATURES: [StaticImageData, string, string][] = [
  [iconGuidedSetup, "Guided Setup", "Step-by-step setup for Android and iOS"],
  [iconProtection, "Configuration Health", "Verify if protections are correctly applied"],
  [iconScreenTime, "Screen Time Management", "Set healthy device limits"],
  [iconApps, "App & Content Controls", "Manage and approve apps"],
  [iconLocation, "Location Guidance", "Set up location sharing with confidence"],
  [iconAlerts, "Real-time Alerts", "Get notified when settings change"],
];

const HABITS: [LucideIcon, string, string, string][] = [
  [CalendarClock, "lp-t-blue", "Encourage balance", "Set daily limits and bedtime schedules."],
  [ShieldCheck, "lp-t-blue", "Reduce distractions", "Manage apps and content access."],
  [Sparkles, "lp-t-purple", "Support real-world activities", "Help them focus on learning, family, and play."],
];

const STEPS: [LucideIcon, string, string][] = [
  [Smartphone, "Create Your Account", "Set up your family and add your children."],
  [Settings, "Configure Protection", "Follow our guided setup for Android and iOS."],
  [ShieldCheck, "Verify & Monitor", "Check configuration health and get real-time alerts."],
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

const FAQS = [
  ["How does eGuard work?",
    "You create a family account, add your children and their devices, then follow guided steps to switch on the protections you choose. eGuard keeps checking that each protection is still applied and alerts you if something changes."],
  ["Is eGuard available for both Android and iOS?",
    "Yes. eGuard supports Android and iOS devices. Where a platform lets eGuard apply a setting directly it does; where it doesn't, you get a step-by-step guide and eGuard verifies the result."],
  ["Do you have a free plan?",
    "Yes. The Free plan covers one child with basic protection setup, screen time management and limited app monitoring. You can upgrade whenever your family needs more."],
  ["How is my family's data protected?",
    "eGuard only collects what it needs to verify your protections, and it does not sell your children's data. You can export or delete your account data at any time from Settings."],
  ["Can schools or organizations use eGuard?",
    "Yes. Schools, communities and employers use eGuard to promote healthier digital habits. The Family Pro plan includes API access for schools and organizations."],
] as const;

const SOCIAL = [
  ["Facebook", "M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.62 23.1 24 18.1 24 12.07"],
  ["X", "M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.6l5.24 6.93zm-1.29 19.5h2.04L6.49 3.24H4.3z"],
  ["YouTube", "M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.87.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81M9.55 15.57V8.43L15.82 12z"],
  ["LinkedIn", "M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13M7.12 20.45H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0"],
] as const;

function PlayDot() {
  return <span className="lp-play"><svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0v12l10-6z" fill="currentColor" /></svg></span>;
}

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

function Stores() {
  return (
    <div className="lp-stores">
      <small>Available on iOS and Android</small>
      <div>
        <a href="#" aria-label="Download on the App Store"><Image src={appStore} alt="Download on the App Store" style={{ height: 46, width: "auto" }} /></a>
        <a href="#" aria-label="Get it on Google Play"><Image src={googlePlay} alt="Get it on Google Play" style={{ height: 46, width: "auto" }} /></a>
      </div>
    </div>
  );
}

export default async function Home() {
  const signedIn = Boolean(await getUser());
  const start = signedIn ? "/dashboard" : "/register";

  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-wrap">
          <Link href="/" className="lp-brand" aria-label="eGuard home">
            <LogoMark size={44} />
            <span><b>eGuard</b><small>Digital Safety for Brighter Tomorrows</small></span>
          </Link>
          <nav className="lp-nav" aria-label="Primary">
            {NAV.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
          </nav>
          <div className="lp-head-cta">
            {signedIn ? (
              <Link href="/dashboard" className="lp-btn lp-btn-primary">Open Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="lp-btn lp-signin">Sign In</Link>
                <Link href="/register" className="lp-btn lp-btn-primary">Get Started</Link>
              </>
            )}
            <details className="lp-menu">
              <summary aria-label="Open menu"><Menu /></summary>
              <nav className="lp-menu-panel" aria-label="Mobile">
                {NAV.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
                {signedIn ? null : <Link href="/login">Sign In</Link>}
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="lp-hero">
          <div className="lp-hero-bg"><Image src={heroBackground} alt="" fill preload sizes="100vw" /></div>
          <div className="lp-wrap">
            <div className="lp-hero-copy">
              <span className="lp-eyebrow"><Users />Trusted by modern families</span>
              <h1>A Safer Digital World for Their <span className="lp-accent">Brighter Tomorrow</span></h1>
              <p className="lp-hero-lede">eGuard helps parents configure, manage, and verify digital safety protections for their children&apos;s devices — all in one place.</p>
              <ul className="lp-checks">
                <li><CircleCheck />Easy setup and configuration</li>
                <li><ShieldCheck />Verified protection</li>
                <li><BellRing />Real-time alerts</li>
                <li><CircleCheck />Peace of mind</li>
              </ul>
              <div className="lp-hero-actions">
                <Link href={start} className="lp-btn lp-btn-primary">{signedIn ? "Open Dashboard" : "Get Started Free"}<ArrowRight /></Link>
                <a href="#how-it-works" className="lp-btn lp-btn-outline"><PlayDot />Watch Video</a>
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
                  <div className="lp-hc-title">Trusted by families</div>
                  <div className="lp-hc-sub">for a safer digital tomorrow.</div>
                  <div className="lp-stars" aria-label="Rated 4.8 out of 5">
                    {[0, 1, 2, 3, 4].map((i) => <Star key={i} />)}
                    <b>4.8</b>&nbsp;(2.5K+ reviews)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Trusted by ---------- */}
        <section className="lp-trust" id="communities">
          <div className="lp-wrap">
            <div>
              <h2>Trusted by Parents,<br />Supported by Communities</h2>
              <p>Families, schools, and organizations choose eGuard to promote safer and healthier digital habits.</p>
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
              <p>Join thousands of parents who trust eGuard.</p>
              <div className="lp-hero-actions">
                <Link href={start} className="lp-btn lp-btn-white">{signedIn ? "Open Dashboard" : "Get Started Free"}<ArrowRight /></Link>
                <a href="#how-it-works" className="lp-btn lp-btn-ghost-light"><PlayDot />Watch Video</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-foot-grid">
            <Link href="/" className="lp-brand" aria-label="eGuard home" style={{ alignSelf: "start" }}>
              <LogoMark size={44} />
              <span><b>eGuard</b><small>Digital Safety for Brighter Tomorrows</small></span>
            </Link>
            <div>
              <h4>Product</h4>
              <ul><li><a href="#features">Features</a></li><li><a href="#pricing">Pricing</a></li><li><a href="#">Download App</a></li></ul>
            </div>
            <div>
              <h4>Resources</h4>
              <ul><li><a href="#">Blog</a></li><li><a href="#faq">Help Center</a></li><li><a href="#how-it-works">Guides</a></li></ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul><li><a href="#">About</a></li><li><a href="#">Privacy</a></li><li><a href="#">Terms</a></li></ul>
            </div>
            <div>
              <h4>Stay Updated</h4>
              <p>Get the latest tips and updates.</p>
              <div className="lp-sub">
                <form action="/register">
                  <label htmlFor="lp-email" className="sr-only">Email address</label>
                  <input id="lp-email" name="email" type="email" placeholder="Enter your email" autoComplete="email" required />
                  <button type="submit" aria-label="Subscribe"><ArrowRight /></button>
                </form>
                <div className="lp-social">
                  {SOCIAL.map(([name, d]) => (
                    <a key={name} href="#" aria-label={`eGuard on ${name}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg></a>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="lp-foot-bottom">
            <span>© {new Date().getFullYear()} eGuard. All rights reserved.</span>
            <span>A safer digital world for their brighter tomorrow.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
