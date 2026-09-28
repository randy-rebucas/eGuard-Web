import { RegisterForm } from "@/components/auth-forms";
import { pageMetadata } from "@/lib/site";
import { redirectIfSignedIn } from "../signed-out";

export const metadata = pageMetadata({ title: "Create account", path: "/register", description: "Create a free eGuard account. Set up screen time, bedtime and app rules for one child, with every setting verified on the device." });

export default async function RegisterPage() {
  await redirectIfSignedIn();
  return <RegisterForm />;
}
