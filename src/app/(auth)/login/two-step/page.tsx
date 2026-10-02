import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TwoStepForm } from "@/components/auth-forms";
import { safeNext } from "@/lib/return-to";
import { CHALLENGE_COOKIE } from "@/lib/two-factor";
import { FormSuspense } from "../../form-suspense";

export const metadata = { title: "Two-step verification", robots: { index: false } };

async function TwoStep({ searchParams }: Pick<PageProps<"/login/two-step">, "searchParams">) {
  const { next } = await searchParams;
  // Only reachable right after the password step; anyone else starts there
  if (!(await cookies()).get(CHALLENGE_COOKIE)?.value) redirect("/login");
  return <TwoStepForm next={safeNext(next) ?? ""} />;
}

export default function TwoStepPage(props: PageProps<"/login/two-step">) {
  return <FormSuspense><TwoStep searchParams={props.searchParams} /></FormSuspense>;
}
