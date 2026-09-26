import { PageHead } from "@/components/ui";
import { ChildForm } from "@/components/forms";

export const metadata = { title: "Add child" };

export default function NewChildPage() {
  return (
    <>
      <PageHead title="Add a child" crumbs={[{ href: "/children", label: "Children" }]} text="After adding a child, pair their device from the Devices page with the eGuard app." />
      <section className="card card-pad"><ChildForm /></section>
    </>
  );
}
