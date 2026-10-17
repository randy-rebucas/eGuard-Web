import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, BellRing, BookOpen, CalendarClock, ChartNoAxesColumnIncreasing, Check, ChevronDown, ChevronRight, CircleCheck,
  CircleDashed, ClipboardCheck, Download, Globe, Laptop, Plus, Settings, ShieldCheck, Smartphone, Sparkles, Tablet, Users,
  type LucideIcon,
} from "lucide-react";
import { LEGAL } from "@/lib/legal";
import { supportEmail } from "@/lib/support";
import { FREE_CHILDREN, PLANS as PLAN_CATALOG, webPrice } from "@/lib/plans";
import { AGE_GUIDES } from "@/lib/age-guides";
import { profileConfig, recommendedProfile } from "@/lib/profiles";
import { describeSuggested } from "@/lib/protection-pages";
import { ARTICLES, articleBySlug } from "@/lib/learn";
import { SETUP_VIDEO } from "@/lib/setup-video";
import { MADE_IN, proof } from "@/lib/social-proof";
import { jsonLd, pageMetadata, siteUrl } from "@/lib/site";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { MetaPixel } from "@/components/meta-pixel";
import { SignedIn, StartLink } from "@/components/signed-in";
import { PhoneDashboard, PhoneScreenTime } from "@/components/landing-phones";
import { ChromeMark, EdgeMark, FirefoxMark, SOCIAL_LINKS, STORE_LINKS } from "@/components/brand-marks";
import { AudienceIcon, FeatureIcon, type Audience, type Feature } from "@/components/landing-icons";
import "./landing.css";

import heroBackground from "../../public/landing/hero-background.jpg";
import heroFamily from "../../public/landing/hero-family.jpg";
import digitalHabits from "../../public/landing/digital-habits.jpg";
import ctaFamily from "../../public/landing/cta-family.jpg";
import avatar1 from "../../public/landing/avatar-1.png";
import avatar2 from "../../public/landing/avatar-2.png";
import avatar3 from "../../public/landing/avatar-3.png";

export const metadata: Metadata = pageMetadata({
  title: "eGuard · Parental controls you can verify, for families in the Philippines",
  absoluteTitle: true,
  path: "/",
  description: `Set screen time, bedtime, app and web rules on your child's Android phone or tablet, and see each one confirmed on the device. Free for ${FREE_CHILDREN}; plans from ₱${webPrice("PLUS") / 100} a month.`,
  share: {
    title: "eGuard: parental controls you can verify",
    description: `Set screen time, bedtime and app rules on your child's phone, and see each one confirmed on the device. Free for ${FREE_CHILDREN}.`,
  },
});

const AVATARS = [avatar1, avatar2, avatar3];

const AUDIENCES: [Audience, string, string][] = [
  ["family", "Families", "Everyday parents"],
  ["school", "Schools", "Educational institutions"],
  ["community", "Communities", "Local organizations"],
  ["business", "Businesses", "Workforce families"],
];

/** Each card links to the page that explains it in full. */
const FEATURES: [Feature, string, string, string][] = [
  ["setup", "Guided Setup", "Pair a phone with a one-time code. eGuard explains each permission before Android asks for it.", "/how-it-works#setup"],
  ["health", "Configuration Health", "Every protection shows Verified, Pending or Failed, adding up to one score per child.", "/how-it-works#verified"],
  ["screen-time", "Screen Time & Bedtime", "A daily limit with its own weekend allowance, and a bedtime that rests apps overnight.", "/protections/screen-time"],
  ["apps", "App & Content Controls", "Approve new apps, set daily limits per app, and choose age ratings for apps and films.", "/protections/apps"],
  ["location", "Location Sharing", "See where your child's phone is, only when your family turns sharing on. On paid plans.", "/protections/location"],
  // Alert emails go out with the maintenance run (every few minutes), so not "instant"
  ["alerts", "Alerts", "An email and in-app alert when a setting is changed on the device, naming the device and the setting.", "/how-it-works#what-if"],
];

/** Concrete routines eGuard supports, not general benefits: each line maps to a real setting. */
const HABITS: [LucideIcon, string, string, string][] = [
  [CalendarClock, "lp-t-blue", "Calmer school nights", "A bedtime that applies only Sunday to Thursday, so weekends stay relaxed."],
  [Sparkles, "lp-t-purple", "Weekends with a bit more", "A separate, longer screen-time allowance for Saturday and Sunday."],
  [ShieldCheck, "lp-t-blue", "Homework without dead ends", "When a school site is blocked, your child asks and you allow it for 15 minutes, an hour or for good."],
];

/** "Saved" vs "Verified": the reason eGuard exists, in two columns. */
const SAVED_ONLY = ["You tap Save", "The app says “Saved”", "Is it on the phone? You can't tell", "An update or a switched-off setting goes unnoticed"];
const VERIFIED = ["You tap Save", "eGuard sends it to each of your child's devices", "Each device reads the setting back and reports what it really has", "Verified, or Failed with what the device has, and an alert if it changes later"];

const STEPS: [LucideIcon, string, string][] = [
  [Smartphone, "Create Your Account", "Set up your family and add your children."],
  [Settings, "Configure Protection", "Follow our guided setup for Android, with iPhone coming soon."],
  [ShieldCheck, "Verify & Monitor", "Check configuration health and get alerts when something changes."],
  [ChartNoAxesColumnIncreasing, "Build Healthy Habits", "Manage screen time, apps, and location settings."],
];

/** The age guides with the settings eGuard would suggest at each stage, worked out the same way as /guides. */
const AGES = AGE_GUIDES.map((g) => {
  const profile = recommendedProfile(g.sampleAge);
  const at = (key: "SCREEN_TIME" | "BEDTIME") => describeSuggested(profileConfig(profile, key, g.sampleAge));
  return { slug: g.slug, label: g.label, heading: g.title.split(":")[0], screenTime: at("SCREEN_TIME"), bedtime: at("BEDTIME") };
});

/** The first three of the Knowledge Center's "Start here" list. */
const START_HERE = ["how-to-protect-kids-online", "first-phone-checklist", "how-much-screen-time-by-age"]
  .map(articleBySlug).filter((a) => a !== null);

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
        sameAs: SOCIAL_LINKS.map((s) => s.href),
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
    "The Android app is available now on Google Play, and the iOS app is coming soon to the App Store (get an email when it's out at eguard.family/iphone). Where a platform lets eGuard apply a setting directly it does; where it doesn't, you get a step-by-step guide and eGuard verifies the result."],
  ["Do you have a free plan?",
    `Yes. The Free plan covers ${FREE_CHILDREN} with basic protection setup, screen time management and limited app monitoring. You can upgrade whenever your family needs more.`],
  ["Will my child know eGuard is on?",
    "Yes. eGuard is never hidden: your child can always open it and see which rules are on and how much screen time is left. On Android it also shows a notification while it's active. There's a page that explains eGuard to children, at eguard.family/for-kids."],
  ["Can my child switch it off or uninstall it?",
    "Uninstall protection keeps eGuard from being removed without you. If a setting is changed on the device anyway, the device reports what it really has, so eGuard shows it as Failed and sends you an alert naming the device and the setting."],
  ["What happens when the phone is offline?",
    "Protection stays on. Devices keep following the last rules they received and pick up any changes as soon as they reconnect, usually within about 5 minutes."],
  ["What can I see, and what stays private?",
    "You see whether each protection is on, screen-time totals, the names of apps used, and location only if your family turns it on. eGuard never sees messages, photos, calls, what your child types, or which websites they visit, beyond a site they ask you to unblock."],
  ["How is my family's data protected?",
    "eGuard only collects what it needs to verify your protections, and it does not sell your children's data. You can export or delete your account data at any time from Settings."],
  ["Can schools or organizations use eGuard?",
    "Yes. eGuard is built for schools, communities and employers as well as families. The Family Pro plan includes API access for schools and organizations."],
] as const;

const BROWSERS = [
  { name: "Chrome", Mark: ChromeMark, store: "Chrome Web Store", cta: "Add to Chrome", href: STORE_LINKS.chrome },
  { name: "Microsoft Edge", Mark: EdgeMark, store: "Microsoft Edge Add-ons", cta: "Add to Edge", href: STORE_LINKS.edge },
  { name: "Firefox", Mark: FirefoxMark, store: "Firefox Add-ons", cta: "Add to Firefox", href: STORE_LINKS.firefox },
] as const;

const SETUP_VIDEO_POINTS = ["Install eGuard on your child's Android phone", "Connect the phone to your family account", "Switch on the protections you choose"];

const BROWSER_PERKS =["Blocks harmful sites and categories", "Forces SafeSearch", "Lets your child ask before opening a blocked site"];

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

/**
 * Ratings, parents' words and press, from lib/social-proof. Renders nothing until one of them is real: no
 * placeholder quotes, no "trusted by thousands".
 */
function ProofBand() {
  const { rating, quotes, press, any } = proof();
  if (!any) return null;
  return (
    <section className="lp-proof" aria-labelledby="lp-proof-h">
      <div className="lp-wrap">
        <h2 id="lp-proof-h">What parents say</h2>
        {rating ? (
          <a className="lp-proof-rating" href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
            <b className="num">{rating.stars.toFixed(1)}</b>
            <span><span className="lp-proof-stars" aria-hidden="true">★ out of 5</span>on Google Play, from {rating.reviews.toLocaleString("en-US")} reviews</span>
          </a>
        ) : null}
        {quotes.length ? (
          <ul className="lp-quotes">
            {quotes.map((q) => <li key={q.name + q.quote.slice(0, 20)}><blockquote>&ldquo;{q.quote}&rdquo;</blockquote><span>{q.name}</span></li>)}
          </ul>
        ) : null}
        {press.length ? (
          <ul className="lp-press" aria-label="In the news">
            {press.map((p) => <li key={p.url}><a href={p.url} target="_blank" rel="noopener noreferrer"><b>{p.outlet}</b><span>{p.title}</span></a></li>)}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function Avatars() {
  return <div className="lp-avatars">{AVATARS.map((a, i) => <Image key={i} src={a} alt="" width={40} height={40} />)}</div>;
}

const PLAY_STORE_URL = STORE_LINKS.googlePlay;

/** Android is live on Google Play; until the iOS app is published, iPhone links to /iphone and its waitlist. */
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
      <Link href="/iphone" className="lp-stores-off"><Smartphone />iPhone coming soon: get notified</Link>
    </div>
  );
}

export default function Home() {
  return (
    <div className="lp">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structuredData())} />
      <SiteHeader />

      <main>
        {/* ---------- Hero ---------- */}
        <section className="lp-hero">
          <div className="lp-hero-bg"><Image src={heroBackground} alt="" fill loading="eager" fetchPriority="high" sizes="100vw" placeholder="blur" /></div>
          <div className="lp-wrap">
            <div className="lp-hero-copy">
              <span className="lp-eyebrow"><Users />Made for families in the Philippines</span>
              <h1>Parental controls that <span className="lp-accent">prove they&apos;re on</span></h1>
              <p className="lp-hero-lede">Set screen time, bedtime, app and web rules on your child&apos;s Android phone and browser, and see each one confirmed on the device, not just saved.</p>
              <ul className="lp-checks">
                <li><ShieldCheck />Every setting checked on the device</li>
                <li><BellRing />An alert if a setting is switched off</li>
                <li><Globe />Android, Chrome, Edge and Firefox</li>
                <li><CircleCheck />Never hidden from your child</li>
              </ul>
              <div className="lp-hero-actions">
                <StartLink className="lp-btn lp-btn-primary" />
                <a href="#how-it-works" className="lp-btn lp-btn-outline"><PlayDot />See How It Works</a>
              </div>
              <Stores />
            </div>

            <div className="lp-hero-family"><Image src={heroFamily} alt="A smiling family looking at a tablet together" fill loading="eager" fetchPriority="high" sizes="(max-width:1024px) 100vw, (max-width:1633px) 60vw, 980px" placeholder="blur" /></div>

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
                  <div className="lp-hc-title">Free for {FREE_CHILDREN}</div>
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
              <p>eGuard helps families, schools, and organizations promote safer and healthier digital habits. Built in {MADE_IN} by {LEGAL.entity}.</p>
            </div>
            <ul className="lp-audiences">
              {AUDIENCES.map(([icon, title, sub]) => (
                <li key={title}>
                  <Link href={icon === "family" ? "/how-it-works" : "/for-schools"}><AudienceIcon name={icon} /><b>{title}</b><span>{sub}</span></Link>
                </li>
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
                {FEATURES.map(([icon, title, body, href]) => (
                  <Link key={title} href={href} className="lp-feature">
                    <FeatureIcon name={icon} />
                    <h3>{title}</h3>
                    <p>{body}</p>
                    <span className="lp-feature-more">Learn more<ArrowRight /></span>
                  </Link>
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
          <div className="lp-habits-img"><Image src={digitalHabits} alt="A mother and daughter using a laptop together" fill sizes="(max-width:1024px) 100vw, 60vw" placeholder="blur" /></div>
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

        {/* ---------- Setup video ---------- */}
        <section className="lp-video" id="setup-video">
          <div className="lp-wrap">
            <div className="lp-video-head">
              <span className="lp-eyebrow"><Smartphone />Video guide</span>
              <h2>Watch: Set Up Your Child&apos;s Phone</h2>
              <p>See the whole Android setup from start to finish, so you know what to expect before you pick up your child&apos;s phone.</p>
              <ul className="lp-browser-perks">{SETUP_VIDEO_POINTS.map((point) => <li key={point}><Check />{point}</li>)}</ul>
              <a className="lp-btn lp-btn-outline" href={SETUP_VIDEO.watchUrl} target="_blank" rel="noopener noreferrer"><PlayDot />Watch on YouTube</a>
            </div>
            <div className="lp-video-frame">
              <iframe
                src={SETUP_VIDEO.embedUrl}
                title={SETUP_VIDEO.title}
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
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
              {BROWSERS.map(({ name, Mark, store, cta, href }) => (
                <li key={name} className="lp-browser">
                  <span className="lp-browser-mark"><Mark /></span>
                  <h3>{name}</h3>
                  <p>{store}</p>
                  <a className="lp-btn lp-btn-outline" href={href} target="_blank" rel="noopener noreferrer">{cta}<ArrowRight /></a>
                </li>
              ))}
            </ul>
            <p className="lp-browsers-note">After installing, open your eGuard dashboard and choose <b>Add a browser</b> to get the code that connects it to your child.</p>
          </div>
        </section>

        {/* ---------- Saved vs Verified ---------- */}
        <section className="lp-verify" id="verified" aria-labelledby="lp-verify-h">
          <div className="lp-wrap">
            <div className="lp-verify-head">
              <span className="lp-eyebrow"><ShieldCheck />Why eGuard</span>
              <h2 id="lp-verify-h">&ldquo;Saved&rdquo; isn&apos;t the same as &ldquo;on&rdquo;</h2>
              <p>A setting can be saved and still not be on your child&apos;s phone: the phone was offline, an update reset a permission, or someone switched it off. eGuard checks.</p>
            </div>
            <div className="lp-verify-cols">
              <div className="lp-verify-col saved">
                <h3><i><CircleDashed /></i>Most parental controls</h3>
                <ol>{SAVED_ONLY.map((s) => <li key={s}>{s}</li>)}</ol>
                <span className="lp-verify-end">Saved</span>
              </div>
              <div className="lp-verify-col ok">
                <h3><i><ShieldCheck /></i>eGuard</h3>
                <ol>{VERIFIED.map((s) => <li key={s}>{s}</li>)}</ol>
                <span className="lp-verify-end"><Check />Verified on the device</span>
              </div>
            </div>
            <Link href="/how-it-works#verified" className="lp-btn lp-btn-outline lp-how-more">Follow one setting from your screen to theirs<ArrowRight /></Link>
          </div>
        </section>

        <ProofBand />

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
                  <SignedIn signedIn={<Link href="/dashboard" className={`lp-btn ${p.style}`}>{p.cta}</Link>} signedOut={<Link href="/register" className={`lp-btn ${p.style}`}>{p.cta}</Link>} />
                </article>
              ))}
            </div>
            <Link href="/pricing" className="lp-btn lp-btn-outline lp-how-more">Compare plans and ways to pay<ArrowRight /></Link>
          </div>
        </section>

        {/* ---------- Resources ---------- */}
        <section className="lp-res" id="resources" aria-labelledby="lp-res-h">
          <div className="lp-wrap">
            <div className="lp-res-head">
              <span className="lp-eyebrow"><BookOpen />Free for every parent</span>
              <h2 id="lp-res-h">Not sure where to start? Start with their age</h2>
              <p>Suggested screen time and bedtime for each stage, things to talk about, and when to loosen a rule. No account needed.</p>
            </div>
            <ul className="lp-ages">
              {AGES.map((g) => (
                <li key={g.slug}>
                  <Link href={`/guides/${g.slug}`} className="lp-age">
                    <span className="lp-age-label">{g.label}</span>
                    <b>{g.heading}</b>
                    <dl>
                      <div><dt>Screen time</dt><dd>{g.screenTime}</dd></div>
                      <div><dt>Bedtime</dt><dd>{g.bedtime}</dd></div>
                    </dl>
                    <span className="lp-feature-more">Read the guide<ArrowRight /></span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="lp-res-more">
              <div className="lp-res-card">
                <h3><i><BookOpen /></i>Knowledge Center</h3>
                <p>{ARTICLES.length} plain-language guides for Filipino parents. Good places to begin:</p>
                <ul>{START_HERE.map((a) => <li key={a.slug}><Link href={`/learn/${a.slug}`}>{a.title}<ArrowRight /></Link></li>)}</ul>
                <Link href="/learn" className="lp-res-all">Browse all guides<ArrowRight /></Link>
              </div>
              <div className="lp-res-card">
                <h3><i><ClipboardCheck /></i>A family phone agreement</h3>
                <p>Print it, fill it in with your child, and sign it together: screen time on school days, phone-free times, and promises from both sides.</p>
                <p>It comes with a page that explains eGuard to your child in their own words, in English or <Link href="/fil/for-kids" hrefLang="fil" lang="fil">Filipino</Link>.</p>
                <Link href="/for-kids#agreement" className="lp-res-all">Get the agreement<ArrowRight /></Link>
              </div>
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
              <div className="lp-cta-img"><Image src={ctaFamily} alt="" fill sizes="(max-width:1024px) 100vw, 56vw" placeholder="blur" /></div>
              <h2>Ready to Create a Safer Digital World for Your Family?</h2>
              <p>Free for {FREE_CHILDREN}. No card needed.</p>
              <div className="lp-hero-actions">
                <StartLink className="lp-btn lp-btn-white" />
                <Link href="/guides" className="lp-btn lp-btn-ghost-light">Read the guide for their age</Link>
              </div>
              <Stores />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <MetaPixel />
    </div>
  );
}
