import { Suspense, type ReactNode } from "react";
import { getUser } from "@/lib/auth";
import { FORUM_FLAG, communityOn } from "@/lib/forum";
import { isEnabled } from "@/lib/feature-flags";

/**
 * A Community link for the public pages, shown only where Community is open: for a signed-in parent, when the
 * `community` flag is on for their family; for a visitor, when it's on for every family (a partial rollout stays
 * hidden from the public). /community sends a signed-out visitor to sign in and back. Like SignedIn, only this
 * streams in at request time; the static shell renders without it.
 */
export function CommunityLink({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Resolve>{children}</Resolve>
    </Suspense>
  );
}

async function Resolve({ children }: { children: ReactNode }) {
  const user = await getUser();
  const open = user ? await communityOn(user.familyId) : await isEnabled(FORUM_FLAG);
  return open ? children : null;
}
