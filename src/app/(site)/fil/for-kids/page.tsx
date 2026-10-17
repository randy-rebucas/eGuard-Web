import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { KIDS_COPY, KIDS_LANGUAGES } from "../../for-kids/copy";
import { KidsPage } from "../../for-kids/kids-page";

/** The page for children in Filipino. Same sections as /for-kids; the copy is in for-kids/copy.tsx. */
export const metadata: Metadata = pageMetadata({ ...KIDS_COPY.fil.meta, path: "/fil/for-kids", languages: KIDS_LANGUAGES, locale: "fil_PH" });

export default function ParaSaBataPage() {
  return <KidsPage lang="fil" />;
}
