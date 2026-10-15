import { ForgotPasswordForm } from "@/components/auth-forms";
import { botCheckSiteKey } from "@/lib/bot-check";
import { FormSuspense } from "../form-suspense";
import { redirectIfSignedIn } from "../signed-out";

export const metadata = { title: "Forgot password", robots: { index: false } };

async function ForgotPassword() {
  await redirectIfSignedIn();
  return <ForgotPasswordForm botCheck={botCheckSiteKey()} />;
}

export default function ForgotPasswordPage() {
  return <FormSuspense><ForgotPassword /></FormSuspense>;
}
