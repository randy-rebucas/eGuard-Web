import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFamily } from "@/lib/queries";
import { childLimitReached } from "@/lib/family-service";
import { nextPlan } from "@/lib/plans";
import { PageHead, UpgradeNote } from "@/components/ui";
import { ChildForm } from "@/components/child-forms";

export const metadata = { title: "Add child" };

export default async function NewChildPage() {
  const u = await requireUser();
  const [family, count] = await Promise.all([getFamily(u.familyId), db.child.count({ where: { familyId: u.familyId } })]);
  const full = childLimitReached(family.plan, count);
  return (
    <>
      <PageHead title="Add a child" crumbs={[{ href: "/children", label: "Children" }]}
        text={full ? undefined : "Add their name and age. Next, you'll pair their phone or tablet with the eGuard app."} />
      <section className="card card-pad">
        {full ? <UpgradeNote icon="users" title="Your plan is full" text={full} plans={!!nextPlan(family.plan)} /> : <ChildForm />}
      </section>
    </>
  );
}
