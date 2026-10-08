import type { Metadata } from "next";
import { FREE_CHILDREN } from "@/lib/plans";
import Link from "next/link";
import { LEGAL, legalDate } from "@/lib/legal";
import { pageMetadata } from "@/lib/site";
import { supportEmail } from "@/lib/support";
import { LegalBody, PageHead } from "../page-head";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Use",
  path: "/terms",
  description: "The terms for using eGuard: who can use it, how plans and payments work, and what eGuard can and can't promise.",
});

function Contact() {
  const email = LEGAL.privacyEmail ?? supportEmail();
  return <a href={`mailto:${email}`}>{email}</a>;
}

export default function TermsPage() {
  const sections = [
    {
      id: "agreement", title: "Agreeing to these terms",
      body: (
        <>
          <p>These terms are an agreement between you and {LEGAL.entity} (&quot;{LEGAL.shortName}&quot;, &quot;we&quot;) for using eGuard, our parental control service: the eGuard website, parent dashboard and apps (together, &quot;eGuard&quot;). By creating an account or using eGuard, you agree to them and to our <Link href="/privacy">Privacy Policy</Link>.</p>
          <p>If you don&apos;t agree, please don&apos;t use eGuard.</p>
        </>
      ),
    },
    {
      id: "who-can-use", title: "Who can use eGuard",
      body: (
        <>
          <p>eGuard is a parental control service. To use it, you must:</p>
          <ul>
            <li>be at least 18 years old;</li>
            <li>be the parent or legal guardian of each child you add, or have their parent&apos;s or guardian&apos;s permission to supervise them; and</li>
            <li>pair only devices that you own or that you&apos;re entitled to manage for a child in your care.</li>
          </ul>
          <p>You may not use eGuard to monitor an adult, or anyone who isn&apos;t in your care.</p>
        </>
      ),
    },
    {
      id: "account", title: "Your account and family",
      body: (
        <>
          <p>Give accurate details when you sign up, and keep your password to yourself. You&apos;re responsible for what happens under your account. If you think someone else has access to it, change your password and sign out other sessions in Settings › Security, then tell us.</p>
          <p>The person who creates a family is its <strong>family admin</strong>. The admin can add and remove other parents, change the plan, and delete the family. Every parent in a family can see and change its children&apos;s settings, so only add people you trust.</p>
        </>
      ),
    },
    {
      id: "acceptable-use", title: "Using eGuard responsibly",
      body: (
        <>
          <p>eGuard is visible on every device it runs on, and is meant to be used openly within a family. You agree not to:</p>
          <ul>
            <li>hide eGuard, disguise it, or use it to secretly track or monitor anyone;</li>
            <li>use eGuard to harass, stalk or harm anyone, or in any way that breaks the law;</li>
            <li>try to get into another family&apos;s data, or into parts of eGuard you aren&apos;t meant to reach;</li>
            <li>copy, resell, reverse engineer or overload eGuard, or get around its limits and security;</li>
            <li>use the API in ways other than those we&apos;ve agreed with you.</li>
          </ul>
          <p>We may suspend or close accounts that break these rules.</p>
        </>
      ),
    },
    {
      id: "what-eguard-does", title: "What eGuard can and can't do",
      body: (
        <>
          <p>eGuard applies protections through the features Android and iOS make available, and reports each setting only once the device confirms it. That also means some things are outside our control:</p>
          <ul>
            <li>Some protections aren&apos;t available on every platform. eGuard marks these Unsupported, or walks you through setting them up yourself.</li>
            <li>A device that is off, offline or restricted by battery saver can&apos;t receive changes or report its settings until it reconnects.</li>
            <li>Operating system updates, device settings or a determined child can sometimes get around a protection. eGuard tells you when a device reports a change, but can&apos;t promise to prevent every one.</li>
            <li>Location depends on the device&apos;s GPS, network and permissions, and may be missing or inaccurate.</li>
          </ul>
          <p>eGuard is a tool to help you look after your children online. It doesn&apos;t replace your own supervision and conversations with them, and it isn&apos;t an emergency service. If a child is in danger, contact the police or emergency services.</p>
        </>
      ),
    },
    {
      id: "plans", title: "Plans and payments",
      body: (
        <>
          <p>eGuard is free for {FREE_CHILDREN}. Paid plans (eGuard Plus and Family Pro) add more children, devices and features, as described on our <Link href="/pricing">pricing page</Link>. Prices are in Philippine pesos. Payments are processed by PayMongo.</p>
          <ul>
            <li><strong>Auto-renew</strong> plans are charged to your card or Maya account at the start of each billing period, until you cancel.</li>
            <li><strong>Passes</strong> are paid once, with GCash, Maya, a card or QR Ph, and don&apos;t renew. We&apos;ll email you before a pass ends.</li>
            <li>You can <strong>cancel</strong> at any time in Settings › Subscription. Your plan stays active until the end of the period you paid for, and then your family moves to the Free plan.</li>
            <li>When a family moves to a smaller plan, the children and devices already added stay protected, but you can&apos;t add more until you upgrade again. Features the smaller plan doesn&apos;t include stop working.</li>
            <li>We may change prices. A new price applies from your next billing period, and we&apos;ll tell you before it does.</li>
          </ul>
          <p>Except where the law requires otherwise, payments for a period that has started aren&apos;t refunded. If you think you were charged by mistake, write to <Contact /> and we&apos;ll look into it.</p>
        </>
      ),
    },
    {
      id: "your-data", title: "Your data",
      body: (
        <p>Your family&apos;s data belongs to you. You give us permission to store and process it only to provide eGuard to your family, as the <Link href="/privacy">Privacy Policy</Link> describes. You can export or delete it at any time from Settings.</p>
      ),
    },
    {
      id: "our-service", title: "Our service",
      body: (
        <>
          <p>eGuard&apos;s software, name, logo and content belong to {LEGAL.shortName}. We give you a personal, non-transferable right to use eGuard for your family while these terms apply.</p>
          <p>We&apos;re always improving eGuard, so features may change. We&apos;ll try to give notice before removing anything significant from a paid plan. We aim to keep eGuard available at all times, but it may sometimes be unavailable for maintenance or reasons outside our control.</p>
        </>
      ),
    },
    {
      id: "ending", title: "Ending your account",
      body: (
        <p>You can delete your account at any time in Settings › Data, or <Link href="/delete-account">ask us to</Link> if you can&apos;t sign in. If you&apos;re the family admin, this deletes the whole family and cancels an auto-renewing plan. We may suspend or close an account that breaks these terms or puts others at risk. Where it&apos;s safe to, we&apos;ll tell you first and give you a chance to export your data.</p>
      ),
    },
    {
      id: "liability", title: "Warranties and liability",
      body: (
        <>
          <p>We provide eGuard with reasonable care and skill. Beyond that, and to the extent the law allows, eGuard is provided &quot;as is&quot;, without other promises about what it will achieve.</p>
          <p>To the extent the law allows, we aren&apos;t liable for indirect or consequential losses, and our total liability to you is limited to the amount you paid eGuard in the 12 months before the claim. Nothing in these terms limits rights you have under the Consumer Act of the Philippines or other laws that can&apos;t be waived.</p>
        </>
      ),
    },
    {
      id: "law", title: "Governing law",
      body: <p>These terms are governed by the laws of the Republic of the Philippines. If there&apos;s a dispute, please contact us first so we can try to resolve it. If we can&apos;t, it will be settled by the proper courts of the Philippines.</p>,
    },
    {
      id: "changes", title: "Changes to these terms",
      body: <p>We may update these terms. We&apos;ll change the date at the top of this page and, for significant changes, email family admins before they take effect. If you keep using eGuard after that, the new terms apply.</p>,
    },
    {
      id: "contact", title: "Contact us",
      body: <p>Questions about these terms? Write to <Contact />{LEGAL.address ? <>, or by post to {LEGAL.address}</> : null}.</p>,
    },
  ];

  return (
    <>
      <PageHead eyebrow="Legal" title="Terms of Use" lede="The agreement between you and eGuard, in plain language.">
        <div className="st-meta"><span><b>Last updated</b> {legalDate(LEGAL.updated)}</span><span><b>Questions</b> <Contact /></span></div>
      </PageHead>
      <LegalBody sections={sections} />
    </>
  );
}
