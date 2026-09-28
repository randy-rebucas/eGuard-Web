import type { Metadata } from "next";
import { LEGAL, legalDate } from "@/lib/legal";
import { pageMetadata } from "@/lib/site";
import { supportEmail } from "@/lib/support";
import { LegalBody, PageHead } from "../page-head";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  path: "/privacy",
  description: "What eGuard collects from parents and children's devices, why, how long it's kept, and how to export or delete it.",
});

const COLLECTED: [string, string][] = [
  ["Your account", "Your name, email address, password (stored only as a one-way hash), your role in the family, notification preferences, and your Apple or Google account ID if you sign in with them."],
  ["Your children", "Each child's first name, birth year, protection settings and, if you add one, a profile photo."],
  ["Your children's devices", "Device name, model, operating system and app version, battery level, and the settings each device reports. A pairing token identifies the device; we store only a hash of it."],
  ["Screen time and apps", "Daily and hourly screen-time totals, the names of installed apps, minutes used per app, and app approval requests."],
  ["Location (optional)", "Only if you turn on Location for a child: the device's current location, which each update overwrites. Places visited are kept only if you also turn on location history."],
  ["Alerts and history", "Alerts about protection changes, offline devices and limits, and a record of the changes made in your family and by whom."],
  ["Payments", "Your plan, purchase and renewal dates, and the reference numbers PayMongo gives us. Card and e-wallet details go straight to PayMongo and never reach eGuard."],
  ["Support", "The messages you send us and any details you include."],
  ["Signing in", "The browser or app you signed in from, so you can see and end your sessions. Your IP address is used briefly to limit repeated sign-in attempts."],
];

function Contact() {
  const email = LEGAL.privacyEmail ?? supportEmail();
  return <a href={`mailto:${email}`}>{email}</a>;
}

export default function PrivacyPage() {
  const sections = [
    {
      id: "summary", title: "The short version",
      body: (
        <ul>
          <li>eGuard collects what it needs to set up and verify protections on your children&apos;s devices, and nothing more.</li>
          <li>We never read messages, photos, browsing content or files on your child&apos;s device.</li>
          <li>We don&apos;t sell your data, show ads, or use third-party tracking.</li>
          <li>Activity such as screen time and alerts is deleted automatically after 90 days.</li>
          <li>Location is off unless you turn it on. Even then, only the current location is kept unless you choose to keep history.</li>
          <li>You can export or delete your family&apos;s data at any time from Settings.</li>
        </ul>
      ),
    },
    {
      id: "who-we-are", title: "Who we are",
      body: (
        <>
          <p>{LEGAL.entity} (&quot;eGuard&quot;, &quot;we&quot;) runs the eGuard website, parent dashboard and apps. We are the personal information controller for the data described here, under the Philippines&apos; Data Privacy Act of 2012 (Republic Act No. 10173).</p>
          <p>
            {LEGAL.dpoName ? <>Our Data Protection Officer is <strong>{LEGAL.dpoName}</strong>. </> : <>Our Data Protection Officer handles every privacy request. </>}
            You can reach them at <Contact />{LEGAL.address ? <>, or by post at {LEGAL.address}</> : null}.
          </p>
        </>
      ),
    },
    {
      id: "what-we-collect", title: "What we collect",
      body: (
        <>
          <p>A parent gives us most of this directly. The rest comes from your children&apos;s devices once you pair them with eGuard.</p>
          <div className="st-table">
            <table>
              <thead><tr><th scope="col">Category</th><th scope="col">What it includes</th></tr></thead>
              <tbody>{COLLECTED.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody>
            </table>
          </div>
          <h3>What we never collect</h3>
          <p>Messages, contacts, call logs, browsing history or web page content, photos or files stored on your child&apos;s device, audio, calendars, health or financial information.</p>
        </>
      ),
    },
    {
      id: "how-we-use-it", title: "How we use it",
      body: (
        <>
          <p>We use your data to:</p>
          <ul>
            <li>apply the protections you choose to your children&apos;s devices, and check that each one is really on;</li>
            <li>show you screen time, apps, location and Configuration Health;</li>
            <li>send you alerts, sign-in and verification emails, and reminders about your plan;</li>
            <li>process payments and manage your subscription;</li>
            <li>answer your support requests;</li>
            <li>keep eGuard secure, prevent abuse, and fix problems.</li>
          </ul>
          <p>We process this data to provide the service you signed up for, on the basis of your consent as your child&apos;s parent or guardian, and where the law requires it (for example, keeping payment records). We don&apos;t use your family&apos;s data for advertising, and we don&apos;t make automated decisions about you or your children that have legal effects.</p>
        </>
      ),
    },
    {
      id: "children", title: "Children's data",
      body: (
        <>
          <p>eGuard is for parents and guardians. Children don&apos;t create accounts. A parent adds each child and pairs each device, and in doing so consents on the child&apos;s behalf to the collection described in this policy.</p>
          <p>eGuard is never hidden. The eGuard app is visible on your child&apos;s device, and on Android, children 13 and older are asked to agree to supervision. We encourage you to tell your children what eGuard does and why.</p>
          <p>Data from a child&apos;s device is used only to provide eGuard to their family. It is never used for advertising or shared for anyone else&apos;s purposes.</p>
        </>
      ),
    },
    {
      id: "sharing", title: "Who we share it with",
      body: (
        <>
          <p><strong>We don&apos;t sell personal data.</strong> Within your family, every parent you add can see your children&apos;s data. Outside your family, we share data only with:</p>
          <ul>
            <li><strong>Service providers</strong> who run parts of eGuard for us: hosting and database, email delivery, and PayMongo for payments. They may use the data only to provide their service to us, under contract.</li>
            <li><strong>Apple or Google</strong>, if you choose to sign in with them. We receive your name and email from them; we don&apos;t send them your family&apos;s data.</li>
            <li><strong>Authorities</strong>, when the law requires it, or to protect someone&apos;s safety.</li>
          </ul>
          <p>Maps in the dashboard are loaded through our own servers, so the map provider never sees your IP address or what you&apos;re looking at.</p>
        </>
      ),
    },
    {
      id: "retention", title: "How long we keep it",
      body: (
        <ul>
          <li><strong>Activity</strong> (screen time, app usage, location history, change history and resolved alerts): 90 days, then deleted automatically.</li>
          <li><strong>Current location</strong>: overwritten with every update, and deleted when you remove the device or the child.</li>
          <li><strong>Security records</strong> of account changes: one year.</li>
          <li><strong>Sessions</strong>: until you sign out, or 30 days. Email verification links expire after 24 hours and password-reset links after one hour.</li>
          <li><strong>Your account, children and settings</strong>: until you delete them.</li>
          <li><strong>Payment records</strong>: as long as Philippine tax and accounting laws require, even after you delete your account.</li>
        </ul>
      ),
    },
    {
      id: "cookies", title: "Cookies",
      body: (
        <>
          <p>eGuard uses two cookies, both our own:</p>
          <ul>
            <li><strong>eg_session</strong> keeps you signed in. It is required, and ends when you sign out.</li>
            <li><strong>eg_theme</strong> remembers whether you chose light or dark mode.</li>
          </ul>
          <p>We don&apos;t use advertising, analytics or tracking cookies. If that changes, we&apos;ll update this policy first.</p>
        </>
      ),
    },
    {
      id: "security", title: "How we protect it",
      body: (
        <>
          <p>Everything is sent over HTTPS. Passwords are hashed with bcrypt, and sign-in, device and reset tokens are stored only as hashes. Repeated failed sign-ins lock the account for a while. Only people in your family can see your family&apos;s data, and only a family admin can remove a parent or delete a child.</p>
          <p>If a breach ever puts your data at risk, we will notify you and the National Privacy Commission within 72 hours of finding out, as the law requires.</p>
        </>
      ),
    },
    {
      id: "transfers", title: "Where it's stored",
      body: <p>Our hosting and service providers may store and process data outside the Philippines. When they do, we require them by contract to protect it to the standard of the Data Privacy Act.</p>,
    },
    {
      id: "your-rights", title: "Your rights",
      body: (
        <>
          <p>Under the Data Privacy Act, you have the right to be informed about how your data is used, to access it, to correct it, to object to its processing, to have it erased or blocked, to get a copy in a portable format, and to claim damages. You can do most of this yourself:</p>
          <ul>
            <li><strong>Download everything</strong>: Settings › Data › Export (JSON).</li>
            <li><strong>Correct details</strong>: Settings › Account, or edit a child&apos;s profile.</li>
            <li><strong>Delete a child&apos;s data</strong>: delete the child from their profile.</li>
            <li><strong>Delete your account</strong>: Settings › Data. If you&apos;re the family admin, this deletes the whole family, including every child and device.</li>
          </ul>
          <p>For anything else, write to <Contact />. If you&apos;re not satisfied with our answer, you can file a complaint with the <a href="https://privacy.gov.ph" rel="noopener noreferrer" target="_blank">National Privacy Commission</a>.</p>
        </>
      ),
    },
    {
      id: "changes", title: "Changes to this policy",
      body: <p>If we change how we use your data, we&apos;ll update this page and its date. For significant changes, we&apos;ll also email family admins before the change takes effect.</p>,
    },
  ];

  return (
    <>
      <PageHead eyebrow="Legal" title="Privacy Policy" lede="What eGuard collects from you and your children's devices, why, and what you can do about it.">
        <div className="st-meta"><span><b>Last updated</b> {legalDate(LEGAL.updated)}</span><span><b>Questions</b> <Contact /></span></div>
      </PageHead>
      <LegalBody sections={sections} />
    </>
  );
}
