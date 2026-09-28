import { PageSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton label="Loading protection" action>
      <div className="skeleton" style={{ height: 220, borderRadius: 20 }} />
      <div className="skeleton" style={{ height: 420, borderRadius: 20 }} />
    </PageSkeleton>
  );
}
