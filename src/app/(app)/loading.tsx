import { PageSkeleton } from "@/components/ui";

/** Fallback for any page without its own skeleton. */
export default function Loading() {
  return (
    <PageSkeleton label="Loading page">
      <div className="skeleton" style={{ height: 320, borderRadius: 20 }} />
    </PageSkeleton>
  );
}
