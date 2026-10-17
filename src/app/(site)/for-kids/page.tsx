import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { KIDS_COPY, KIDS_LANGUAGES } from "./copy";
import { KidsPage } from "./kids-page";

export const metadata: Metadata = pageMetadata({ ...KIDS_COPY.en.meta, path: "/for-kids", languages: KIDS_LANGUAGES });

export default function ForKidsPage() {
  return <KidsPage lang="en" />;
}
