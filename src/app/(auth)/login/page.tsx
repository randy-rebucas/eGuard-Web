import { LoginForm } from "@/components/auth-forms";
import { pageMetadata } from "@/lib/site";
import { safeNext } from "@/lib/return-to";
import { FormSuspense } from "../form-suspense";
import { redirectIfSignedIn } from "../signed-out";

export const metadata = pageMetadata({ title: "Sign in", path: "/login", description: "Sign in to eGuard to manage your children's protections, screen time and alerts." });

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  await redirectIfSignedIn(next);
  return <LoginForm next={safeNext(next) ?? ""} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return <FormSuspense><Login searchParams={props.searchParams} /></FormSuspense>;
}
