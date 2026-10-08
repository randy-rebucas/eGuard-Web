import type { Metadata } from "next";
import { FREE_CHILDREN } from "@/lib/plans";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Platform } from "@prisma/client";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { Icon } from "@/components/icon";
import { AndroidMark, AppleMark } from "@/components/brand-marks";
import { Phone, ScreenProtection } from "@/components/flow-devices";
import { PROFILES, profileConfig, recommendedProfile } from "@/lib/profiles";
import { PROTECTIONS, PROTECTION_BY_SLUG } from "@/lib/protections";
import { PROTECTION_PAGES, SAMPLE_AGES, describeSuggested } from "@/lib/protection-pages";
import { jsonLd, pageMetadata, siteUrl } from "@/lib/site";
import { PageHead } from "../../page-head";
import { CapabilityChip, CAPABILITY_COPY } from "../capability";
import "../protections.css";

export function generateStaticParams() {
  return PROTECTIONS.map((p) => ({ slug: p.slug }));
}

const bySlug = (slug: string) => {
  const def = PROTECTION_BY_SLUG[slug];
  return def ? { def, page: PROTECTION_PAGES[def.key] } : null;
};

export async function generateMetadata({ params }: PageProps<"/protections/[slug]">): Promise<Metadata> {
  const found = bySlug((await params).slug);
  if (!found) return {};
  return pageMetadata({ title: found.page.title, description: found.page.summary, path: `/protections/${found.def.slug}`, ownImage: true });
}

const PLATFORMS: [Platform, string, () => React.ReactElement][] = [
  ["ANDROID", "Android phones and tablets", AndroidMark],
  ["IOS", "iPhone and iPad", AppleMark],
];

export default async function ProtectionPage({ params }: PageProps<"/protections/[slug]">) {
  const found = bySlug((await params).slug);
  if (!found) notFound();
  const { def, page } = found;
  const example = describeSuggested(profileConfig(recommendedProfile(10), def.key, 10));
  const others = PROTECTIONS.filter((p) => p.key !== def.key);
  const site = siteUrl();
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: site },
      { "@type": "ListItem", position: 2, name: "Protections", item: `${site}/protections` },
      { "@type": "ListItem", position: 3, name: page.title, item: `${site}/protections/${def.slug}` },
    ],
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbs)} />
      <PageHead eyebrow={`Protection · ${def.checkName}`} title={page.title} lede={page.summary}>
        <div className="pr-caps">
          <CapabilityChip platform="Android" cap={def.caps.ANDROID} />
          <CapabilityChip platform="iPhone & iPad" cap={def.caps.IOS} />
        </div>
      </PageHead>

      <div className="pr">
        <Link href="/protections" className="st-back"><ArrowLeft />All protections</Link>

        <div className="pr-top">
          <div className="pr-copy">
            <h2>What it does</h2>
            {page.what.map((p) => <p key={p}>{p}</p>)}
            <h2>What your child sees</h2>
            <p>{page.childSees}</p>
            <h2>How eGuard checks it</h2>
            <p>{page.check}</p>
            <p><Link href="/how-it-works#verified" className="pr-link">How verification works<ArrowRight /></Link></p>
          </div>
          <div className="pr-art">
            <Phone os="android" caption="Parent app" className="pr-phone" label={`The eGuard parent app showing ${page.title}: ${example}`}>
              <ScreenProtection icon={<Icon name={def.icon} />} name={def.checkName} value={example} ios={def.caps.IOS} />
            </Phone>
          </div>
        </div>

        <section className="pr-sec" aria-labelledby="pr-platforms">
          <h2 id="pr-platforms">On Android and on iPhone</h2>
          <div className="pr-plats">
            {PLATFORMS.map(([platform, label, Mark]) => {
              const cap = def.caps[platform];
              const steps = def.guide?.[platform];
              const note = platform === "ANDROID" ? page.android : page.ios;
              return (
                <div key={platform} className="pr-plat">
                  <div className="pr-plat-head"><span className="pr-plat-mark"><Mark /></span><h3>{label}</h3></div>
                  <span className={`hw-pill ${CAPABILITY_COPY[cap].tone}`}>{CAPABILITY_COPY[cap].label}</span>
                  <p>{note ?? CAPABILITY_COPY[cap].body}</p>
                  {steps ? (
                    <>
                      <b className="pr-steps-h">The steps eGuard shows you</b>
                      <ol className="pr-steps">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {page.byAge ? (
          <section className="pr-sec" aria-labelledby="pr-ages">
            <h2 id="pr-ages">Suggested starting points</h2>
            <p className="pr-lede">When you add a child, eGuard suggests a profile for their age. These are its starting values. You can change any of them. <Link href="/guides" className="pr-link">Guides by age<ArrowRight /></Link></p>
            <div className="st-table">
              <table>
                <thead><tr><th>Child&apos;s age</th><th>Suggested profile</th><th>{def.checkName}</th></tr></thead>
                <tbody>
                  {SAMPLE_AGES.map((age) => {
                    const profile = recommendedProfile(age);
                    return (
                      <tr key={age}>
                        <td>{age} years</td>
                        <td>{PROFILES.find((p) => p.id === profile)!.name}</td>
                        <td>{describeSuggested(profileConfig(profile, def.key, age))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="pr-sec" aria-labelledby="pr-faq">
          <h2 id="pr-faq">Questions about {def.checkName.toLowerCase()}</h2>
          <div className="lp-faq-list pr-faq">
            {page.faqs.map(([q, a]) => (
              <details key={q} name="pr-faq">
                <summary>{q}<ChevronDown /></summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <nav className="pr-sec" aria-labelledby="pr-more">
          <h2 id="pr-more">More protections</h2>
          <ul className="pr-others">
            {others.map((p) => (
              <li key={p.key}><Link href={`/protections/${p.slug}`}><i><Icon name={p.icon} /></i><span>{PROTECTION_PAGES[p.key].title}</span></Link></li>
            ))}
          </ul>
        </nav>

        <div className="st-cta">
          <div>
            <h2>Turn on {def.checkName.toLowerCase()} in a few minutes</h2>
            <p>Free for {FREE_CHILDREN}, with every setting checked on the device.</p>
          </div>
          <Link href="/register" className="lp-btn lp-btn-white">Get Started Free<ArrowRight /></Link>
        </div>
      </div>
    </article>
  );
}
