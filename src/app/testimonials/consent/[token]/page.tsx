import Link from "next/link";
import { Brand } from "@/components/logo";
import { TestimonialConsent } from "@/components/testimonial-consent";
import { CONSENT_TEXT, consentView } from "@/lib/testimonials";

export const metadata = { title: "Share your words", robots: { index: false } };

/** The whole page depends on the emailed token in the URL. */
export const instant = false;

/** Where "May we share your words about eGuard?" lands (lib/testimonials). Signed in or out: the token alone says who. */
export default async function TestimonialConsentPage(props: PageProps<"/testimonials/consent/[token]">) {
  const { token } = await props.params;
  const view = await consentView(token);
  return (
    <main className="verify-page">
      <Link href="/" aria-label="eGuard home"><Brand /></Link>
      <div className="card card-pad verify-card">
        {view ? <TestimonialConsent token={token} view={view} consentText={CONSENT_TEXT} /> : (
          <div className="verify-card-body">
            <h1>This link doesn&apos;t work</h1>
            <p>It may be incomplete or older than 30 days. Reply to eGuard&apos;s email and we&apos;ll send a new one. Nothing is shared without your answer.</p>
            <Link className="btn btn-primary" href="/">Go to eguard.family</Link>
          </div>
        )}
      </div>
    </main>
  );
}
