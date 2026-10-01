import { LoginForm } from "@/components/auth-forms";
import { pageMetadata } from "@/lib/site";
import { safeNext } from "@/lib/return-to";
import { redirectIfSignedIn } from "../signed-out";

export const metadata = pageMetadata({ title: "Sign in", path: "/login", description: "Sign in to eGuard to manage your children's protections, screen time and alerts." });

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  await redirectIfSignedIn(next);
  return <LoginForm next={safeNext(next) ?? ""} />;
}
