import { ForgotPasswordForm } from "@/components/auth-forms";
import { redirectIfSignedIn } from "../signed-out";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  await redirectIfSignedIn();
  return <ForgotPasswordForm />;
}
