import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFamily } from "@/lib/queries";
import { childLimitReached } from "@/lib/family-service";
import { PageHead, UpgradeNote } from "@/components/ui";
import { ChildForm } from "@/components/forms";

export const metadata = { title: "Add child" };

export default async function NewChildPage() {
  const u = await requireUser();
  const [family, count] = await Promise.all([getFamily(u.familyId), db.child.count({ where: { familyId: u.familyId } })]);
  const full = childLimitReached(family.plan, count);
  return (
    <>
      <PageHead title="Add a child" crumbs={[{ href: "/children", label: "Children" }]} text="After adding a child, pair their device from the Devices page with the eGuard app." />
      <section className="card card-pad">
        {full ? <UpgradeNote icon="users" title="Your plan is full" text={full} /> : <ChildForm />}
      </section>
    </>
  );
}
