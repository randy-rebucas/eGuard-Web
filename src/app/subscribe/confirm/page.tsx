import Link from "next/link";
import { Brand } from "@/components/logo";
import { ConfirmSubscriptionForm } from "@/components/confirm-subscription-form";

export const metadata = { title: "Confirm your email", robots: { index: false } };

/** The whole page depends on the emailed token in the URL. */
export const instant = false;

/** A mailing-list confirmation link (lib/subscribers). The token alone says who. */
export default async function ConfirmSubscriptionPage(props: PageProps<"/subscribe/confirm">) {
  const { t } = await props.searchParams;
  return (
    <main className="verify-page">
      <Link href="/" aria-label="eGuard home"><Brand /></Link>
      <div className="card card-pad verify-card">
        <ConfirmSubscriptionForm token={typeof t === "string" ? t : ""} />
      </div>
    </main>
  );
}
