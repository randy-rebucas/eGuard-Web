import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, MessageCircle, Sprout } from "lucide-react";
import { Icon } from "@/components/icon";
import { AGE_GUIDES, ageGuide } from "@/lib/age-guides";
import { PROFILES, profileConfig, recommendedProfile } from "@/lib/profiles";
import { PROTECTIONS, PROTECTION_BY_SLUG } from "@/lib/protections";
import { PROTECTION_PAGES, describeSuggested } from "@/lib/protection-pages";
import { jsonLd, pageMetadata, siteUrl } from "@/lib/site";
import { PageHead } from "../../page-head";
import "../guides.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return AGE_GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const g = ageGuide((await params).slug);
  if (!g) return {};
  return pageMetadata({ title: g.title, description: g.summary, path: `/guides/${g.slug}`, type: "article", ownImage: true });
}

export default async function AgeGuidePage({ params }: PageProps<"/guides/[slug]">) {
  const g = ageGuide((await params).slug);
  if (!g) notFound();
  const profileId = recommendedProfile(g.sampleAge);
  const profile = PROFILES.find((p) => p.id === profileId)!;
  const i = AGE_GUIDES.indexOf(g);
  const [prev, next] = [AGE_GUIDES[i - 1], AGE_GUIDES[i + 1]];
  const site = siteUrl();
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: g.title, description: g.summary, url: `${site}/guides/${g.slug}`, inLanguage: "en-PH",
        publisher: { "@type": "Organization", "@id": `${site}/#org`, name: "eGuard", logo: `${site}/brand/logo-mark-512.png` } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site },
        { "@type": "ListItem", position: 2, name: "Guides by age", item: `${site}/guides` },
        { "@type": "ListItem", position: 3, name: g.label, item: `${site}/guides/${g.slug}` },
      ] },
    ],
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(data)} />
      <PageHead eyebrow={`Guide · ${g.label}`} title={g.title} lede={g.summary} />

      <div className="gd">
        <Link href="/guides" className="st-back"><ArrowLeft />All guides</Link>

        <div className="gd-top">
          <div className="gd-prose">
            <h2>What this age looks like online</h2>
            {g.stage.map((p) => <p key={p}>{p}</p>)}
            <h2>Where to focus</h2>
            <ul className="gd-focus">
              {g.focus.map(([h, b]) => <li key={h}><Check /><div><b>{h}</b><span>{b}</span></div></li>)}
            </ul>
          </div>

          <aside className="gd-card" aria-labelledby="gd-talk">
            <h2 id="gd-talk"><i><MessageCircle /></i>Things to talk about</h2>
            <ul>{g.talk.map((t) => <li key={t}>&ldquo;{t}&rdquo;</li>)}</ul>
            <Link href="/for-kids#agreement" className="gd-link">Print a family agreement<ArrowRight /></Link>
          </aside>
        </div>

        <section className="gd-sec" aria-labelledby="gd-settings">
          <h2 id="gd-settings">A starting point for {/^(8|11|18)$/.test(String(g.sampleAge)) ? "an" : "a"} {g.sampleAge}-year-old</h2>
          <p className="gd-lede">When you add a child this age, eGuard suggests the <b>{profile.name}</b> profile ({profile.description.toLowerCase()}). These are its settings. You review them before anything is sent, and can change any of them later.</p>
          <div className="st-table gd-table">
            <table>
              <thead><tr><th>Protection</th><th>Suggested setting</th></tr></thead>
              <tbody>
                {PROTECTIONS.map((p) => (
                  <tr key={p.key}>
                    <td><Link href={`/protections/${p.slug}`}><Icon name={p.icon} />{p.checkName}</Link></td>
                    <td>{describeSuggested(profileConfig(profileId, p.key, g.sampleAge))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="gd-sec gd-loosen" aria-labelledby="gd-grow">
          <i><Sprout /></i>
          <div>
            <h2 id="gd-grow">When to loosen the rules</h2>
            <ul>{g.loosen.map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        </section>

        <nav className="gd-sec" aria-labelledby="gd-read">
          <h2 id="gd-read">Protections that matter most at this age</h2>
          <ul className="gd-prots">
            {g.protections.map((slug) => {
              const def = PROTECTION_BY_SLUG[slug];
              const page = PROTECTION_PAGES[def.key];
              return <li key={slug}><Link href={`/protections/${slug}`}><i><Icon name={def.icon} /></i><div><b>{page.title}</b><span>{page.summary}</span></div></Link></li>;
            })}
          </ul>
        </nav>

        <nav className="gd-pager" aria-label="Other guides">
          {prev ? <Link href={`/guides/${prev.slug}`}><ArrowLeft /><span><small>Younger</small>{prev.label}</span></Link> : <span />}
          {next ? <Link href={`/guides/${next.slug}`} className="next"><span><small>Older</small>{next.label}</span><ArrowRight /></Link> : <span />}
        </nav>

        <div className="st-cta">
          <div>
            <h2>Set up eGuard for your {g.sampleAge < 13 ? "child" : "teen"}</h2>
            <p>eGuard suggests these settings for you. Free for one child.</p>
          </div>
          <Link href="/register" className="lp-btn lp-btn-white">Get Started Free<ArrowRight /></Link>
        </div>
      </div>
    </article>
  );
}
