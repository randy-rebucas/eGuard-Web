import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { communityOn } from "@/lib/forum";

/** Community is only there for families with the `community` feature flag (console › Feature flags) */
export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!(await communityOn(user.familyId))) notFound();
  return children;
}
