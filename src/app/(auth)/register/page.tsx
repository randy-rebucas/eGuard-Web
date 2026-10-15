import { RegisterForm } from "@/components/auth-forms";
import { pageMetadata } from "@/lib/site";
import { FREE_CHILDREN } from "@/lib/plans";
import { enabledWebProviders } from "@/lib/oauth-web";
import { oauthMessage } from "@/lib/oauth-errors";
import { botCheckSiteKey } from "@/lib/bot-check";
import { FormSuspense } from "../form-suspense";
import { redirectIfSignedIn } from "../signed-out";

export const metadata = pageMetadata({ title: "Create account", path: "/register", description: `Create a free eGuard account. Set up screen time, bedtime and app rules for ${FREE_CHILDREN}, with every setting verified on the device.` });

async function Register({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  const { oauth, provider, expired } = await searchParams;
  await redirectIfSignedIn();
  // Back from /register/verify without a sign-up to finish (it expired, or the page was opened elsewhere)
  const notice = expired ? "That sign-up expired or was started on another browser. Fill in the form again for a new code." : oauthMessage(oauth, provider);
  return <RegisterForm providers={enabledWebProviders()} notice={notice} botCheck={botCheckSiteKey()} />;
}

export default function RegisterPage(props: PageProps<"/register">) {
  return <FormSuspense><Register searchParams={props.searchParams} /></FormSuspense>;
}
