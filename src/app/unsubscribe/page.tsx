import Link from "next/link";
import { Brand } from "@/components/logo";
import { UnsubscribeForm } from "@/components/unsubscribe-form";

export const metadata = { title: "Unsubscribe", robots: { index: false } };

/** The whole page depends on the emailed token in the URL. */
export const instant = false;

/** A product update's unsubscribe link. Works signed in or out: the token alone says who. */
export default async function UnsubscribePage(props: PageProps<"/unsubscribe">) {
  const { t } = await props.searchParams;
  return (
    <main className="verify-page">
      <Link href="/" aria-label="eGuard home"><Brand /></Link>
      <div className="card card-pad verify-card">
        <UnsubscribeForm token={typeof t === "string" ? t : ""} />
      </div>
    </main>
  );
}
