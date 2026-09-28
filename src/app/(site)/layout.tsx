import { getUser } from "@/lib/auth";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "../landing.css";
import "./site.css";

/** Public pages (about, privacy, terms, blog): the landing page's header, footer and palette around plain content. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const signedIn = Boolean(await getUser());
  return (
    <div className="lp">
      <SiteHeader signedIn={signedIn} />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
