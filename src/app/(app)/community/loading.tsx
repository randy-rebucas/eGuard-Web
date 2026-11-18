import { PageSkeleton } from "@/components/ui";

/* Shaped like Community's pages: a search row, then a list card */
export default function Loading() {
  return (
    <PageSkeleton label="Loading Community" action>
      <div className="skeleton" style={{ height: 44, borderRadius: 12 }} />
      <div className="skeleton" style={{ height: 420, borderRadius: 20 }} />
    </PageSkeleton>
  );
}
