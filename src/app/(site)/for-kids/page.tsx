import type { Metadata } from "next";
import Link from "next/link";
import {
  AppWindow, ArrowRight, Check, Globe, Hand, Hourglass, MapPin, MessageCircleHeart, Moon, Sparkles, X, type LucideIcon,
} from "lucide-react";
import { pageMetadata } from "@/lib/site";
import { Phone, ScreenChildHome } from "@/components/flow-devices";
import { PageHead } from "../page-head";
import { PrintButton } from "./print-button";
import "./kids.css";

export const metadata: Metadata = pageMetadata({
  title: "eGuard, explained for kids",
  path: "/for-kids",
  description: "A page for children: what eGuard does on your phone, what your parents can and can't see, how to ask for an app or a website, and a family agreement to fill in together.",
});

const DOES: [LucideIcon, string, string, string][] = [
  [Hourglass, "blue", "Screen time", "You get a set amount of phone time each day. eGuard shows how much is left, so it's never a surprise."],
  [Moon, "purple", "Bedtime", "At night, apps rest too. They come back in the morning at the time your family picked."],
  [AppWindow, "green", "New apps", "Some new apps need a parent's OK first. You can ask right from eGuard."],
  [Globe, "blue", "Websites", "Some websites are blocked. If you need one for school, tap Ask a parent."],
  [MapPin, "orange", "Location", "If your family turns it on, your parents can see where your phone is, to know you're safe."],
];

const CAN_SEE = [
  "Which eGuard settings are on",
  "How long you used your phone today, and which apps",
  "Where your phone is, if location sharing is on",
  "How many websites were blocked each day",
];
const CANT_SEE = [
  "Your messages and chats",
  "Your photos and videos",
  "Which websites you visit",
  "What you type",
  "Your calls",
];

const KID_PROMISES = [
  "I'll ask before downloading a new app",
  "I'll put my phone away at bedtime",
  "I'll tell a grown-up if something online makes me feel uncomfortable",
  "I won't try to switch eGuard off",
];
const PARENT_PROMISES = [
  "I'll explain the rules, not just set them",
  "I'll answer your requests as soon as I can",
  "I'll give you more freedom as you grow",
  "I'll listen if a rule doesn't feel fair",
];

export default function ForKidsPage() {
  return (
    <>
      <div className="kd-screen">
        <PageHead
          eyebrow="For kids"
          title={<>Hi! Your family uses <span className="lp-accent">eGuard</span>.</>}
          lede="Here's what eGuard does on your phone, what your parents can and can't see, and how to ask for something. It's short, promise."
        />
      </div>

      <div className="lp-wrap st-about kd">
        <div className="st-split kd-screen">
          <div>
            <h2>What is eGuard?</h2>
            <p>eGuard is an app that helps your family agree on how phones and tablets are used, like how much time, and when it&apos;s bedtime.</p>
            <p>It&apos;s <b>never secret</b>. You can always open eGuard and see exactly what&apos;s on. If your parents change something, it shows up there too.</p>
          </div>
          <div className="kd-art">
            <Phone os="android" className="kd-phone" caption="What you see in eGuard" label="The eGuard app on a child's phone, showing screen time left, bedtime, and an Ask for an app button">
              <ScreenChildHome />
            </Phone>
          </div>
        </div>

        <div className="st-block kd-screen">
          <h2>What eGuard does</h2>
          <ul className="kd-does">
            {DOES.map(([Ico, tone, title, body]) => <li key={title}><i className={tone}><Ico /></i><h3>{title}</h3><p>{body}</p></li>)}
          </ul>
        </div>

        <div className="st-block kd-screen">
          <h2>What your parents can see, and what they can&apos;t</h2>
          <div className="kd-see">
            <div className="kd-can">
              <h3><i><Check /></i>They can see</h3>
              <ul>{CAN_SEE.map((s) => <li key={s}><Check />{s}</li>)}</ul>
            </div>
            <div className="kd-cant">
              <h3><i><X /></i>eGuard never shows them</h3>
              <ul>{CANT_SEE.map((s) => <li key={s}><X />{s}</li>)}</ul>
            </div>
          </div>
        </div>

        <div className="st-block kd-screen">
          <h2>Need something? Just ask</h2>
          <p>A block isn&apos;t the end. If you need an app or a website, ask. Your parent gets your request on their phone or computer and can say yes in a moment.</p>
          <ol className="kd-ask">
            <li><span>1</span><b>Tap Ask</b>Use <em>Ask for an app</em> in eGuard, or <em>Ask a parent</em> on a blocked website.</li>
            <li><span>2</span><b>Say why</b>On a website, add a reason, like &ldquo;for my science homework&rdquo;. For an app, tell your parent why. It really helps.</li>
            <li><span>3</span><b>Wait a little</b>When your parent says yes, the app or site opens. Sometimes it&apos;s just for a while.</li>
          </ol>
        </div>

        <div className="st-split st-flip kd-screen">
          <ul className="kd-tips">
            <li><i><MessageCircleHeart /></i><div><b>Talk about it</b><span>If a rule feels unfair, tell your parents why. Rules can change.</span></div></li>
            <li><i><Hand /></i><div><b>Speak up</b><span>If something online scares or upsets you, tell a grown-up you trust. You won&apos;t be in trouble.</span></div></li>
            <li><i><Sparkles /></i><div><b>Grow into it</b><span>As you get older, your family can give you more time and freedom.</span></div></li>
          </ul>
          <div>
            <h2>eGuard is a team thing</h2>
            <p>eGuard works best when your family decides the rules together. The agreement below is a good way to start: fill it in with your parents, sign it, and put it somewhere you&apos;ll see it.</p>
          </div>
        </div>

        {/* ---------- Printable agreement ---------- */}
        <section className="kd-agreement" id="agreement" aria-labelledby="agreement-h">
          <div className="kd-agreement-head">
            <div>
              <span className="lp-eyebrow kd-screen">Family agreement</span>
              <h2 id="agreement-h">Our family&apos;s phone agreement</h2>
              <p>Fill it in together. Change it whenever you all agree.</p>
            </div>
            <div className="kd-screen"><PrintButton /></div>
          </div>

          <div className="kd-fields">
            <div><span>Screen time on school days</span><i /></div>
            <div><span>Screen time on weekends</span><i /></div>
            <div><span>Phones go to sleep at</span><i /></div>
            <div><span>Phones charge overnight in</span><i /></div>
            <div className="wide"><span>Phone-free times (like meals)</span><i /></div>
          </div>

          <div className="kd-promises">
            <div>
              <h3>I promise…</h3>
              <ul>{KID_PROMISES.map((p) => <li key={p}><span className="kd-box" />{p}</li>)}<li><span className="kd-box" /><i className="kd-line" /></li></ul>
            </div>
            <div>
              <h3>As your parent, I promise…</h3>
              <ul>{PARENT_PROMISES.map((p) => <li key={p}><span className="kd-box" />{p}</li>)}<li><span className="kd-box" /><i className="kd-line" /></li></ul>
            </div>
          </div>

          <div className="kd-sign">
            <div><i /><span>Child&apos;s name and signature</span></div>
            <div><i /><span>Parent&apos;s name and signature</span></div>
            <div><i /><span>Date</span></div>
          </div>
          <p className="kd-foot">Made with eGuard · eguard.family</p>
        </section>

        <div className="st-cta kd-screen">
          <div>
            <h2>Are you a parent?</h2>
            <p>Share this page with your child when you set up their phone. See how it works on your side.</p>
          </div>
          <Link href="/how-it-works" className="lp-btn lp-btn-white">How eGuard works<ArrowRight /></Link>
        </div>
      </div>
    </>
  );
}
