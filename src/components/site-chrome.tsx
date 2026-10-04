import type { CSSProperties } from "react";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { Menu } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { SignedIn } from "@/components/signed-in";
import { LEGAL } from "@/lib/legal";

/**
 * Header and footer shared by the landing page and the public pages (about, privacy, terms, blog).
 * Social links and a newsletter sign-up belong in the footer once the accounts and a mailing list exist.
 */

/** In the order the sections appear on the landing page, then pages elsewhere. */
const NAV = [
  ["Who It's For", "/#communities"], ["Features", "/#features"], ["For Parents", "/#habits"],
  ["How It Works", "/how-it-works"], ["Extension", "/#browsers"], ["Pricing", "/pricing"],
  ["FAQ", "/#faq"], ["Learn", "/learn"],
] as const;

function Brand({ style }: { style?: CSSProperties }) {
  return (
    <Link href="/" className="lp-brand" aria-label="eGuard home" style={style}>
      <LogoMark size={44} />
      <span><b>eGuard</b><small>Digital Safety for Brighter Tomorrows</small></span>
    </Link>
  );
}

/** Static apart from the sign-in links, which stream in once the session is known (see SignedIn). */
export function SiteHeader() {
  return (
    <header className="lp-header">
      <div className="lp-wrap">
        <Brand />
        <nav className="lp-nav" aria-label="Primary">
          {NAV.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="lp-head-cta">
          <SignedIn
            signedIn={<Link href="/dashboard" className="lp-btn lp-btn-primary">Open Dashboard</Link>}
            signedOut={
              <>
                <Link href="/login" className="lp-btn lp-signin">Sign In</Link>
                <Link href="/register" className="lp-btn lp-btn-primary">Get Started</Link>
              </>
            }
          />
          <details className="lp-menu">
            <summary aria-label="Open menu"><Menu /></summary>
            <nav className="lp-menu-panel" aria-label="Mobile">
              {NAV.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
              <SignedIn signedIn={null} signedOut={<Link href="/login">Sign In</Link>} />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

/** The current year, cached so the footer stays in the static shell; re-read daily so it rolls over on Jan 1. */
async function Year() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export function SiteFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-foot-grid">
          <Brand style={{ alignSelf: "start" }} />
          <div>
            <h4>Product</h4>
            <ul><li><Link href="/#features">Features</Link></li><li><Link href="/protections">Protections</Link></li><li><Link href="/how-it-works">How it works</Link></li><li><Link href="/#browsers">Browser extension</Link></li><li><Link href="/pricing">Pricing</Link></li></ul>
          </div>
          <div>
            <h4>Resources</h4>
            <ul><li><Link href="/learn">Knowledge Center</Link></li><li><Link href="/help">Help Center</Link></li><li><Link href="/#faq">FAQ</Link></li><li><Link href="/blog">Blog</Link></li><li><Link href="/guides">Guides by age</Link></li><li><Link href="/for-kids">For kids</Link></li></ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul><li><Link href="/about">About</Link></li><li><Link href="/security">Security &amp; privacy</Link></li><li><Link href="/privacy">Privacy</Link></li><li><Link href="/terms">Terms</Link></li><li><Link href="/delete-account">Delete account</Link></li></ul>
          </div>
        </div>
        <div className="lp-foot-bottom">
          <span>© <Year /> {LEGAL.entity}. eGuard is a product of {LEGAL.shortName}.</span>
          <span>A safer digital world for their brighter tomorrow.</span>
        </div>
      </div>
    </footer>
  );
}
