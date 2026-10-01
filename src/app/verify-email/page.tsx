import Link from "next/link";
import { Brand } from "@/components/logo";
import { VerifyEmailForm } from "@/components/verify-email-form";

export const metadata = { title: "Verify your email", robots: { index: false } };

/** The whole page depends on the emailed token in the URL. */
export const instant = false;

/** Where the emailed link lands. Works signed in or out, since the token alone identifies the parent. */
export default async function VerifyEmailPage(props: PageProps<"/verify-email">) {
  const { token } = await props.searchParams;
  return (
    <main className="verify-page">
      <Link href="/" aria-label="eGuard home"><Brand /></Link>
      <div className="card card-pad verify-card">
        <VerifyEmailForm token={typeof token === "string" ? token : ""} />
      </div>
    </main>
  );
}
