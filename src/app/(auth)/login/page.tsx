import { LoginForm } from "@/components/auth-forms";
import { pageMetadata } from "@/lib/site";
import { redirectIfSignedIn } from "../signed-out";

export const metadata = pageMetadata({ title: "Sign in", path: "/login", description: "Sign in to eGuard to manage your children's protections, screen time and alerts." });

export default async function LoginPage() {
  await redirectIfSignedIn();
  return <LoginForm />;
}
