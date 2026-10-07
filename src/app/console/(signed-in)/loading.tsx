import { Loading } from "@/components/ui";

/** Shown while a console page loads: the bar and nav stay, the page waits here. */
export default function ConsoleLoading() {
  return (
    <>
      <Loading height={32} radius={10} label="Loading page" style={{ width: 220 }} />
      <Loading height={320} radius={20} label="Loading page" />
    </>
  );
}
