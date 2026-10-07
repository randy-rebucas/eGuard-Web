import { PageSkeleton } from "@/components/ui";

/* Shaped like a child's places page (one card listing visits) */
export default function Loading() {
  return (
    <PageSkeleton label="Loading places">
      <div className="skeleton" style={{ height: 480, borderRadius: 20 }} />
    </PageSkeleton>
  );
}
