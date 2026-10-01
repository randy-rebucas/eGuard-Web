import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "../landing.css";
import "./site.css";

/**
 * Public pages (about, privacy, terms, blog): the landing page's header, footer and palette around plain content.
 * Everything here is prerendered into the static shell; only the header's sign-in links depend on the request.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
