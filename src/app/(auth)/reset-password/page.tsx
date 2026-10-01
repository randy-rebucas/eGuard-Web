import { ResetPasswordForm } from "@/components/auth-forms";
import { FormSuspense } from "../form-suspense";

export const metadata = { title: "Reset password", robots: { index: false }, referrer: "no-referrer" };

async function ResetPassword({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === "string" ? token : ""} />;
}

/** Where the emailed reset link lands. Works signed in or out: the token alone identifies the parent. */
export default function ResetPasswordPage(props: PageProps<"/reset-password">) {
  return <FormSuspense><ResetPassword searchParams={props.searchParams} /></FormSuspense>;
}
