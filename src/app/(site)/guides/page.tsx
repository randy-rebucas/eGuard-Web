import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AGE_GUIDES } from "@/lib/age-guides";
import { PROFILES, profileConfig, recommendedProfile } from "@/lib/profiles";
import { describeSuggested } from "@/lib/protection-pages";
import { pageMetadata } from "@/lib/site";
import { PageHead } from "../page-head";
import "./guides.css";

export const metadata: Metadata = pageMetadata({
  title: "Guides by age",
  path: "/guides",
  description: "Screen time, bedtime and app rules that fit your child's age, from a first tablet at 5 to an almost-adult at 17, with things to talk about at each stage.",
});

export default function GuidesPage() {
  return (
    <>
      <PageHead
        eyebrow="Guides by age"
        title="The right rules for their age"
        lede="What a 6-year-old needs from their tablet is very different from what a 16-year-old needs from their phone. Pick your child's age for suggested settings, what to focus on, and things to talk about."
      />
      <div className="gd">
        <ul className="gd-grid">
          {AGE_GUIDES.map((g) => {
            const profile = recommendedProfile(g.sampleAge);
            const at = (key: "SCREEN_TIME" | "BEDTIME") => describeSuggested(profileConfig(profile, key, g.sampleAge));
            return (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} className="gd-tile">
                  <span className="gd-age">{g.label}</span>
                  <h2>{g.title.split(":")[0]}</h2>
                  <p>{g.summary}</p>
                  <dl>
                    <div><dt>Profile</dt><dd>{PROFILES.find((p) => p.id === profile)!.name}</dd></div>
                    <div><dt>Screen time</dt><dd>{at("SCREEN_TIME")}</dd></div>
                    <div><dt>Bedtime</dt><dd>{at("BEDTIME")}</dd></div>
                  </dl>
                  <span className="gd-more">Read the guide<ArrowRight /></span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="gd-lede gd-center">Every child is different. These are starting points, and you can change any setting at any time.</p>
      </div>
    </>
  );
}
