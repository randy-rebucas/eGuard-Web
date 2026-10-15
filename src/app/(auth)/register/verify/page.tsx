import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VerifySignupForm } from "@/components/auth-forms";
import { SIGNUP_COOKIE, pendingSignup } from "@/lib/signup";
import { FormSuspense } from "../../form-suspense";
import { redirectIfSignedIn } from "../../signed-out";

export const metadata = { title: "Check your email", robots: { index: false } };

async function VerifySignup() {
  await redirectIfSignedIn();
  // Only reachable right after the form, on the browser it was sent from; anyone else starts there
  const pending = await pendingSignup((await cookies()).get(SIGNUP_COOKIE)?.value);
  if (!pending) redirect("/register?expired=1");
  return <VerifySignupForm email={pending.email} />;
}

export default function VerifySignupPage() {
  return <FormSuspense><VerifySignup /></FormSuspense>;
}
