import { LoginForm } from "@/components/auth-forms";
import { redirectIfSignedIn } from "../signed-out";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  await redirectIfSignedIn();
  return <LoginForm />;
}
