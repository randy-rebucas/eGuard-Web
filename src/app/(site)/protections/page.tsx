import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Icon } from "@/components/icon";
import { PROTECTIONS, type Capability } from "@/lib/protections";
import { PROTECTION_PAGES } from "@/lib/protection-pages";
import { pageMetadata } from "@/lib/site";
import { PageHead } from "../page-head";
import { CapabilityChip, CAPABILITY_COPY } from "./capability";
import "./protections.css";

export const metadata: Metadata = pageMetadata({
  title: "Protections: screen time, app and web limits for kids",
  path: "/protections",
  description: "Screen time, bedtime, app and content ratings, web filtering, location and more: the 10 eGuard protections, and how each works on Android and iPhone.",
});

const LEVELS: Capability[] = ["AVAILABLE", "GUIDED", "VERIFY_ONLY", "UNSUPPORTED"];

export default function ProtectionsPage() {
  return (
    <>
      <PageHead
        eyebrow="Protections"
        title="Ten protections, each one checked on the device"
        lede="Choose the ones your family needs. eGuard applies them where the phone allows, guides you where it doesn't, and shows Verified only when the device confirms it."
      />

      <div className="pr">
        <ul className="pr-grid">
          {PROTECTIONS.map((p) => {
            const page = PROTECTION_PAGES[p.key];
            return (
              <li key={p.key}>
                <Link href={`/protections/${p.slug}`} className="pr-card">
                  <i className="pr-card-ico"><Icon name={p.icon} /></i>
                  <h2>{page.title}</h2>
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
            <p>Free for one child. No card needed.</p>
          </div>
          <Link href="/register" className="lp-btn lp-btn-white">Get Started Free<ArrowRight /></Link>
        </div>
      </div>
    </>
  );
}
