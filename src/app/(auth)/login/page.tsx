import { LoginForm } from "@/components/auth-forms";
import { pageMetadata } from "@/lib/site";
import { safeNext } from "@/lib/return-to";
import { enabledWebProviders } from "@/lib/oauth-web";
import { oauthMessage } from "@/lib/oauth-errors";
import { botCheckSiteKey } from "@/lib/bot-check";
import { FormSuspense } from "../form-suspense";
import { redirectIfSignedIn } from "../signed-out";

export const metadata = pageMetadata({ title: "Sign in", path: "/login", description: "Sign in to eGuard to manage your children's protections, screen time and alerts." });

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, oauth, provider } = await searchParams;
  await redirectIfSignedIn(next);
  return <LoginForm next={safeNext(next) ?? ""} providers={enabledWebProviders()} notice={oauthMessage(oauth, provider)} botCheck={botCheckSiteKey()} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return <FormSuspense><Login searchParams={props.searchParams} /></FormSuspense>;
}
