import { RegisterForm } from "@/components/auth-forms";
import { pageMetadata } from "@/lib/site";
import { FREE_CHILDREN } from "@/lib/plans";
import { FormSuspense } from "../form-suspense";
import { redirectIfSignedIn } from "../signed-out";

export const metadata = pageMetadata({ title: "Create account", path: "/register", description: `Create a free eGuard account. Set up screen time, bedtime and app rules for ${FREE_CHILDREN}, with every setting verified on the device.` });

async function Register() {
  await redirectIfSignedIn();
  return <RegisterForm />;
}

export default function RegisterPage() {
  return <FormSuspense><Register /></FormSuspense>;
}
