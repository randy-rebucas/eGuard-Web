import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Ban, Download, Eye, EyeOff, FileSignature, Fingerprint, History, KeyRound, LockKeyhole,
  MapPinned, School, ShieldCheck, Trash2, UserCog, Users, type LucideIcon,
} from "lucide-react";
import { LEGAL } from "@/lib/legal";
import { pageMetadata } from "@/lib/site";
import { supportEmail } from "@/lib/support";
import { ServerCloud } from "@/components/flow-devices";
import { PageHead } from "../page-head";
import "./security.css";

export const metadata: Metadata = pageMetadata({
  title: "Security & privacy: how eGuard protects your child's data",
  path: "/security",
  description: "How eGuard protects your family's data: what we collect and never collect, how accounts and devices are secured, and your rights under the Data Privacy Act.",
});

const PROMISES: [LucideIcon, string, string][] = [
  [Ban, "No ads. Nothing sold.", "eGuard is paid for by subscriptions. We don't sell data, show ads, or use third-party tracking."],
  [EyeOff, "The minimum, nothing more", "Settings, screen-time totals, app names and, if you turn it on, location. Never messages, photos or browsing history."],
  [Eye, "Never hidden from your child", "The eGuard app is always visible on the device and shows what's on. There is no stealth mode."],
  [Users, "Only your family sees it", "Your children's data is visible to the parents in your family account, and no one else."],
  [Trash2, "Yours to take or delete", "Export everything as a file, or delete a child or your whole account, from Settings, whenever you like."],
  [BadgeCheck, "The truth about settings", "A protection shows Verified only when the device confirms it. If we can't check, we say so."],
];

const DATA: [string, string, string][] = [
  ["Your account", "Name, email, password (stored only as a hash), time zone", "Until you delete it"],
  ["Your children", "First name, birth year, protection settings, optional photo", "Until you delete the child"],
  ["Devices and browsers", "Name, model, system version, battery, the settings each reports", "Until you remove the device"],
  ["Activity", "Screen-time totals, app names, change history, resolved alerts", "90 days, then deleted automatically"],
  ["Location", "Latest location only, if you turn sharing on. Visit history only if your family turns it on", "Latest: replaced with each update. History: 90 days"],
  ["Payments", "Plan and payment records. Card details stay with PayMongo", "Until you delete your account"],
];

const NEVER = ["Messages or chats", "Photos, videos or files", "Which websites your child visits", "Keystrokes, calls or contacts", "Camera or microphone"];

const SECURITY: { title: string; icon: LucideIcon; items: string[] }[] = [
  { title: "Your account", icon: LockKeyhole, items: [
    "Passwords are hashed with bcrypt. We never store or see them in plain text.",
    "After repeated failed sign-ins, the account locks for a while.",
    "See every signed-in session and sign out of the ones you don't recognize. Resetting a password signs out everywhere.",
    "Changing your email needs your password. Email links expire: 24 hours to verify, one hour to reset a password.",
  ] },
  { title: "Your child's devices", icon: KeyRound, items: [
    "Each phone and browser gets its own key when you pair it. It never receives your password.",
    "Pairing codes work once and expire after 15 minutes.",
    "Browser keys last 15 minutes and change constantly. If one is used from two places, eGuard disconnects that browser and alerts you.",
    "We store only a scrambled (hashed) copy of every key, so a leaked database couldn't be used to impersonate a device.",
  ] },
  { title: "The rules themselves", icon: FileSignature, items: [
    "Browser rules are digitally signed by eGuard. The extension ignores any rule that isn't, so no one can feed it fake settings.",
    "Devices keep following the last rules they received if they go offline, instead of switching protection off.",
    "If a setting is changed on the device, the device reports it and you get an alert.",
  ] },
  { title: "Inside your family", icon: UserCog, items: [
    "Only a family admin can add or remove a parent.",
    "Deleting a child needs a password, and only an admin can do it.",
    "Every change is recorded in the child's history: who changed what, and from which app.",
  ] },
  { title: "On the network", icon: Fingerprint, items: [
    "Everything travels over HTTPS.",
    "Maps are loaded through our own servers, so the map provider never sees your IP address or what you're looking at.",
  ] },
];

const RIGHTS: [LucideIcon, string, React.ReactNode][] = [
  [Download, "Get a copy of your data", <>In Settings › Data, export everything about your family as a file.</>],
  [Trash2, "Delete a child", <>Open the child&apos;s profile and delete them. Their devices, activity and history go with them.</>],
  [History, "Delete your account", <>Settings › Data. For a family admin, this deletes the whole family. Can&apos;t sign in? <Link href="/delete-account">Request deletion</Link> and we act within {LEGAL.deletionDays} working days.</>],
  [MapPinned, "Turn location history off", <>It&apos;s off unless your family turns it on. An admin can switch it off in Settings › Privacy at any time.</>],
];

export default function SecurityPage() {
  const privacyEmail = LEGAL.privacyEmail ?? supportEmail();
  const dpo = LEGAL.dpoName ?? `${LEGAL.shortName}'s Data Protection Officer`;
  return (
    <>
      <PageHead
        eyebrow="Security & privacy"
        title="Built to be trusted with your family"
        lede="Parents trust eGuard with their children's devices. Here's exactly what we collect, what we never touch, how accounts and devices are protected, and what you can do with your data."
      >
        <div className="sp-facts">
          <div><b>₱0</b><span>from ads or selling data</span></div>
          <div><b>90 days</b><span>then activity is deleted automatically</span></div>
          <div><b>RA 10173</b><span>we follow the Philippine Data Privacy Act</span></div>
        </div>
      </PageHead>

      <div className="lp-wrap st-about">
        <div className="st-block">
          <h2>Our promises</h2>
          <ul className="st-values sp-promises">
            {PROMISES.map(([Ico, title, body]) => <li key={title}><i><Ico /></i><h3>{title}</h3><p>{body}</p></li>)}
          </ul>
        </div>

        <div className="st-block">
          <h2>What we keep, and for how long</h2>
          <p>The main things eGuard stores about your family. The <Link href="/privacy#retention">Privacy Policy</Link> has the full list.</p>
          <div className="st-table">
            <table>
              <thead><tr><th>What</th><th>What exactly</th><th>How long</th></tr></thead>
              <tbody>{DATA.map(([what, detail, time]) => <tr key={what}><td>{what}</td><td>{detail}</td><td>{time}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="sp-never">
            <b><EyeOff />eGuard never collects</b>
            <ul>{NEVER.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        </div>

        <div className="st-split">
          <div>
            <h2>How your family&apos;s data is protected</h2>
            <p>Security is built into how eGuard works, not added on top. Your child&apos;s devices never hold your password, every key is stored scrambled, and the rules that reach a device can be proven to come from you.</p>
          </div>
          <div className="sp-art"><ServerCloud label="eGuard's servers, protected by a shield" /></div>
        </div>

        <div className="sp-sec-grid">
          {SECURITY.map(({ title, icon: Ico, items }) => (
            <section key={title} className="sp-group" aria-labelledby={`sec-${title}`}>
              <h3 id={`sec-${title}`}><i><Ico /></i>{title}</h3>
              <ul>{items.map((it) => <li key={it}><ShieldCheck />{it}</li>)}</ul>
            </section>
          ))}
        </div>

        <div className="st-block">
          <h2>Your rights, one click away</h2>
          <p>Under the Data Privacy Act of 2012, you can be informed, access, correct, object to, erase and take a copy of your data. Most of it you can do yourself:</p>
          <ul className="st-values sp-rights">
            {RIGHTS.map(([Ico, title, body]) => <li key={title}><i><Ico /></i><h3>{title}</h3><p>{body}</p></li>)}
          </ul>
        </div>

        <div className="st-block sp-orgs">
          <i><School /></i>
          <div>
            <h2>For schools and organizations</h2>
            <p>Recommending eGuard to your families, or reviewing it for a program? Each family keeps its own account and its own data; a school or employer never sees a family&apos;s information. For our data-processing details, write to <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>.</p>
          </div>
        </div>

        <div className="st-block">
          <h2>Questions, requests or a security concern</h2>
          <p>{LEGAL.entity} is the personal information controller for eGuard. Privacy requests go to {dpo} at <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>{LEGAL.address ? <>, {LEGAL.address}</> : null}.</p>
          <p>Found a security problem? Please tell us at the same address before sharing it publicly, and we&apos;ll work with you to fix it.</p>
        </div>

        <div className="st-cta">
          <div>
            <h2>Protect your children, not their privacy</h2>
            <p>Free for one child. No card needed.</p>
          </div>
          <Link href="/register" className="lp-btn lp-btn-white">Get Started Free<ArrowRight /></Link>
        </div>
      </div>
    </>
  );
}
