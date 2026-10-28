import type { Metadata } from "next";
import { FREE_CHILDREN } from "@/lib/plans";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, CircleCheck, HeartHandshake, LockKeyhole, Send, Smartphone, SlidersHorizontal } from "lucide-react";
import { pageMetadata } from "@/lib/site";
import { supportEmail } from "@/lib/support";
import { LEGAL } from "@/lib/legal";
import { MADE_IN } from "@/lib/social-proof";
import { StartLink } from "@/components/signed-in";
import { PageHead } from "../page-head";

import digitalHabits from "../../../../public/landing/digital-habits.jpg";

export const metadata: Metadata = pageMetadata({
  title: "About eGuard, the parental control app you can verify",
  path: "/about",
  description: "eGuard helps parents set up screen time, bedtime and app protections on their children's devices, and shows whether each one is really working.",
});

const FLOW = [
  [SlidersHorizontal, "You choose a setting", "A two-hour limit, a 9:30 PM bedtime, an age rating for apps."],
  [Send, "eGuard sends it to each device", "Your child's phone and tablet pick it up the next time they sync."],
  [Smartphone, "The device reports back", "Each device tells eGuard the setting it actually has."],
  [CircleCheck, "Only then is it Verified", "If the device reports something else, you see Failed, and what it reported."],
] as const;

const VALUES = [
  [BadgeCheck, "Tell parents the truth", "A setting isn't done until the device confirms it. When we can't check, we say so instead of guessing."],
  [LockKeyhole, "Collect as little as we can", "Settings, screen-time totals and app names. Never messages, photos or browsing content. Nothing is sold, and there are no ads."],
  [HeartHandshake, "Keep it a family decision", "eGuard is visible on your child's device, never hidden. On Android it shows a notification whenever it's active."],
] as const;

/** "Share your story": the reply is the written consent lib/social-proof needs before a quote goes on the site */
const storyMailto = `mailto:${supportEmail()}?subject=${encodeURIComponent("My eGuard story")}&body=${encodeURIComponent(
  "How has eGuard worked for your family?\n\n\n\nMay we quote what you wrote on eguard.family? (Yes / No)\nIf yes, name it as (for example \"Maria, Tacloban\" or \"Parent of two, Cebu\"): \n",
)}`;

export default function AboutPage() {
  return (
    <>
      <PageHead
        eyebrow="About eGuard"
        title="Protections you set once, verified on every device"
        lede="eGuard helps parents set up screen time, bedtime, app and web protections on their children's phones and tablets, then shows whether each one is actually working."
      />

      <div className="lp-wrap st-about">
        <div className="st-split">
          <div>
            <h2>Why we built eGuard</h2>
            <p>Most parental controls stop at &quot;Saved&quot;. But a setting can be saved and still not be on the phone: the device was offline, an update reset a permission, or someone switched it off. From the parent&apos;s side, nothing looks different.</p>
            <p>We wanted a tool that tells parents what&apos;s true on their child&apos;s device right now, and speaks up when that changes. That&apos;s the idea eGuard is built around.</p>
          </div>
          <div className="st-photo">
            <Image src={digitalHabits} alt="A mother and daughter using a laptop together" fill sizes="(max-width:1024px) 100vw, (max-width:1240px) 45vw, 560px" placeholder="blur" />
          </div>
        </div>

        <div className="st-split st-flip">
          <ol className="st-flow" aria-label="How a setting is verified">
            {FLOW.map(([Ico, title, body], i) => (
              <li key={title} className={i === FLOW.length - 1 ? "ok" : undefined}><i><Ico /></i><div><b>{title}</b><span>{body}</span></div></li>
            ))}
          </ol>
          <div>
            <h2>Verified, not just saved</h2>
            <p>Every change goes through the same loop. eGuard marks a setting Verified only once the device confirms it, and keeps checking each time the device syncs.</p>
            <p>Configuration Health rolls this into one score per child: 10 checks, one for each protection. It measures settings, never your child&apos;s behavior.</p>
          </div>
        </div>

        <div className="st-block">
          <h2>What we stand by</h2>
          <ul className="st-values">
            {VALUES.map(([Ico, title, body]) => (
              <li key={title}><i><Ico /></i><h3>{title}</h3><p>{body}</p></li>
            ))}
          </ul>
        </div>

        <div className="st-block">
          <h2>Made for families in the Philippines</h2>
          <p>Prices are in pesos, and you can pay with GCash, Maya, a card or QR Ph. Schools and communities can use eGuard too: eGuard Family includes API access for organizations.</p>
          <div className="st-facts">
            <div><b>10</b><span>protections, each checked on the device</span></div>
            <div><b>Android &amp; browsers</b><span>phones, tablets, Chrome, Edge and Firefox, managed from one dashboard. <Link href="/iphone">iPhone and iPad coming soon</Link></span></div>
            <div><b>₱0</b><span>for {FREE_CHILDREN}, with no card needed to start</span></div>
          </div>
        </div>

        <div className="st-block">
          <h2>Where we are today</h2>
          <p>The parent dashboard is live on the web, the Android app is on Google Play, and the browser extension is available for Chrome, Edge and Firefox. The iPhone app is on its way. If something doesn&apos;t work the way you expect, or there&apos;s a protection you need, we want to hear it.</p>
          <p>Write to us at <a href={`mailto:${supportEmail()}`}>{supportEmail()}</a>.</p>
        </div>

        <div className="st-block">
          <h2>Who&apos;s behind eGuard</h2>
          <p>eGuard is made in {MADE_IN} by {LEGAL.entity}, a registered Philippine business. That&apos;s why prices are in pesos, payments work with GCash and Maya, and our guides are written for Filipino families: lolos and lolas, OFW parents and yayas included.</p>
        </div>

        <div className="st-block">
          <h2>Has eGuard helped your family?</h2>
          <p>We&apos;d love to hear how it&apos;s going, good or bad. With your permission, we may share a line of your story on our site, under the name you choose, so other parents can decide whether eGuard is right for them. We&apos;ll never use your story without asking, or share anything about your children.</p>
          <p><a href={storyMailto}>Share your story</a></p>
        </div>

        <div className="st-cta">
          <div>
            <h2>Set up your family in a few minutes</h2>
            <p>Free for {FREE_CHILDREN}. Upgrade whenever you need more.</p>
          </div>
          <StartLink className="lp-btn lp-btn-white" />
        </div>
      </div>
    </>
  );
}
