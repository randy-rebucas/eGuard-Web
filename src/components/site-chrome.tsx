import type { CSSProperties } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { LEGAL } from "@/lib/legal";

/**
 * Header and footer shared by the landing page and the public pages (about, privacy, terms, blog).
 * Social links and a newsletter sign-up belong in the footer once the accounts and a mailing list exist.
 */

/** In the order the sections appear on the landing page, then pages elsewhere. */
const NAV = [
  ["Who It's For", "/#communities"], ["Features", "/#features"], ["For Parents", "/#habits"],
  ["How It Works", "/#how-it-works"], ["Extension", "/#browsers"], ["Pricing", "/#pricing"],
  ["FAQ", "/#faq"], ["Blog", "/blog"],
] as const;

function Brand({ style }: { style?: CSSProperties }) {
  return (
    <Link href="/" className="lp-brand" aria-label="eGuard home" style={style}>
      <LogoMark size={44} />
      <span><b>eGuard</b><small>Digital Safety for Brighter Tomorrows</small></span>
    </Link>
  );
}

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="lp-header">
      <div className="lp-wrap">
        <Brand />
        <nav className="lp-nav" aria-label="Primary">
          {NAV.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="lp-head-cta">
          {signedIn ? (
            <Link href="/dashboard" className="lp-btn lp-btn-primary">Open Dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="lp-btn lp-signin">Sign In</Link>
              <Link href="/register" className="lp-btn lp-btn-primary">Get Started</Link>
            </>
          )}
          <details className="lp-menu">
            <summary aria-label="Open menu"><Menu /></summary>
            <nav className="lp-menu-panel" aria-label="Mobile">
              {NAV.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
              {signedIn ? null : <Link href="/login">Sign In</Link>}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-foot-grid">
          <Brand style={{ alignSelf: "start" }} />
          <div>
            <h4>Product</h4>
            <ul><li><Link href="/#features">Features</Link></li><li><Link href="/#how-it-works">How it works</Link></li><li><Link href="/#browsers">Browser extension</Link></li><li><Link href="/#pricing">Pricing</Link></li></ul>
          </div>
          <div>
            <h4>Resources</h4>
            <ul><li><Link href="/help">Help Center</Link></li><li><Link href="/#faq">FAQ</Link></li><li><Link href="/blog">Blog</Link></li></ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul><li><Link href="/about">About</Link></li><li><Link href="/privacy">Privacy</Link></li><li><Link href="/terms">Terms</Link></li><li><Link href="/delete-account">Delete account</Link></li></ul>
          </div>
        </div>
        <div className="lp-foot-bottom">
          <span>© {new Date().getFullYear()} {LEGAL.entity}. eGuard is a product of {LEGAL.shortName}.</span>
          <span>A safer digital world for their brighter tomorrow.</span>
        </div>
      </div>
    </footer>
  );
}
