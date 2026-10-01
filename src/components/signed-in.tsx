import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getUser } from "@/lib/auth";

/**
 * Shows `signedIn` or `signedOut` depending on the session, for the public pages. Reading the session cookie
 * is request-time work, so only this streams in: the page around it stays in the prerendered static shell,
 * which shows the signed-out version until the session is known (most visitors to these pages aren't signed in).
 */
export function SignedIn({ signedIn, signedOut }: { signedIn: ReactNode; signedOut: ReactNode }) {
  return (
    <Suspense fallback={signedOut}>
      <Resolve signedIn={signedIn} signedOut={signedOut} />
    </Suspense>
  );
}

/** The call to action on the public pages: the dashboard for a signed-in parent, otherwise sign-up. */
export function StartLink({ className, open = "Open Dashboard", start = "Get Started Free" }: { className: string; open?: string; start?: string }) {
  return (
    <SignedIn
      signedIn={<Link href="/dashboard" className={className}>{open}<ArrowRight /></Link>}
      signedOut={<Link href="/register" className={className}>{start}<ArrowRight /></Link>}
    />
  );
}

async function Resolve({ signedIn, signedOut }: { signedIn: ReactNode; signedOut: ReactNode }) {
  return (await getUser()) ? signedIn : signedOut;
}
