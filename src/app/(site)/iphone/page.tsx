import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Globe, Monitor, Smartphone } from "lucide-react";
import { Icon } from "@/components/icon";
import { SubscribeForm } from "@/components/subscribe-form";
import { botCheckSiteKey } from "@/lib/bot-check";
import { PROTECTIONS } from "@/lib/protections";
import { PROTECTION_PAGES } from "@/lib/protection-pages";
import { pageMetadata } from "@/lib/site";
import { LIST_COPY } from "@/lib/subscribers";
import { PageHead } from "../page-head";
import { CAPABILITY_COPY } from "../protections/capability";
import "../protections/protections.css";
import "./iphone.css";

export const metadata: Metadata = pageMetadata({
  title: "eGuard for iPhone and iPad: coming soon",
  path: "/iphone",
  description: "eGuard for iPhone and iPad is on its way. See which protections it will apply, use the web dashboard from your iPhone today, and get one email when it's out.",
});

/** What already works for a family with iPhones, before the app is out */
const TODAY: { icon: typeof Monitor; title: string; body: React.ReactNode }[] = [
  { icon: Monitor, title: "Manage from your iPhone's browser", body: <>The eGuard web dashboard works in Safari on your iPhone: add children, set protections and answer requests. Add it to your Home Screen to open it like an app.</> },
  { icon: Smartphone, title: "Protect your child's Android phone", body: <>If your child uses Android, eGuard works on it now, whatever phone you use yourself. <Link href="/how-it-works#setup">See how setup works</Link>.</> },
  { icon: Globe, title: "Protect their computer's browser", body: <>The eGuard extension for Chrome, Edge and Firefox filters websites on your child&apos;s computer today, Mac or Windows. <Link href="/#browsers">Get the extension</Link>.</> },
];

export default function IphonePage() {
  return (
    <>
      <PageHead
        eyebrow="iPhone and iPad"
        title={<>eGuard for iPhone is <span className="lp-accent">on its way</span></>}
        lede="We're building eGuard for iPhone and iPad, using Apple's Screen Time tools so protections are applied by the system itself, then checked on the device like everything else in eGuard. We don't have a release date yet, so we'd rather tell you when it's ready than guess."
      >
        <div className="ip-signup">
          <b>Get one email when it&apos;s out</b>
          <SubscribeForm list="IOS_LAUNCH" source="iphone" promise={LIST_COPY.IOS_LAUNCH.promise} siteKey={botCheckSiteKey()} cta="Notify me" tone="card" />
        </div>
      </PageHead>

      <div className="pr">
        <section className="pr-sec ip-first" aria-labelledby="ip-plan">
          <h2 id="ip-plan">What it will do on iPhone and iPad</h2>
          <p className="pr-lede">The same ten protections as Android. Apple lets apps do slightly different things, so here&apos;s how each one is planned to work.</p>
          <ul className="ip-table">
            {PROTECTIONS.map((p) => {
              const cap = CAPABILITY_COPY[p.caps.IOS];
              return (
                <li key={p.key}>
                  <i className="pr-card-ico"><Icon name={p.icon} /></i>
                  <div>
                    <Link href={`/protections/${p.slug}`}><b>{PROTECTION_PAGES[p.key].title}</b></Link>
                    {/* The label says "Applied by eGuard"; only the other levels need their explanation */}
                    <span>{PROTECTION_PAGES[p.key].summary}{p.caps.IOS === "AVAILABLE" ? null : <> <em>{cap.body}</em></>}</span>
                  </div>
                  <span className={`hw-pill ${cap.tone}`}>{cap.label}</span>
                </li>
              );
            })}
          </ul>
          <p className="pr-lede"><Link href="/how-it-works#iphone-android" className="pr-link">How iPhone and Android differ<ArrowRight /></Link></p>
        </section>

        <section className="pr-sec" aria-labelledby="ip-today">
          <h2 id="ip-today">What you can do today</h2>
          <ul className="st-values ip-today">
            {TODAY.map(({ icon: Ico, title, body }) => <li key={title}><i><Ico /></i><h3>{title}</h3><p>{body}</p></li>)}
          </ul>
          <p className="pr-lede">Want to use Apple&apos;s own controls in the meantime? Our guide walks through <Link href="/learn/iphone-screen-time-setup" className="ip-inline">setting up Screen Time on your child&apos;s iPhone</Link>.</p>
        </section>
      </div>
    </>
  );
}
