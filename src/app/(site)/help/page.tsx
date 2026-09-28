import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HELP_ARTICLES, HELP_CATEGORIES } from "@/lib/help";
import { pageMetadata } from "@/lib/site";
import { supportEmail } from "@/lib/support";
import { PageHead } from "../page-head";

export const metadata: Metadata = pageMetadata({
  title: "Help Center",
  path: "/help",
  description: "Set up parental controls on Android and iPhone, fix a device that shows offline, and learn what data eGuard keeps.",
});

export default function HelpPage() {
  return (
    <>
      <PageHead eyebrow="Help Center" title="How can we help?" lede="Setup guides, fixes for common problems, and how eGuard handles your family's data." />
      <div className="lp-wrap st-help">
        {HELP_CATEGORIES.map((c) => {
          const articles = HELP_ARTICLES.filter((a) => a.category === c.id);
          if (!articles.length) return null;
          return (
            <section key={c.id} className="st-help-group" aria-labelledby={`help-${c.id}`}>
              <h2 id={`help-${c.id}`}>{c.name}</h2>
              <p>{c.description}</p>
              <ul>
                {articles.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/help/${a.slug}`}><b>{a.title}</b><span>{a.summary}</span><ArrowRight /></Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <p className="st-note">Can&apos;t find what you need? Write to <a href={`mailto:${supportEmail()}`}>{supportEmail()}</a>.</p>
      </div>
    </>
  );
}
