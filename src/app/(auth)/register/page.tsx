import { RegisterForm } from "@/components/auth-forms";
import { redirectIfSignedIn } from "../signed-out";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  await redirectIfSignedIn();
  return <RegisterForm />;
}
