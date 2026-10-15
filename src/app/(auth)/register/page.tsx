import { RegisterForm } from "@/components/auth-forms";
import { pageMetadata } from "@/lib/site";
import { FREE_CHILDREN } from "@/lib/plans";
import { enabledWebProviders } from "@/lib/oauth-web";
import { oauthMessage } from "@/lib/oauth-errors";
import { FormSuspense } from "../form-suspense";
import { redirectIfSignedIn } from "../signed-out";

export const metadata = pageMetadata({ title: "Create account", path: "/register", description: `Create a free eGuard account. Set up screen time, bedtime and app rules for ${FREE_CHILDREN}, with every setting verified on the device.` });

async function Register({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  const { oauth, provider } = await searchParams;
  await redirectIfSignedIn();
  return <RegisterForm providers={enabledWebProviders()} notice={oauthMessage(oauth, provider)} />;
}

export default function RegisterPage(props: PageProps<"/register">) {
  return <FormSuspense><Register searchParams={props.searchParams} /></FormSuspense>;
}
