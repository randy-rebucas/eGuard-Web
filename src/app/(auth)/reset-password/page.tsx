import { ResetPasswordForm } from "@/components/auth-forms";

export const metadata = { title: "Reset password", robots: { index: false }, referrer: "no-referrer" };

/** Where the emailed reset link lands. Works signed in or out: the token alone identifies the parent. */
export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token } = await props.searchParams;
  return <ResetPasswordForm token={typeof token === "string" ? token : ""} />;
}
