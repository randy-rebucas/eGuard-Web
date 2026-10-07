import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff-auth";
import { Loading } from "@/components/ui";
import { ConsoleLoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

/** Signed in already: on to the console. Only this waits on the request; the heading is in the static shell. */
async function SignIn() {
  if (await getStaff()) redirect("/");
  return <ConsoleLoginForm />;
}

export default function ConsoleLoginPage() {
  return (
    <main className="cn-center">
      <div className="card card-pad cn-narrow">
        <div>
          <p className="cn-eyebrow">eGuard Console</p>
          <h1 className="cn-h1">Staff sign-in</h1>
          <p className="cn-muted">For the eGuard team. Parents sign in at www.eguard.family.</p>
        </div>
        <Suspense fallback={<Loading height={260} radius={14} label="Loading" />}><SignIn /></Suspense>
      </div>
    </main>
  );
}
