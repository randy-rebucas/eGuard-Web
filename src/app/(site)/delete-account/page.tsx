import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, legalDate } from "@/lib/legal";
import { pageMetadata } from "@/lib/site";
import { supportEmail } from "@/lib/support";
import { LegalBody, PageHead } from "../page-head";

/** Public deletion page: Google Play's "delete account URL" must work without the app and without signing in. */
export const metadata: Metadata = pageMetadata({
  title: "Delete your eGuard account",
  path: "/delete-account",
  description: "How to delete your eGuard account and your family's data, in the app, on the web, or by email if you can't sign in.",
});

const email = () => LEGAL.privacyEmail ?? supportEmail();

function requestLink() {
  const body = [
    "Please delete my eGuard account and my family's data.",
    "",
    "Email address on the account: ",
    "Family name (optional): ",
    "",
    "I'm sending this from the email address on the account.",
  ].join("\n");
  return `mailto:${email()}?subject=${encodeURIComponent("Delete my eGuard account")}&body=${encodeURIComponent(body)}`;
}

export default function DeleteAccountPage() {
  const sections = [
    {
      id: "in-the-app", title: "Delete it yourself",
      body: (
        <>
          <p>The quickest way. It takes effect immediately.</p>
          <h3>On the web</h3>
          <ol>
            <li><Link href="/login">Sign in to eGuard</Link>.</li>
            <li>Go to <Link href="/settings/data">Settings › Data</Link>.</li>
            <li>Under <strong>Delete your account</strong>, enter your password and confirm. If you signed up with Apple or Google and never set a password, type <strong>DELETE</strong> instead.</li>
          </ol>
          <h3>In the eGuard app</h3>
          <ol>
            <li>Open eGuard and go to <strong>Settings</strong>.</li>
            <li>Tap <strong>Delete account</strong> and confirm with your password, or by typing DELETE.</li>
          </ol>
        </>
      ),
    },
    {
      id: "by-email", title: "Can't sign in? Ask us",
      body: (
        <>
          <p>
            Email <a href={requestLink()}>{email()}</a> from the address on your eGuard account, with the subject
            &quot;Delete my eGuard account&quot;. We&apos;ll confirm the request with that address, then delete the
            account within {LEGAL.deletionDays} working days and email you when it&apos;s done.
          </p>
          <p className="st-note">
            <b>Request deletion by email:</b> <a href={requestLink()}>open a pre-filled email to {email()}</a>. We only act on
            requests we can confirm came from the account&apos;s owner, so nobody can delete your family&apos;s account but you.
          </p>
        </>
      ),
    },
    {
      id: "what-is-deleted", title: "What gets deleted",
      body: (
        <>
          <p><strong>If you&apos;re the family admin</strong> (the person who created the family), deleting your account deletes the whole family:</p>
          <ul>
            <li>every parent&apos;s account in the family, and their sign-in sessions;</li>
            <li>every child&apos;s profile and photo, and every paired device and browser;</li>
            <li>protection settings and browser rules, screen time and app usage, app approvals and site requests, locations and location history;</li>
            <li>alerts, change history, support messages and your plan and purchase records.</li>
          </ul>
          <p><strong>If you&apos;re another parent in the family</strong>, only your own account is deleted. The family, its children and their data stay with the family admin.</p>
          <p>Nothing is kept in your eGuard account afterwards, and it can&apos;t be restored. If you want a copy first, download it from <Link href="/settings/data">Settings › Data › Export</Link>.</p>
        </>
      ),
    },
    {
      id: "what-is-kept", title: "What may be kept",
      body: (
        <ul>
          <li><strong>Payments.</strong> If you paid for a plan, PayMongo, our payment processor, keeps its own record of those payments, as the law requires of it.</li>
          <li><strong>Backups.</strong> Deleted data can remain in our hosting provider&apos;s encrypted backups for a short time until they&apos;re overwritten. Backups are never used to restore a deleted account.</li>
          <li><strong>Emails.</strong> Messages already sent to you, or that you sent us, stay in those mailboxes.</li>
        </ul>
      ),
    },
    {
      id: "subscriptions", title: "Subscriptions",
      body: (
        <p>
          Deleting the family admin&apos;s account cancels an auto-renewing plan paid through eGuard&apos;s website, so you won&apos;t be charged again.
          If the account can&apos;t be deleted because the cancellation didn&apos;t go through, you&apos;ll see a message; try again or email us.
          A plan bought through Google Play has to be cancelled in the Play Store app.
        </p>
      ),
    },
    {
      id: "delete-some-data", title: "Delete some data but keep your account",
      body: (
        <ul>
          <li><strong>A child&apos;s data:</strong> open the child&apos;s page, then Profile, and delete the child. This removes their devices, screen time, apps, locations and history.</li>
          <li><strong>A device:</strong> open it from Devices and remove it.</li>
          <li><strong>Location history:</strong> turn it off in Settings › Privacy. Only the current location is kept after that.</li>
          <li>Activity such as screen time and alerts is deleted automatically after 90 days anyway. See the <Link href="/privacy#retention">Privacy Policy</Link>.</li>
        </ul>
      ),
    },
  ];

  return (
    <>
      <PageHead eyebrow="Your data" title="Delete your eGuard account" lede="You can delete your account and your family's data at any time: yourself in a few taps, or by asking us if you can't sign in.">
        <div className="st-meta"><span><b>Last updated</b> {legalDate(LEGAL.updated)}</span><span><b>Questions</b> <a href={`mailto:${email()}`}>{email()}</a></span></div>
      </PageHead>
      <LegalBody sections={sections} />
    </>
  );
}
