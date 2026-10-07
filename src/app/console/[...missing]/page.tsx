import { notFound } from "next/navigation";

/** Any other path on the console host gets the console's 404, not the site's (which links to the parent dashboard). */
export default function Missing() {
  notFound();
}
