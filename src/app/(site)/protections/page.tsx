import type { Metadata } from "next";
import { FREE_CHILDREN } from "@/lib/plans";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Icon } from "@/components/icon";
import { PROTECTIONS, PROTECTION_BY_SLUG, type Capability } from "@/lib/protections";
import { PROTECTION_PAGES } from "@/lib/protection-pages";
import { pageMetadata } from "@/lib/site";
import { StartLink } from "@/components/signed-in";
import { PageHead } from "../page-head";
import { CapabilityChip, CAPABILITY_COPY } from "./capability";
import "./protections.css";

export const metadata: Metadata = pageMetadata({
  title: "Protections: screen time, app and web limits for kids",
  path: "/protections",
  description: "Screen time, bedtime, app and content ratings, web filtering, location and more: the 10 eGuard protections, and how each works on Android and iPhone.",
});

/** The ten protections grouped by what a parent is trying to do; every protection appears exactly once. */
const GROUPS: { id: string; title: string; lede: string; slugs: string[] }[] = [
  { id: "time", title: "Time on screens", lede: "How long, and when.", slugs: ["screen-time", "bedtime"] },
  { id: "apps", title: "Apps and what's in them", lede: "What gets installed, and what it can show.", slugs: ["app-approval", "apps", "content", "downloads"] },
  { id: "safety", title: "The web, location and keeping eGuard on", lede: "Safer browsing, knowing where they are, and protection that stays in place.", slugs: ["web", "location", "notifications", "uninstall-protection"] },
];

// Fails the build if a protection is added without a group, so none silently drops off this page
if (new Set(GROUPS.flatMap((g) => g.slugs)).size !== PROTECTIONS.length || !PROTECTIONS.every((p) => GROUPS.some((g) => g.slugs.includes(p.slug)))) {
  throw new Error("/protections: every protection must be in exactly one group");
}

/** "I'm worried about…" shortcuts into the groups above. */
const WORRIES: [string, string][] = [
  ["Too much gaming or scrolling", "time"], ["Phones at bedtime", "time"], ["Apps I haven't seen", "apps"],
  ["Content that's too old for them", "apps"], ["Adult websites", "safety"], ["Knowing where they are", "safety"], ["eGuard being switched off", "safety"],
];

const LEVELS: Capability[] = ["AVAILABLE", "GUIDED", "VERIFY_ONLY", "PARENT_SET", "UNSUPPORTED"];

export default function ProtectionsPage() {
  return (
    <>
      <PageHead
        eyebrow="Protections"
        title="Ten protections, each one checked on the device"
        lede="Choose the ones your family needs. eGuard applies them where the phone allows, guides you where it doesn't, and shows Verified only when the device confirms it."
      />

      <div className="pr">
        <nav className="pr-worries" aria-label="Find a protection by worry">
          <b>I&apos;m worried about…</b>
          <ul>{WORRIES.map(([label, id]) => <li key={label}><a href={`#${id}`}>{label}</a></li>)}</ul>
        </nav>

        {GROUPS.map((g) => (
          <section key={g.id} id={g.id} className="pr-group" aria-labelledby={`pr-${g.id}`}>
            <h2 id={`pr-${g.id}`}>{g.title}</h2>
            <p className="pr-lede">{g.lede}</p>
            <ul className="pr-grid">
              {g.slugs.map((slug) => {
                const p = PROTECTION_BY_SLUG[slug];
                const page = PROTECTION_PAGES[p.key];
                return (
                  <li key={p.key}>
                    <Link href={`/protections/${p.slug}`} className="pr-card">
                      <i className="pr-card-ico"><Icon name={p.icon} /></i>
                      <h3>{page.title}</h3>
                      <p>{page.summary}</p>
                      <div className="pr-caps">
                        <CapabilityChip platform="Android" cap={p.caps.ANDROID} />
                        <CapabilityChip platform="iPhone" cap={p.caps.IOS} />
                      </div>
                      <span className="pr-card-more">Learn more<ArrowRight /></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <section className="pr-sec" aria-labelledby="pr-levels">
          <h2 id="pr-levels">What the labels mean</h2>
          <p className="pr-lede">Apple and Google let apps do different things. Each protection shows how it works on each platform.</p>
          <ul className="pr-levels">
            {LEVELS.map((cap) => (
              <li key={cap}><span className={`hw-pill ${CAPABILITY_COPY[cap].tone}`}>{CAPABILITY_COPY[cap].label}</span><p>{CAPABILITY_COPY[cap].body}</p></li>
            ))}
          </ul>
          <p className="pr-lede"><Link href="/how-it-works" className="pr-link">See how eGuard delivers and verifies each setting<ArrowRight /></Link></p>
        </section>

        <div className="st-cta">
          <div>
            <h2>Start with the protections that matter most to you</h2>
            <p>Free for {FREE_CHILDREN}. No card needed.</p>
          </div>
          <StartLink className="lp-btn lp-btn-white" />
        </div>
      </div>
    </>
  );
}
